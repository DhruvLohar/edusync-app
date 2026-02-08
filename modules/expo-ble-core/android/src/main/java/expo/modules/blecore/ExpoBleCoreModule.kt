package expo.modules.blecore

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

import android.Manifest
import android.app.Activity
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.os.bundleOf
import android.bluetooth.*
import android.bluetooth.le.*
import java.util.UUID

class ExpoBleCoreModule : Module() {

  companion object {
    private const val TAG = "ExpoBleCore"
    private const val PERMISSION_REQUEST_CODE = 1001
    private const val ATTENDANCE_SERVICE_UUID = "0c287abd-eb75-4dd3-afc6-b3f3368307fa"
    private const val ALERT_CHARACTERISTIC_UUID = "0c287abd-eb75-4dd3-afc6-b3f3368307fb"
    private const val MANUFACTURER_ID = 0xFFFF
    private const val CONNECTION_TIMEOUT_MS = 10000L
  }

  private var bluetoothAdapter: BluetoothAdapter? = null
  private var bluetoothLeAdvertiser: BluetoothLeAdvertiser? = null
  private var bluetoothLeScanner: BluetoothLeScanner? = null
  private var gattServer: BluetoothGattServer? = null
  private var bluetoothManager: BluetoothManager? = null

  private var isAdvertising = false
  private var currentCombinedId: String? = null
  private var checkInTimestamp: Long? = null
  private var advertiseCallback: AdvertiseCallback? = null

  private var isScanning = false
  private var scanClassId: String? = null
  private var scanCallback: ScanCallback? = null
  private var classicDiscoveryReceiver: BroadcastReceiver? = null

  private val discoveredStudents = mutableMapOf<String, StudentInfo>()
  private val discoveredDeviceAddresses = mutableSetOf<String>()

  private var isAlertRolloutActive = false
  private var alertRolloutCancelled = false
  private var alertHandler: Handler? = null

  private var currentGatt: BluetoothGatt? = null
  private var gattConnectionPromise: Promise? = null
  private var connectionTimeoutRunnable: Runnable? = null
  private var bluetoothStateReceiver: BroadcastReceiver? = null

  data class StudentInfo(
    val studentId: String,
    val deviceAddress: String,
    val rssi: Int,
    val discoveredAt: Long,
    var verified: Boolean = false,
    var verifiedAt: Long? = null
  )

  override fun definition() = ModuleDefinition {
    Name("ExpoBleCore")

    OnCreate {
      android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      android.util.Log.d(TAG, "🚀 ANDROID MODULE - DUAL MODE (BLE + Classic)")
      android.util.Log.d(TAG, "   Version: COMPLETE DIAGNOSTIC v2.0")
      android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

      val activity = appContext.activityProvider?.currentActivity
      activity?.let {
        bluetoothManager = it.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter
        alertHandler = Handler(Looper.getMainLooper())
        android.util.Log.d(TAG, "✓ Bluetooth Adapter: ${bluetoothAdapter != null}")
      }
    }

    OnDestroy {
      android.util.Log.d(TAG, "Cleaning up module")
      cleanup()
    }

    Events("onStudentDiscovered", "onAlertProgress", "onAlertReceived", "onBluetoothStateChanged")

    // ============== PERMISSIONS & UTILS ==============

    Function("hasPermissions") {
      val activity = appContext.activityProvider?.currentActivity ?: return@Function false
      return@Function hasRequiredPermissions(activity)
    }

    AsyncFunction("requestPermissions") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }

      if (hasRequiredPermissions(activity)) {
        promise.resolve(true)
        return@AsyncFunction
      }

