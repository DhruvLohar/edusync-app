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
import java.nio.ByteBuffer
import java.nio.ByteOrder

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
  
  // CHANGED: Store by String ID now
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
    val studentId: String, // CHANGED: Now String
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
      android.util.Log.d(TAG, "🚀 Android Module Initialized (FIXED - iOS Compatible)")
      android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      
      val activity = appContext.activityProvider?.currentActivity
      activity?.let {
        bluetoothManager = it.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter
        alertHandler = Handler(Looper.getMainLooper())
        android.util.Log.d(TAG, "Bluetooth Adapter: ${bluetoothAdapter != null}")
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
      if (activity == null) { promise.resolve(false); return@AsyncFunction }
      if (hasRequiredPermissions(activity)) { promise.resolve(true); return@AsyncFunction }

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

    Function("isBluetoothEnabled") { return@Function bluetoothAdapter?.isEnabled == true }
    
    AsyncFunction("requestEnableBluetooth") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) { promise.resolve(false); return@AsyncFunction }
      if (bluetoothAdapter?.isEnabled == true) { promise.resolve(true); return@AsyncFunction }
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
        try { context.unregisterReceiver(it) } catch (e: Exception) {}
        bluetoothStateReceiver = null
      }
      return@Function true
    }

    // ============== TEACHER FUNCTIONS ==============
    
    AsyncFunction("startStudentScan") { classId: String, promise: Promise ->
      android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      android.util.Log.d(TAG, "🔵 START STUDENT SCAN (Android Teacher)")
      android.util.Log.d(TAG, "   ClassID Prefix: '$classId'")
      
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        android.util.Log.e(TAG, "❌ No activity")
        promise.resolve(mapOf("success" to false, "error" to "No activity"))
        return@AsyncFunction
      }

      if (!hasRequiredPermissions(activity)) {
        android.util.Log.e(TAG, "❌ Missing permissions")
        promise.resolve(mapOf("success" to false, "error" to "Missing permissions"))
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

      bluetoothLeScanner = bluetoothAdapter?.bluetoothLeScanner
      if (bluetoothLeScanner == null) {
        android.util.Log.e(TAG, "❌ Scanner unavailable")
        promise.resolve(mapOf("success" to false, "error" to "Scanner not available"))
        return@AsyncFunction
      }

      scanClassId = classId

      scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
          result?.let { processScanResult(it) }
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>?) {
          results?.forEach { processScanResult(it) }
        }

        override fun onScanFailed(errorCode: Int) {
          android.util.Log.e(TAG, "❌ Scan failed: error $errorCode")
          isScanning = false
          sendEvent("onStudentDiscovered", mapOf("error" to true, "errorCode" to errorCode))
        }
      }

      val scanSettings = ScanSettings.Builder()
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        .setReportDelay(0)
        .build()

      // Filter by service UUID
      val scanFilters = listOf(
        ScanFilter.Builder()
          .setServiceUuid(ParcelUuid.fromString(ATTENDANCE_SERVICE_UUID))
          .build()
      )

      android.util.Log.d(TAG, "   Service Filter: $ATTENDANCE_SERVICE_UUID")
      android.util.Log.d(TAG, "   Looking for LocalName field in advertisements")

      try {
        bluetoothLeScanner?.startScan(scanFilters, scanSettings, scanCallback)
        isScanning = true
        android.util.Log.i(TAG, "✅ Service-filtered scan started")
        android.util.Log.i(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        promise.resolve(mapOf("success" to true))
      } catch (e: SecurityException) {
        android.util.Log.e(TAG, "❌ Security exception: ${e.message}")
        promise.resolve(mapOf("success" to false, "error" to "Security exception"))
      } catch (e: Exception) {
        android.util.Log.e(TAG, "❌ Exception: ${e.message}")
        promise.resolve(mapOf("success" to false, "error" to e.message))
      }
    }

    Function("stopStudentScan") {
      android.util.Log.d(TAG, "🛑 Stopping scan")
      if (isScanning && scanCallback != null) {
        try { bluetoothLeScanner?.stopScan(scanCallback) } catch (e: SecurityException) {}
        isScanning = false
        scanCallback = null
        scanClassId = null
        android.util.Log.i(TAG, "Scan stopped")
      }
      return@Function mapOf("success" to true)
    }

    Function("isScanning") { return@Function isScanning }
    
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
      android.util.Log.d(TAG, "🧹 Cleared discovered students")
      return@Function true
    }

    // ============== STUDENT FUNCTIONS ==============
    
    // ✅ FIXED: Use LocalName (iOS-compatible strategy)
    AsyncFunction("checkIn") { combinedId: String, promise: Promise ->
      android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      android.util.Log.d(TAG, "📢 CHECK-IN (Android - iOS Compatible)")
      android.util.Log.d(TAG, "   Combined ID: '$combinedId'")

      if (combinedId.length > 8) {
         android.util.Log.e(TAG, "❌ ID too long: ${combinedId.length} chars (Limit 8)")
         promise.resolve(mapOf("success" to false, "error" to "ID too long (max 8 chars)"))
         return@AsyncFunction
      }

      bluetoothLeAdvertiser = bluetoothAdapter?.bluetoothLeAdvertiser
      if (bluetoothLeAdvertiser == null) {
          android.util.Log.e(TAG, "❌ No advertiser available")
          promise.resolve(mapOf("success" to false, "error" to "No advertiser available"))
          return@AsyncFunction
      }

      // Setup GATT Server (Required for alert receiving)
      val activity = appContext.activityProvider?.currentActivity
      if (activity != null) setupGattServer(activity)

      // ✅ CRITICAL FIX: Use LocalName instead of Manufacturer Data
      // This matches iOS advertising strategy!
      val advertiseData = AdvertiseData.Builder()
        .addServiceUuid(ParcelUuid.fromString(ATTENDANCE_SERVICE_UUID))
        .setIncludeDeviceName(false) // Don't use real device name
        .setIncludeTxPowerLevel(false)
        .build()

      // ✅ CRITICAL: Put the ID in the SCAN RESPONSE as LocalName
      val scanResponse = AdvertiseData.Builder()
        .setIncludeDeviceName(false)
        .setIncludeTxPowerLevel(false)
        .addManufacturerData(MANUFACTURER_ID, combinedId.toByteArray(Charsets.UTF_8))
        .build()

      val settings = AdvertiseSettings.Builder()
        .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
        .setConnectable(true)
        .setTimeout(0) // No timeout
        .build()

      advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
          android.util.Log.i(TAG, "✅ Advertising Success!")
          android.util.Log.i(TAG, "   Broadcasting: '$combinedId'")
          android.util.Log.i(TAG, "   Service UUID: $ATTENDANCE_SERVICE_UUID")
          android.util.Log.i(TAG, "   Format: iOS-compatible (ManufacturerData in scan response)")
          isAdvertising = true
          currentCombinedId = combinedId
          checkInTimestamp = System.currentTimeMillis()
          promise.resolve(mapOf("success" to true))
        }
        override fun onStartFailure(errorCode: Int) {
          val errorMsg = when(errorCode) {
            ADVERTISE_FAILED_DATA_TOO_LARGE -> "Data too large"
            ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> "Too many advertisers"
            ADVERTISE_FAILED_ALREADY_STARTED -> "Already started"
            ADVERTISE_FAILED_INTERNAL_ERROR -> "Internal error"
            ADVERTISE_FAILED_FEATURE_UNSUPPORTED -> "Feature unsupported"
            else -> "Unknown error: $errorCode"
          }
          android.util.Log.e(TAG, "❌ Advertising Failed: $errorMsg")
          promise.resolve(mapOf("success" to false, "error" to errorMsg))
        }
      }

      try {
        bluetoothLeAdvertiser?.startAdvertising(settings, advertiseData, scanResponse, advertiseCallback)
      } catch (e: Exception) {
        android.util.Log.e(TAG, "❌ Exception starting advertising: ${e.message}")
        promise.resolve(mapOf("success" to false, "error" to e.message))
      }
    }

    Function("checkOut") {
      android.util.Log.d(TAG, "📤 Checking out...")
      if (!isAdvertising) {
        return@Function mapOf("success" to false, "error" to "Not checked in")
      }

      try {
        advertiseCallback?.let { bluetoothLeAdvertiser?.stopAdvertising(it) }
      } catch (e: SecurityException) {}

      stopGattServer()
      isAdvertising = false
      currentCombinedId = null
      checkInTimestamp = null
      advertiseCallback = null
      
      android.util.Log.i(TAG, "✅ Checked out successfully")
      return@Function mapOf("success" to true)
    }
    
    Function("isCheckedIn") { return@Function isAdvertising }
    
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
    
    Function("isAlertRolloutActive") { return@Function isAlertRolloutActive }
    
    Function("markStudentVerified") { studentId: String -> // CHANGED: String parameter
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

  // ============== HELPER FUNCTIONS ==============
  
  private fun processScanResult(result: ScanResult) {
    val scanRecord = result.scanRecord ?: return
    val device = result.device
    val rssi = result.rssi
    
    android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    android.util.Log.d(TAG, "📱 DEVICE DISCOVERED")
    android.util.Log.d(TAG, "   Device: ${device.address}")
    android.util.Log.d(TAG, "   RSSI: $rssi dBm")
    
    var studentLabel: String? = null

    // Strategy 1: Check device name (LocalName)
    scanRecord.deviceName?.let { name ->
      android.util.Log.d(TAG, "   ✓ LocalName: '$name'")
      studentLabel = name
    }

    // Strategy 2: Check manufacturer data
    if (studentLabel == null) {
      scanRecord.getManufacturerSpecificData(MANUFACTURER_ID)?.let { bytes ->
        android.util.Log.d(TAG, "   ✓ Manufacturer data: ${bytes.size} bytes")
        android.util.Log.d(TAG, "     Hex: ${bytes.joinToString(" ") { "%02X".format(it) }}")
        try {
          val decoded = String(bytes, Charsets.UTF_8)
          android.util.Log.d(TAG, "     Decoded: '$decoded'")
          studentLabel = decoded
        } catch (e: Exception) {
          android.util.Log.e(TAG, "     ✗ Decode error: ${e.message}")
        }
      }
    }

    // Strategy 3: Check service data
    if (studentLabel == null) {
      val serviceUuid = ParcelUuid.fromString(ATTENDANCE_SERVICE_UUID)
      scanRecord.getServiceData(serviceUuid)?.let { bytes ->
        android.util.Log.d(TAG, "   ✓ Service data: ${bytes.size} bytes")
        try {
          val decoded = String(bytes, Charsets.UTF_8)
          android.util.Log.d(TAG, "     Decoded: '$decoded'")
          studentLabel = decoded
        } catch (e: Exception) {
          android.util.Log.e(TAG, "     ✗ Decode error: ${e.message}")
        }
      }
    }

    if (studentLabel == null) {
      android.util.Log.w(TAG, "   ⚠️ No student ID found in advertisement")
      android.util.Log.w(TAG, "   Available fields:")
      android.util.Log.w(TAG, "     - DeviceName: ${scanRecord.deviceName}")
      android.util.Log.w(TAG, "     - ServiceUUIDs: ${scanRecord.serviceUuids}")
      android.util.Log.w(TAG, "     - ManufacturerData: ${scanRecord.getManufacturerSpecificData(MANUFACTURER_ID) != null}")
      android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      return
    }

    // Filter by class prefix
    if (scanClassId != null && !studentLabel!!.startsWith(scanClassId!!)) {
      android.util.Log.d(TAG, "   ⏩ Class mismatch: '$studentLabel' doesn't start with '$scanClassId'")
      android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      return
    }

    // Add student
    if (!discoveredStudents.containsKey(studentLabel)) {
      android.util.Log.i(TAG, "   🎉 ✅ NEW STUDENT DISCOVERED!")
      android.util.Log.i(TAG, "      StudentID: $studentLabel")
      android.util.Log.i(TAG, "      Class Prefix: $scanClassId")
      
      val info = StudentInfo(
        studentLabel!!,
        device.address,
        rssi,
        System.currentTimeMillis()
      )
      discoveredStudents[studentLabel!!] = info
      
      sendEvent("onStudentDiscovered", bundleOf(
        "studentId" to studentLabel,
        "deviceAddress" to device.address,
        "rssi" to rssi,
        "classId" to studentLabel
      ))
    } else {
      android.util.Log.d(TAG, "   ℹ️ Already discovered: $studentLabel")
    }
    
    android.util.Log.d(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  }

  private fun setupGattServer(context: Context): Boolean {
    if (bluetoothManager == null) {
      bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    }

    val gattCallback = object : BluetoothGattServerCallback() {
      override fun onConnectionStateChange(device: BluetoothDevice?, status: Int, newState: Int) {
        android.util.Log.d(TAG, "GATT Connection State: $newState")
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
          android.util.Log.i(TAG, "🔔 Alert received: Type $alertType")

          if (responseNeeded) {
            try {
              gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
            } catch (e: SecurityException) {}
          }

          Handler(Looper.getMainLooper()).post {
            sendEvent("onAlertReceived", bundleOf(
              "alertType" to alertType,
              "timestamp" to System.currentTimeMillis()
            ))
          }
        }
      }
    }

    return try {
      gattServer = bluetoothManager?.openGattServer(context, gattCallback)
      
      if (gattServer == null) {
        android.util.Log.e(TAG, "Failed to open GATT server")
        return false
      }

      val service = BluetoothGattService(
        UUID.fromString(ATTENDANCE_SERVICE_UUID),
        BluetoothGattService.SERVICE_TYPE_PRIMARY
      )

      val alertCharacteristic = BluetoothGattCharacteristic(
        UUID.fromString(ALERT_CHARACTERISTIC_UUID),
        BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
        BluetoothGattCharacteristic.PERMISSION_WRITE
      )

      service.addCharacteristic(alertCharacteristic)
      gattServer?.addService(service)
      android.util.Log.d(TAG, "GATT server setup complete")
      true
    } catch (e: SecurityException) {
      android.util.Log.e(TAG, "Security exception in GATT setup: ${e.message}")
      false
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Exception in GATT setup: ${e.message}")
      false
    }
  }

  private fun stopGattServer() {
    try {
      gattServer?.clearServices()
      gattServer?.close()
    } catch (e: SecurityException) {}
    gattServer = null
  }

  private fun hasRequiredPermissions(activity: Activity): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
      ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED &&
      ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
    } else {
      ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }
  }
  
  private fun getRequiredPermissions(activity: Activity): List<String> {
    val permissions = mutableListOf<String>()
    
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
        permissions.add(Manifest.permission.BLUETOOTH_SCAN)
      }
      if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_ADVERTISE) != PackageManager.PERMISSION_GRANTED) {
        permissions.add(Manifest.permission.BLUETOOTH_ADVERTISE)
      }
      if (ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
        permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
      }
    } else {
      if (ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
      }
    }
    
    return permissions
  }

  private fun sendAlertToStudentImpl(deviceAddress: String, alertType: Int, promise: Promise) {
    val device = try {
      bluetoothAdapter?.getRemoteDevice(deviceAddress)
    } catch (e: Exception) {
      promise.resolve(mapOf("success" to false, "error" to "Invalid address"))
      return
    }

    if (device == null) {
      promise.resolve(mapOf("success" to false, "error" to "Device not found"))
      return
    }

    val gattCallback = object : BluetoothGattCallback() {
      override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
        when (newState) {
          BluetoothProfile.STATE_CONNECTED -> {
            try { gatt?.discoverServices() } catch (e: SecurityException) {}
          }
          BluetoothProfile.STATE_DISCONNECTED -> {
            try { gatt?.close() } catch (e: SecurityException) {}
          }
        }
      }

      override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
          promise.resolve(mapOf("success" to false, "error" to "Service discovery failed"))
          try { gatt?.disconnect() } catch (e: SecurityException) {}
          return
        }

        val service = gatt?.getService(UUID.fromString(ATTENDANCE_SERVICE_UUID))
        val characteristic = service?.getCharacteristic(UUID.fromString(ALERT_CHARACTERISTIC_UUID))

        if (characteristic == null) {
          promise.resolve(mapOf("success" to false, "error" to "Characteristic not found"))
          try { gatt?.disconnect() } catch (e: SecurityException) {}
          return
        }

        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            gatt.writeCharacteristic(
              characteristic,
              byteArrayOf(alertType.toByte()),
              BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            )
          } else {
            characteristic.value = byteArrayOf(alertType.toByte())
            characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            gatt.writeCharacteristic(characteristic)
          }
        } catch (e: SecurityException) {
          promise.resolve(mapOf("success" to false, "error" to "Write failed"))
          try { gatt?.disconnect() } catch (e2: SecurityException) {}
        }
      }

      override fun onCharacteristicWrite(
        gatt: BluetoothGatt?,
        characteristic: BluetoothGattCharacteristic?,
        status: Int
      ) {
        if (status == BluetoothGatt.GATT_SUCCESS) {
          promise.resolve(mapOf("success" to true))
        } else {
          promise.resolve(mapOf("success" to false, "error" to "Write failed"))
        }
        
        try {
          gatt?.disconnect()
          gatt?.close()
        } catch (e: SecurityException) {}
      }
    }

    try {
      val activity = appContext.activityProvider?.currentActivity
      device.connectGatt(activity, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    } catch (e: SecurityException) {
      promise.resolve(mapOf("success" to false, "error" to "Connection failed"))
    }
  }

  private fun startAlertRollout(addresses: List<String>, alertType: Int, delayMs: Int, promise: Promise) {
    if (isAlertRolloutActive) {
      promise.resolve(mapOf("success" to false, "error" to "Rollout already active"))
      return
    }

    isAlertRolloutActive = true
    alertRolloutCancelled = false

    Thread {
      var successCount = 0
      var failedCount = 0
      val results = mutableListOf<Map<String, Any>>()

      for ((index, address) in addresses.withIndex()) {
        if (alertRolloutCancelled) break

        Handler(Looper.getMainLooper()).post {
          sendEvent("onAlertProgress", bundleOf(
            "current" to (index + 1),
            "total" to addresses.size,
            "deviceAddress" to address,
            "status" to "connecting"
          ))
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
        } catch (e: Exception) {}

        if (alertSuccess) successCount++ else failedCount++

        results.add(mapOf("deviceAddress" to address, "success" to alertSuccess))

        Handler(Looper.getMainLooper()).post {
          sendEvent("onAlertProgress", bundleOf(
            "current" to (index + 1),
            "total" to addresses.size,
            "deviceAddress" to address,
            "status" to if (alertSuccess) "success" else "failed"
          ))
        }

        if (index < addresses.size - 1 && !alertRolloutCancelled) {
          Thread.sleep(delayMs.toLong())
        }
      }

      isAlertRolloutActive = false

      Handler(Looper.getMainLooper()).post {
        promise.resolve(mapOf(
          "success" to successCount,
          "failed" to failedCount,
          "cancelled" to alertRolloutCancelled,
          "results" to results
        ))
      }
    }.start()
  }

  private fun cleanup() {
    try { scanCallback?.let { bluetoothLeScanner?.stopScan(it) } } catch (e: SecurityException) {}
    isScanning = false
    scanCallback = null

    try { advertiseCallback?.let { bluetoothLeAdvertiser?.stopAdvertising(it) } } catch (e: SecurityException) {}
    isAdvertising = false
    advertiseCallback = null

    stopGattServer()

    try {
      currentGatt?.disconnect()
      currentGatt?.close()
    } catch (e: SecurityException) {}
    currentGatt = null

    val activity = appContext.activityProvider?.currentActivity
    bluetoothStateReceiver?.let {
      try {
        activity?.applicationContext?.unregisterReceiver(it)
      } catch (e: Exception) {}
    }
    bluetoothStateReceiver = null

    discoveredStudents.clear()
    discoveredDeviceAddresses.clear()
  }
}