      val permissionsToRequest = getRequiredPermissions(activity)
      try {
        ActivityCompat.requestPermissions(activity, permissionsToRequest.toTypedArray(), PERMISSION_REQUEST_CODE)
        Handler(Looper.getMainLooper()).postDelayed({
          promise.resolve(hasRequiredPermissions(activity))
        }, 1000)
      } catch (e: Exception) {
        promise.reject("PERMISSION_ERROR", e.message, e)
      }
    }

    Function("isBluetoothEnabled") {
      return@Function bluetoothAdapter?.isEnabled == true
    }

    AsyncFunction("requestEnableBluetooth") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }

      if (bluetoothAdapter?.isEnabled == true) {
        promise.resolve(true)
        return@AsyncFunction
      }

      try {
        val enableBtIntent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
        activity.startActivityForResult(enableBtIntent, 1002)
        Handler(Looper.getMainLooper()).postDelayed({
          promise.resolve(bluetoothAdapter?.isEnabled == true)
        }, 1000)
      } catch (e: Exception) {
        promise.reject("BLUETOOTH_ERROR", e.message, e)
      }
    }

    Function("isBleAdvertisingSupported") {
      return@Function bluetoothAdapter?.isMultipleAdvertisementSupported == true
    }

    Function("startBluetoothStateListener") {
      val activity = appContext.activityProvider?.currentActivity
      val context = activity?.applicationContext ?: return@Function false
      if (bluetoothStateReceiver != null) return@Function true

      bluetoothStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          if (intent?.action == BluetoothAdapter.ACTION_STATE_CHANGED) {
            val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
            sendEvent("onBluetoothStateChanged", bundleOf("enabled" to (state == BluetoothAdapter.STATE_ON)))
          }
        }
      }
      context.registerReceiver(bluetoothStateReceiver, IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED))
      return@Function true
    }

    Function("stopBluetoothStateListener") {
      val context = appContext.activityProvider?.currentActivity?.applicationContext ?: return@Function false
      bluetoothStateReceiver?.let {
        try {
          context.unregisterReceiver(it)
        } catch (e: Exception) {
        }
        bluetoothStateReceiver = null
      }
      return@Function true
    }

    // ============== TEACHER FUNCTIONS (DUAL SCANNING) ==============

    // filepath: /Users/mohitjain/Developer/edusync-app/modules/expo-ble-core/android/src/main/java/expo/modules/blecore/ExpoBleCoreModule.kt
    // Replace the startStudentScan function with this simplified BLE-only version:

    AsyncFunction("startStudentScan") { classId: String, promise: Promise ->
      android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      android.util.Log.d(TAG, "🔵 START BLE SCAN (Teacher)")
      android.util.Log.d(TAG, "   Class Prefix: '$classId'")
      android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        android.util.Log.e(TAG, "❌ No activity")
        promise.resolve(mapOf("success" to false, "error" to "No activity"))
        return@AsyncFunction
      }

      if (!hasRequiredPermissions(activity)) {
        android.util.Log.e(TAG, "❌ Missing permissions")
        val missing = getRequiredPermissions(activity)
        android.util.Log.e(TAG, "   Missing: ${missing.joinToString()}")
        promise.resolve(mapOf("success" to false, "error" to "Missing permissions: ${missing.joinToString()}"))
        return@AsyncFunction
      }

      if (bluetoothAdapter?.isEnabled != true) {
        android.util.Log.e(TAG, "❌ Bluetooth not enabled")
        promise.resolve(mapOf("success" to false, "error" to "Bluetooth not enabled"))
        return@AsyncFunction
      }

      if (isScanning) {
        android.util.Log.w(TAG, "⚠️ Already scanning")
        promise.resolve(mapOf("success" to false, "error" to "Already scanning"))
        return@AsyncFunction
      }

      scanClassId = classId
      isScanning = true

      // Initialize BLE scanner
      bluetoothLeScanner = bluetoothAdapter?.bluetoothLeScanner
      if (bluetoothLeScanner == null) {
        android.util.Log.e(TAG, "❌ BLE Scanner unavailable")
        promise.resolve(mapOf("success" to false, "error" to "BLE Scanner unavailable"))
        return@AsyncFunction
      }

      android.util.Log.d(TAG, "✓ BLE Scanner available")

      scanCallback = createScanCallback()
      val scanSettings = ScanSettings.Builder()
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        .setReportDelay(0)
        .build()

      android.util.Log.d(TAG, "Scan Mode: LOW_LATENCY (fastest)")
      android.util.Log.d(TAG, "Service Filter: NONE (will filter manually)")
      android.util.Log.d(TAG, "Report Delay: 0 (immediate callbacks)")

      try {
        bluetoothLeScanner?.startScan(null, scanSettings, scanCallback)
        android.util.Log.i(TAG, "✅ BLE scan started successfully!")
        android.util.Log.d(TAG, "   Waiting for scan callbacks...")
        android.util.Log.d(TAG, "   Looking for prefix: '$classId'")
        promise.resolve(mapOf("success" to true))
      } catch (e: SecurityException) {
        android.util.Log.e(TAG, "❌ BLE scan failed: SecurityException")
        android.util.Log.e(TAG, "   ${e.message}")
        promise.resolve(mapOf("success" to false, "error" to "Security error: ${e.message}"))
      } catch (e: Exception) {
        android.util.Log.e(TAG, "❌ BLE scan failed: ${e.javaClass.simpleName}")
        android.util.Log.e(TAG, "   ${e.message}")
        promise.resolve(mapOf("success" to false, "error" to "Scan failed: ${e.message}"))
      }
    }

    Function("stopStudentScan") {
      android.util.Log.d(TAG, "🛑 Stopping BLE scan")

      // Stop BLE scan
      if (scanCallback != null) {
        try {
          bluetoothLeScanner?.stopScan(scanCallback)
          android.util.Log.d(TAG, "✓ BLE scan stopped")
        } catch (e: SecurityException) {
          android.util.Log.e(TAG, "Security exception stopping BLE: ${e.message}")
        }
        scanCallback = null
      }

      isScanning = false
      scanClassId = null
      return@Function mapOf("success" to true)
    }

    Function("isScanning") {
      return@Function isScanning
    }

    Function("getDiscoveredStudents") {
      return@Function discoveredStudents.values.map { student ->
        mapOf(
          "studentId" to student.studentId,
          "deviceAddress" to student.deviceAddress,
          "rssi" to student.rssi,
          "discoveredAt" to student.discoveredAt,
          "verified" to student.verified,
          "verifiedAt" to student.verifiedAt
        )
      }
    }

    Function("clearDiscoveredStudents") {
      discoveredStudents.clear()
      discoveredDeviceAddresses.clear()
      android.util.Log.d(TAG, "🧹 Cleared discovered students and device addresses")
      return@Function true
    }

    // ============== STUDENT FUNCTIONS (BLE ADVERTISING ONLY) ==============

    AsyncFunction("checkIn") { combinedId: String, promise: Promise ->
      android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      android.util.Log.d(TAG, "📢 CHECK-IN (Android Student)")
      android.util.Log.d(TAG, "   ID: '$combinedId'")

      if (combinedId.length > 8) {
        android.util.Log.e(TAG, "❌ ID too long (max 8 chars)")
        promise.resolve(mapOf("success" to false, "error" to "ID too long"))
        return@AsyncFunction
      }

      bluetoothLeAdvertiser = bluetoothAdapter?.bluetoothLeAdvertiser
      if (bluetoothLeAdvertiser == null) {
        android.util.Log.e(TAG, "❌ No advertiser")
        promise.resolve(mapOf("success" to false, "error" to "No advertiser"))
        return@AsyncFunction
      }

      val activity = appContext.activityProvider?.currentActivity
      if (activity != null) setupGattServer(activity)

      val advertiseData = AdvertiseData.Builder()
        .addServiceUuid(ParcelUuid.fromString(ATTENDANCE_SERVICE_UUID))
        .setIncludeDeviceName(false)
        .setIncludeTxPowerLevel(false)
        .build()

      val scanResponse = AdvertiseData.Builder()
        .setIncludeDeviceName(false)
        .setIncludeTxPowerLevel(false)
        .addManufacturerData(MANUFACTURER_ID, combinedId.toByteArray(Charsets.UTF_8))
        .build()

      val settings = AdvertiseSettings.Builder()
        .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
        .setConnectable(true)
        .setTimeout(0)
        .build()

      advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
          android.util.Log.i(TAG, "✅ Advertising started")
          android.util.Log.i(TAG, "   Broadcasting: '$combinedId'")
          android.util.Log.i(TAG, "   Format: Manufacturer Data (iOS compatible)")
          isAdvertising = true
          currentCombinedId = combinedId
          checkInTimestamp = System.currentTimeMillis()
          promise.resolve(mapOf("success" to true))
        }

        override fun onStartFailure(errorCode: Int) {
          val errorMsg = when (errorCode) {
            ADVERTISE_FAILED_DATA_TOO_LARGE -> "Data too large"
            ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> "Too many advertisers"
            ADVERTISE_FAILED_ALREADY_STARTED -> "Already started"
            ADVERTISE_FAILED_INTERNAL_ERROR -> "Internal error"
            ADVERTISE_FAILED_FEATURE_UNSUPPORTED -> "Feature unsupported"
            else -> "Error: $errorCode"
          }
          android.util.Log.e(TAG, "❌ Advertising failed: $errorMsg")
          promise.resolve(mapOf("success" to false, "error" to errorMsg))
        }
      }

      try {
        bluetoothLeAdvertiser?.startAdvertising(settings, advertiseData, scanResponse, advertiseCallback)
      } catch (e: Exception) {
        android.util.Log.e(TAG, "❌ Exception: ${e.message}")
        promise.resolve(mapOf("success" to false, "error" to e.message))
      }
    }

    Function("checkOut") {
      android.util.Log.d(TAG, "📤 Checking out")
      if (!isAdvertising) {
        return@Function mapOf("success" to false, "error" to "Not checked in")
      }

      try {
        advertiseCallback?.let { bluetoothLeAdvertiser?.stopAdvertising(it) }
      } catch (e: SecurityException) {
      }

      stopGattServer()
      isAdvertising = false
      currentCombinedId = null
      checkInTimestamp = null
      advertiseCallback = null

      android.util.Log.i(TAG, "✓ Checked out")
      return@Function mapOf("success" to true)
    }

    Function("isCheckedIn") {
      return@Function isAdvertising
    }

    Function("getCheckInStatus") {
      if (!isAdvertising) return@Function null
      return@Function mapOf(
        "studentId" to currentCombinedId,
        "checkedInAt" to checkInTimestamp
      )
    }

    // ============== ALERT FUNCTIONS ==============

    AsyncFunction("sendAlertToStudent") { deviceAddress: String, alertType: Int, promise: Promise ->
      sendAlertToStudentImpl(deviceAddress, alertType, promise)
    }

    AsyncFunction("sendAlertToAll") { studentAddresses: List<String>, alertType: Int, delayMs: Int, promise: Promise ->
      startAlertRollout(studentAddresses, alertType, delayMs, promise)
    }

    Function("cancelAlertRollout") {
      alertRolloutCancelled = true
      return@Function mapOf("success" to true)
    }

    Function("isAlertRolloutActive") {
      return@Function isAlertRolloutActive
    }

    Function("markStudentVerified") { studentId: String ->
      discoveredStudents[studentId]?.let {
        it.verified = true
        it.verifiedAt = System.currentTimeMillis()
        return@Function true
      }
      return@Function false
    }

    Function("getAttendanceReport") {
      return@Function discoveredStudents.values.map { student ->
        val status = if (student.verified) "present" else "unverified"
        mapOf(
          "studentId" to student.studentId,
          "deviceAddress" to student.deviceAddress,
          "status" to status,
          "discoveredAt" to student.discoveredAt,
          "verifiedAt" to student.verifiedAt
        )
      }
    }
  }

  // ═══════════════════════════════════════════
  //  BLE SCAN CALLBACK (WITH COMPREHENSIVE LOGGING)
  // ═══════════════════════════════════════════

  private fun createScanCallback(): ScanCallback {
    return object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        processBLEScanResult(result)
      }

      override fun onBatchScanResults(results: MutableList<ScanResult>?) {
        results?.forEach { processBLEScanResult(it) }
      }

      override fun onScanFailed(errorCode: Int) {
        android.util.Log.e(TAG, "❌ BLE scan failed: error $errorCode")
        android.util.Log.e(TAG, "Error code meanings:")
        android.util.Log.e(TAG, "  1 = SCAN_FAILED_ALREADY_STARTED")
        android.util.Log.e(TAG, "  2 = SCAN_FAILED_APPLICATION_REGISTRATION_FAILED")
        android.util.Log.e(TAG, "  3 = SCAN_FAILED_INTERNAL_ERROR")
        android.util.Log.e(TAG, "  4 = SCAN_FAILED_FEATURE_UNSUPPORTED")
      }
    }
  }

  private fun processBLEScanResult(result: ScanResult) {
    val scanRecord = result.scanRecord
    val device = result.device
    val rssi = result.rssi

    if (scanRecord == null) return

    // Early deduplication by device address
    if (discoveredDeviceAddresses.contains(device.address)) {
      return // Skip already processed devices completely
    }

    val context = appContext.reactContext ?: return
    var studentLabel: String? = null
    var isValidStudent = false

    // Strategy 1: Check if this device is advertising our attendance service (PRIORITY)
    val serviceUuids = scanRecord.serviceUuids
    val hasAttendanceService = serviceUuids?.any {
      it.uuid.toString().equals(ATTENDANCE_SERVICE_UUID, ignoreCase = true)
    } == true

    if (hasAttendanceService) {
      android.util.Log.d(TAG, "📡 Device advertising attendance service: ${device.address}")

      // Strategy 1A: Manufacturer Data (Android Students)
      val manufData = scanRecord.getManufacturerSpecificData(MANUFACTURER_ID)
      if (manufData != null) {
        try {
          val decoded = String(manufData, Charsets.UTF_8)
          if (decoded.matches(Regex("^[A-Za-z0-9]+$")) && decoded.length <= 8) {
            studentLabel = decoded
            isValidStudent = true
            android.util.Log.i(TAG, "🔍 Found student via manufacturer data: '$studentLabel' (RSSI: $rssi)")
          }
        } catch (e: Exception) {
          // Ignore decode errors
        }
      }

      // Strategy 1B: Advertised Device Name from Scan Record (iOS devices)
      if (studentLabel == null) {
        val advertName = scanRecord.deviceName
        if (advertName != null && advertName.matches(Regex("^[A-Za-z0-9]+$")) && advertName.length <= 8) {
          studentLabel = advertName
          isValidStudent = true
          android.util.Log.i(TAG, "🔍 Found student via scanRecord.deviceName: '$studentLabel' (RSSI: $rssi)")
        }
      }

      // Strategy 1C: Device Name via BLUETOOTH_CONNECT (fallback)
      if (studentLabel == null) {
        val hasConnectPerm = if (Build.VERSION.SDK_INT >= 31) {
          ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.BLUETOOTH_CONNECT
          ) == PackageManager.PERMISSION_GRANTED
        } else {
          true
        }

        if (hasConnectPerm) {
          try {
            val deviceName = device.name
            if (deviceName != null && deviceName.matches(Regex("^[A-Za-z0-9]+$")) && deviceName.length <= 8) {
              studentLabel = deviceName
              isValidStudent = true
              android.util.Log.i(TAG, "🔍 Found student via device.name: '$studentLabel' (RSSI: $rssi)")
            }
          } catch (e: SecurityException) {
            android.util.Log.e(TAG, "Security exception getting device name: ${e.message}")
          }
        }
      }
    } else {
      android.util.Log.d(TAG, "⏩ Skipping device without attendance service: ${device.address}")
    }

    // Process discovered student only if they have the attendance service
    if (studentLabel != null && isValidStudent) {
      addDiscoveredStudent(studentLabel, device.address, rssi, "BLE")
    }
  }

  // ═══════════════════════════════════════════
  //  CLASSIC BLUETOOTH DISCOVERY
  // ═══════════════════════════════════════════

  private fun processClassicDevice(device: BluetoothDevice, rssi: Int) {
    val context = appContext.reactContext ?: return

    android.util.Log.d(TAG, "")
    android.util.Log.d(TAG, "╔═══════════════════════════════════╗")
    android.util.Log.d(TAG, "║   CLASSIC DEVICE FOUND            ║")
    android.util.Log.d(TAG, "╚═══════════════════════════════════╝")
    android.util.Log.d(TAG, "Device Address: ${device.address}")
    android.util.Log.d(TAG, "RSSI: $rssi dBm")

    val hasConnectPerm = if (Build.VERSION.SDK_INT >= 31) {
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.BLUETOOTH_CONNECT
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      true
    }

    if (!hasConnectPerm) {
      android.util.Log.w(TAG, "⚠️ No BLUETOOTH_CONNECT permission")
      return
    }

    val deviceName = try {
      device.name
    } catch (e: SecurityException) {
      android.util.Log.e(TAG, "Security exception getting name: ${e.message}")
      null
    }

    android.util.Log.d(TAG, "Device Name: '${deviceName ?: "null"}'")

    if (deviceName != null && deviceName.matches(Regex("^[A-Za-z0-9]+$")) && deviceName.length <= 8) {
      addDiscoveredStudent(deviceName, device.address, rssi, "CLASSIC")
      android.util.Log.i(TAG, "  ✅ ACCEPTED (via Classic BT)")
    } else {
      android.util.Log.w(TAG, "  ✗ Invalid or no name")
    }
    android.util.Log.d(TAG, "")
  }

  // ═══════════════════════════════════════════
  //  COMMON STUDENT DISCOVERY LOGIC
  // ═══════════════════════════════════════════

  private fun addDiscoveredStudent(studentLabel: String, deviceAddress: String, rssi: Int, source: String) {
    // Filter by prefix
    if (scanClassId != null && !studentLabel.startsWith(scanClassId!!)) {
      android.util.Log.w(TAG, "⏩ FILTERED OUT (wrong prefix)")
      android.util.Log.w(TAG, "   Expected prefix: '$scanClassId'")
      android.util.Log.w(TAG, "   Got: '$studentLabel'")
      return
    }

    // De-duplication by student ID
    if (discoveredStudents.containsKey(studentLabel)) {
      android.util.Log.d(TAG, "⏩ FILTERED OUT (duplicate student ID)")
      return
    }

    // De-duplication by device address
    if (discoveredDeviceAddresses.contains(deviceAddress)) {
      android.util.Log.d(TAG, "⏩ FILTERED OUT (duplicate device address)")
      return
    }

    android.util.Log.i(TAG, "")
    android.util.Log.i(TAG, "🎉 ✅ NEW STUDENT DISCOVERED ($source)")
    android.util.Log.i(TAG, "   Student ID: $studentLabel")
    android.util.Log.i(TAG, "   Device Address: $deviceAddress")
    android.util.Log.i(TAG, "   RSSI: $rssi dBm")
    android.util.Log.i(TAG, "")

    val info = StudentInfo(
      studentLabel,
      deviceAddress,
      rssi,
      System.currentTimeMillis()
    )
    discoveredStudents[studentLabel] = info
    discoveredDeviceAddresses.add(deviceAddress)

    sendEvent(
      "onStudentDiscovered", bundleOf(
        "studentId" to studentLabel,
        "deviceAddress" to deviceAddress,
        "rssi" to rssi,
        "classId" to studentLabel
      )
    )
  }

  // ============== GATT SERVER ==============

  private fun setupGattServer(context: Context): Boolean {
    if (bluetoothManager == null) {
      bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    }

    val gattCallback = object : BluetoothGattServerCallback() {
      override fun onConnectionStateChange(device: BluetoothDevice?, status: Int, newState: Int) {
        android.util.Log.d(TAG, "[GATT] Connection state: $newState (device: ${device?.address})")
      }

      override fun onCharacteristicWriteRequest(
        device: BluetoothDevice?,
        requestId: Int,
        characteristic: BluetoothGattCharacteristic?,
        preparedWrite: Boolean,
        responseNeeded: Boolean,
        offset: Int,
        value: ByteArray?
      ) {
        if (characteristic?.uuid == UUID.fromString(ALERT_CHARACTERISTIC_UUID)) {
          val alertType = value?.firstOrNull()?.toInt() ?: 0
          android.util.Log.i(TAG, "🔔 Alert received: Type $alertType (from ${device?.address})")

          if (responseNeeded) {
            try {
              gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
            } catch (e: SecurityException) {
              android.util.Log.e(TAG, "Security exception sending GATT response: ${e.message}")
            }
          }

          Handler(Looper.getMainLooper()).post {
            sendEvent(
              "onAlertReceived", bundleOf(
                "alertType" to alertType,
                "timestamp" to System.currentTimeMillis()
              )
            )
          }
        }
      }
    }

    return try {
      gattServer = bluetoothManager?.openGattServer(context, gattCallback)
      if (gattServer == null) {
        android.util.Log.e(TAG, "[GATT] Failed to open server")
        return false
      }

      val service = BluetoothGattService(
        UUID.fromString(ATTENDANCE_SERVICE_UUID),
        BluetoothGattService.SERVICE_TYPE_PRIMARY
      )

      val alertChar = BluetoothGattCharacteristic(
        UUID.fromString(ALERT_CHARACTERISTIC_UUID),
        BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
        BluetoothGattCharacteristic.PERMISSION_WRITE
      )

      service.addCharacteristic(alertChar)
      gattServer?.addService(service)
      android.util.Log.d(TAG, "[GATT] Server setup complete")
      true
    } catch (e: Exception) {
      android.util.Log.e(TAG, "[GATT] Setup error: ${e.message}")
      false
    }
  }

  private fun stopGattServer() {
    try {
      gattServer?.clearServices()
      gattServer?.close()
      android.util.Log.d(TAG, "[GATT] Server stopped")
    } catch (e: SecurityException) {
      android.util.Log.e(TAG, "[GATT] Security exception stopping: ${e.message}")
    }
    gattServer = null
  }

  // ============== PERMISSIONS ==============

  private fun hasRequiredPermissions(activity: Activity): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      ContextCompat.checkSelfPermission(
        activity,
        Manifest.permission.BLUETOOTH_SCAN
      ) == PackageManager.PERMISSION_GRANTED &&
              ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.BLUETOOTH_ADVERTISE
              ) == PackageManager.PERMISSION_GRANTED &&
              ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.BLUETOOTH_CONNECT
              ) == PackageManager.PERMISSION_GRANTED
    } else {
      ContextCompat.checkSelfPermission(
        activity,
        Manifest.permission.ACCESS_FINE_LOCATION
      ) == PackageManager.PERMISSION_GRANTED
    }
  }

  private fun getRequiredPermissions(activity: Activity): List<String> {
    val permissions = mutableListOf<String>()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      if (ContextCompat.checkSelfPermission(
          activity,
          Manifest.permission.BLUETOOTH_SCAN
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        permissions.add(Manifest.permission.BLUETOOTH_SCAN)
      }
      if (ContextCompat.checkSelfPermission(
          activity,
          Manifest.permission.BLUETOOTH_ADVERTISE
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        permissions.add(Manifest.permission.BLUETOOTH_ADVERTISE)
      }
      if (ContextCompat.checkSelfPermission(
          activity,
          Manifest.permission.BLUETOOTH_CONNECT
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
      }
    } else {
      if (ContextCompat.checkSelfPermission(
          activity,
          Manifest.permission.ACCESS_FINE_LOCATION
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
      }
    }

    return permissions
  }

  // ============== ALERT SENDING ==============

  private fun sendAlertToStudentImpl(deviceAddress: String, alertType: Int, promise: Promise) {
    android.util.Log.d(TAG, "")
    android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    android.util.Log.d(TAG, "📤 SENDING ALERT")
    android.util.Log.d(TAG, "   To: $deviceAddress")
    android.util.Log.d(TAG, "   Type: $alertType")
    android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    val device = try {
      bluetoothAdapter?.getRemoteDevice(deviceAddress)
    } catch (e: Exception) {
      android.util.Log.e(TAG, "❌ Invalid device address: ${e.message}")
      promise.resolve(mapOf("success" to false, "error" to "Invalid address"))
      return
    }

    if (device == null) {
      android.util.Log.e(TAG, "❌ Device not found")
      promise.resolve(mapOf("success" to false, "error" to "Device not found"))
      return
    }

    android.util.Log.d(TAG, "✓ Device object created")
    android.util.Log.d(TAG, "Attempting GATT connection...")

    val gattCallback = object : BluetoothGattCallback() {
      override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
        android.util.Log.d(TAG, "[GATT] Connection state changed")
        android.util.Log.d(TAG, "   Status: $status")
        android.util.Log.d(
          TAG, "   New State: $newState (${
            when (newState) {
              BluetoothProfile.STATE_DISCONNECTED -> "DISCONNECTED"
              BluetoothProfile.STATE_CONNECTING -> "CONNECTING"
              BluetoothProfile.STATE_CONNECTED -> "CONNECTED"
              BluetoothProfile.STATE_DISCONNECTING -> "DISCONNECTING"
              else -> "UNKNOWN"
            }
          })"
        )

        when (newState) {
          BluetoothProfile.STATE_CONNECTED -> {
            android.util.Log.i(TAG, "✅ Connected! Discovering services...")
            try {
              gatt?.discoverServices()
            } catch (e: SecurityException) {
              android.util.Log.e(TAG, "❌ Security exception discovering services: ${e.message}")
              promise.resolve(mapOf("success" to false, "error" to "Permission error"))
              try {
                gatt?.disconnect()
              } catch (e2: SecurityException) {
              }
            }
          }

          BluetoothProfile.STATE_DISCONNECTED -> {
            android.util.Log.d(TAG, "Disconnected, closing GATT...")
            try {
              gatt?.close()
            } catch (e: SecurityException) {
            }
          }
        }
      }

      override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
        android.util.Log.d(TAG, "[GATT] Services discovered")
        android.util.Log.d(
          TAG,
          "   Status: $status (${if (status == BluetoothGatt.GATT_SUCCESS) "SUCCESS" else "FAILED"})"
        )

        if (status != BluetoothGatt.GATT_SUCCESS) {
          android.util.Log.e(TAG, "❌ Service discovery failed")
          promise.resolve(mapOf("success" to false, "error" to "Service discovery failed"))
          try {
            gatt?.disconnect()
          } catch (e: SecurityException) {
          }
          return
        }

        val services = gatt?.services
        android.util.Log.d(TAG, "   Found ${services?.size ?: 0} services:")
        services?.forEach { service ->
          android.util.Log.d(TAG, "     - ${service.uuid}")
        }

        val service = gatt?.getService(UUID.fromString(ATTENDANCE_SERVICE_UUID))
        if (service == null) {
          android.util.Log.e(TAG, "❌ Attendance service not found")
          android.util.Log.e(TAG, "   Expected: $ATTENDANCE_SERVICE_UUID")
          promise.resolve(mapOf("success" to false, "error" to "Service not found"))
          try {
            gatt?.disconnect()
          } catch (e: SecurityException) {
          }
          return
        }

        android.util.Log.i(TAG, "✓ Attendance service found")

        val characteristic = service.getCharacteristic(UUID.fromString(ALERT_CHARACTERISTIC_UUID))
        if (characteristic == null) {
          android.util.Log.e(TAG, "❌ Alert characteristic not found")
          android.util.Log.e(TAG, "   Expected: $ALERT_CHARACTERISTIC_UUID")
          promise.resolve(mapOf("success" to false, "error" to "Characteristic not found"))
          try {
            gatt?.disconnect()
          } catch (e: SecurityException) {
          }
          return
        }

        android.util.Log.i(TAG, "✓ Alert characteristic found")
        android.util.Log.d(TAG, "Writing alert value: $alertType")

        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val writeResult = gatt.writeCharacteristic(
              characteristic,
              byteArrayOf(alertType.toByte()),
              BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            )
            android.util.Log.d(TAG, "Write initiated (API 33+): $writeResult")
          } else {
            characteristic.value = byteArrayOf(alertType.toByte())
            characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            val writeResult = gatt.writeCharacteristic(characteristic)
            android.util.Log.d(TAG, "Write initiated (API < 33): $writeResult")
          }
        } catch (e: SecurityException) {
          android.util.Log.e(TAG, "❌ Security exception writing: ${e.message}")
          promise.resolve(mapOf("success" to false, "error" to "Write failed"))
          try {
            gatt?.disconnect()
          } catch (e2: SecurityException) {
          }
        }
      }

      override fun onCharacteristicWrite(
        gatt: BluetoothGatt?,
        characteristic: BluetoothGattCharacteristic?,
        status: Int
      ) {
        android.util.Log.d(TAG, "[GATT] Characteristic write complete")
        android.util.Log.d(
          TAG,
          "   Status: $status (${if (status == BluetoothGatt.GATT_SUCCESS) "SUCCESS" else "FAILED"})"
        )

        if (status == BluetoothGatt.GATT_SUCCESS) {
          android.util.Log.i(TAG, "✅ Alert sent successfully!")
          promise.resolve(mapOf("success" to true))
        } else {
          android.util.Log.e(TAG, "❌ Write failed with status: $status")
          promise.resolve(mapOf("success" to false, "error" to "Write failed"))
        }

        android.util.Log.d(TAG, "Disconnecting...")
        try {
          gatt?.disconnect()
          gatt?.close()
        } catch (e: SecurityException) {
          android.util.Log.e(TAG, "Security exception disconnecting: ${e.message}")
        }
      }
    }

    try {
      val activity = appContext.activityProvider?.currentActivity
      android.util.Log.d(TAG, "Initiating GATT connection...")
      device.connectGatt(activity, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    } catch (e: SecurityException) {
      android.util.Log.e(TAG, "❌ Security exception connecting: ${e.message}")
      promise.resolve(mapOf("success" to false, "error" to "Connection failed"))
    } catch (e: Exception) {
      android.util.Log.e(TAG, "❌ Exception connecting: ${e.javaClass.simpleName}")
      android.util.Log.e(TAG, "   ${e.message}")
      promise.resolve(mapOf("success" to false, "error" to "Connection failed"))
    }
  }

  private fun startAlertRollout(addresses: List<String>, alertType: Int, delayMs: Int, promise: Promise) {
    if (isAlertRolloutActive) {
      promise.resolve(mapOf("success" to false, "error" to "Rollout already active"))
      return
    }

    android.util.Log.i(TAG, "")
    android.util.Log.i(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    android.util.Log.i(TAG, "📢 ALERT ROLLOUT STARTED")
    android.util.Log.i(TAG, "   Students: ${addresses.size}")
    android.util.Log.i(TAG, "   Alert Type: $alertType")
    android.util.Log.i(TAG, "   Delay: ${delayMs}ms")
    android.util.Log.i(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    isAlertRolloutActive = true
    alertRolloutCancelled = false

    Thread {
      var successCount = 0
      var failedCount = 0
      val results = mutableListOf<Map<String, Any>>()

      for ((index, address) in addresses.withIndex()) {
        if (alertRolloutCancelled) {
          android.util.Log.w(TAG, "⚠️ Rollout cancelled at ${index + 1}/${addresses.size}")
          break
        }

        android.util.Log.d(TAG, "")
        android.util.Log.d(TAG, "Progress: ${index + 1}/${addresses.size} - $address")

        Handler(Looper.getMainLooper()).post {
          sendEvent(
            "onAlertProgress", bundleOf(
              "current" to (index + 1),
              "total" to addresses.size,
              "deviceAddress" to address,
              "status" to "connecting"
            )
          )
        }

        val latch = java.util.concurrent.CountDownLatch(1)
        var alertSuccess = false

        Handler(Looper.getMainLooper()).post {
          sendAlertToStudentImpl(address, alertType, object : Promise {
            override fun resolve(value: Any?) {
              val result = value as? Map<*, *>
              alertSuccess = result?.get("success") as? Boolean ?: false
              latch.countDown()
            }

            override fun reject(code: String, message: String?, cause: Throwable?) {
              latch.countDown()
            }
          })
        }

        try {
          latch.await(CONNECTION_TIMEOUT_MS + 2000, java.util.concurrent.TimeUnit.MILLISECONDS)
        } catch (e: Exception) {
          android.util.Log.e(TAG, "Timeout waiting for alert: ${e.message}")
        }

        if (alertSuccess) {
          successCount++
          android.util.Log.i(TAG, "   ✓ Success")
        } else {
          failedCount++
          android.util.Log.e(TAG, "   ✗ Failed")
        }

        results.add(mapOf("deviceAddress" to address, "success" to alertSuccess))

        Handler(Looper.getMainLooper()).post {
          sendEvent(
            "onAlertProgress", bundleOf(
              "current" to (index + 1),
              "total" to addresses.size,
              "deviceAddress" to address,
              "status" to if (alertSuccess) "success" else "failed"
            )
          )
        }

        if (index < addresses.size - 1 && !alertRolloutCancelled) {
          Thread.sleep(delayMs.toLong())
        }
      }

      isAlertRolloutActive = false

      android.util.Log.i(TAG, "")
      android.util.Log.i(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      android.util.Log.i(TAG, "📊 ALERT ROLLOUT COMPLETE")
      android.util.Log.i(TAG, "   Success: $successCount")
      android.util.Log.i(TAG, "   Failed: $failedCount")
      android.util.Log.i(TAG, "   Cancelled: $alertRolloutCancelled")
      android.util.Log.i(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

      Handler(Looper.getMainLooper()).post {
        promise.resolve(
          mapOf(
            "success" to successCount,
            "failed" to failedCount,
            "cancelled" to alertRolloutCancelled,
            "results" to results
          )
        )
      }
    }.start()
  }

  // ============== CLEANUP ==============

  private fun cleanup() {
    android.util.Log.d(TAG, "Cleanup started...")

    // Stop BLE scan
    try {
      scanCallback?.let { bluetoothLeScanner?.stopScan(it) }
      android.util.Log.d(TAG, "✓ BLE scan stopped")
    } catch (e: SecurityException) {
      android.util.Log.e(TAG, "Security exception stopping BLE: ${e.message}")
    }
    scanCallback = null

    // Stop Classic discovery
    try {
      bluetoothAdapter?.cancelDiscovery()
      android.util.Log.d(TAG, "✓ Classic discovery stopped")
    } catch (e: SecurityException) {
      android.util.Log.e(TAG, "Security exception stopping Classic: ${e.message}")
    }

    // Unregister receivers
    val activity = appContext.activityProvider?.currentActivity
    classicDiscoveryReceiver?.let {
      try {
        activity?.applicationContext?.unregisterReceiver(it)
        android.util.Log.d(TAG, "✓ Classic receiver unregistered")
      } catch (e: Exception) {
        android.util.Log.e(TAG, "Error unregistering Classic receiver: ${e.message}")
      }
      classicDiscoveryReceiver = null
    }

    isScanning = false

    try {
      advertiseCallback?.let { bluetoothLeAdvertiser?.stopAdvertising(it) }
      android.util.Log.d(TAG, "✓ Advertising stopped")
    } catch (e: SecurityException) {
      android.util.Log.e(TAG, "Security exception stopping advertising: ${e.message}")
    }
    isAdvertising = false
    advertiseCallback = null

    stopGattServer()

    try {
      currentGatt?.disconnect()
      currentGatt?.close()
      android.util.Log.d(TAG, "✓ GATT closed")
    } catch (e: SecurityException) {
      android.util.Log.e(TAG, "Security exception closing GATT: ${e.message}")
    }
    currentGatt = null

    bluetoothStateReceiver?.let {
      try {
        activity?.applicationContext?.unregisterReceiver(it)
        android.util.Log.d(TAG, "✓ State receiver unregistered")
      } catch (e: Exception) {
        android.util.Log.e(TAG, "Error unregistering state receiver: ${e.message}")
      }
    }
    bluetoothStateReceiver = null

    discoveredStudents.clear()
    discoveredDeviceAddresses.clear()

    android.util.Log.d(TAG, "Cleanup complete")
  }
}
