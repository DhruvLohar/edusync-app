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

  // ============== CONSTANTS ==============
  companion object {
    private const val TAG = "ExpoBleCore"
    private const val PERMISSION_REQUEST_CODE = 1001
    
    // Service & Characteristic UUIDs
    private const val ATTENDANCE_SERVICE_UUID = "0c287abd-eb75-4dd3-afc6-b3f3368307fa"
    private const val ALERT_CHARACTERISTIC_UUID = "0c287abd-eb75-4dd3-afc6-b3f3368307fb"
    
    // Manufacturer ID (0xFFFF = testing/development)
    private const val MANUFACTURER_ID = 0xFFFF
    
    // Alert Types
    const val ALERT_TYPE_BEEP = 0x01
    const val ALERT_TYPE_VIBRATE = 0x02
    const val ALERT_TYPE_BOTH = 0x03
    
    // Timeouts
    private const val CONNECTION_TIMEOUT_MS = 10000L
  }

  // ============== STATE VARIABLES ==============
  
  // Bluetooth core
  private var bluetoothAdapter: BluetoothAdapter? = null
  private var bluetoothLeAdvertiser: BluetoothLeAdvertiser? = null
  private var bluetoothLeScanner: BluetoothLeScanner? = null
  private var gattServer: BluetoothGattServer? = null
  private var bluetoothManager: BluetoothManager? = null
  
  // Advertising state (Student)
  private var isAdvertising = false
  private var currentClassId: String? = null
  private var currentStudentId: Int? = null
  private var checkInTimestamp: Long? = null
  private var advertiseCallback: AdvertiseCallback? = null
  
  // Scanning state (Teacher)
  private var isScanning = false
  private var scanClassId: String? = null
  private var scanCallback: ScanCallback? = null
  
  // Discovered students (Teacher)
  private val discoveredStudents = mutableMapOf<Int, StudentInfo>()
  private val discoveredDeviceAddresses = mutableSetOf<String>()
  
  // Alert rollout state (Teacher)
  private var isAlertRolloutActive = false
  private var alertRolloutCancelled = false
  private var alertHandler: Handler? = null
  
  // GATT connection state
  private var currentGatt: BluetoothGatt? = null
  private var gattConnectionPromise: Promise? = null
  private var connectionTimeoutRunnable: Runnable? = null
  
  // Bluetooth state receiver
  private var bluetoothStateReceiver: BroadcastReceiver? = null

  // ============== DATA CLASSES ==============
  
  data class StudentInfo(
    val studentId: Int,
    val deviceAddress: String,
    val rssi: Int,
    val discoveredAt: Long,
    var verified: Boolean = false,
    var verifiedAt: Long? = null
  )

  // ============== MODULE DEFINITION ==============

  override fun definition() = ModuleDefinition {
    Name("ExpoBleCore")

    // Initialize bluetooth manager
    OnCreate {
      android.util.Log.d(TAG, "Initializing Module...")
      val activity = appContext.activityProvider?.currentActivity
      activity?.let {
        bluetoothManager = it.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter
        alertHandler = Handler(Looper.getMainLooper())
        android.util.Log.d(TAG, "Bluetooth Adapter initialized: ${bluetoothAdapter != null}")
      }
    }

    // Cleanup on destroy
    OnDestroy {
      android.util.Log.d(TAG, "Destroying Module & Cleaning up")
      cleanup()
    }

    // ============== EVENTS ==============
    
    Events(
      "onStudentDiscovered",
      "onAlertProgress",
      "onAlertReceived",
      "onBluetoothStateChanged"
    )

    // ============== CORE FUNCTIONS ==============

    Function("hasPermissions") {
      val activity = appContext.activityProvider?.currentActivity ?: return@Function false
      return@Function hasRequiredPermissions(activity)
    }

    AsyncFunction("requestPermissions") { promise: Promise ->
      android.util.Log.d(TAG, "requestPermissions called")
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }

      // Check if we already have all permissions
      if (hasRequiredPermissions(activity)) {
        android.util.Log.d(TAG, "Permissions already granted")
        promise.resolve(true)
        return@AsyncFunction
      }

      // Get required permissions based on API level
      val permissionsToRequest = getRequiredPermissions(activity)
      android.util.Log.d(TAG, "Requesting permissions: $permissionsToRequest")
      
      if (permissionsToRequest.isEmpty()) {
        promise.resolve(true)
        return@AsyncFunction
      }

      // Request permissions using ActivityCompat directly
      try {
        ActivityCompat.requestPermissions(
          activity,
          permissionsToRequest.toTypedArray(),
          PERMISSION_REQUEST_CODE
        )
        
        Handler(Looper.getMainLooper()).postDelayed({
          val granted = hasRequiredPermissions(activity)
          android.util.Log.d(TAG, "Permissions result after delay: $granted")
          promise.resolve(granted)
        }, 1000)
      } catch (e: Exception) {
        android.util.Log.e(TAG, "Permission request failed", e)
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
      val supported = bluetoothAdapter?.isMultipleAdvertisementSupported == true
      android.util.Log.d(TAG, "isBleAdvertisingSupported: $supported")
      return@Function supported
    }

    Function("startBluetoothStateListener") {
      val activity = appContext.activityProvider?.currentActivity
      val context = activity?.applicationContext ?: return@Function false

      if (bluetoothStateReceiver != null) {
        return@Function true // Already listening
      }

      bluetoothStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          if (intent?.action == BluetoothAdapter.ACTION_STATE_CHANGED) {
            val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
            val enabled = state == BluetoothAdapter.STATE_ON
            android.util.Log.d(TAG, "Bluetooth State Changed: $enabled")
            sendEvent("onBluetoothStateChanged", bundleOf("enabled" to enabled))
          }
        }
      }

      val filter = IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)
      context.registerReceiver(bluetoothStateReceiver, filter)
      return@Function true
    }

    Function("stopBluetoothStateListener") {
      val activity = appContext.activityProvider?.currentActivity
      val context = activity?.applicationContext ?: return@Function false

      bluetoothStateReceiver?.let {
        try {
          context.unregisterReceiver(it)
        } catch (e: Exception) {
          // Already unregistered
        }
        bluetoothStateReceiver = null
      }
      return@Function true
    }

    // ============== TEACHER FUNCTIONS (BleBeacon) ==============

    AsyncFunction("startStudentScan") { classId: String, promise: Promise ->
      android.util.Log.d(TAG, "startStudentScan called for Class: $classId")
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.resolve(mapOf("success" to false, "error" to "No activity"))
        return@AsyncFunction
      }

      if (!hasRequiredPermissions(activity)) {
        android.util.Log.e(TAG, "Scan failed: Missing permissions")
        promise.resolve(mapOf("success" to false, "error" to "Missing permissions"))
        return@AsyncFunction
      }

      if (bluetoothAdapter?.isEnabled != true) {
        android.util.Log.e(TAG, "Scan failed: Bluetooth off")
        promise.resolve(mapOf("success" to false, "error" to "Bluetooth not enabled"))
        return@AsyncFunction
      }

      if (isScanning) {
        android.util.Log.w(TAG, "Already scanning")
        promise.resolve(mapOf("success" to false, "error" to "Already scanning"))
        return@AsyncFunction
      }

      bluetoothLeScanner = bluetoothAdapter?.bluetoothLeScanner
      if (bluetoothLeScanner == null) {
        android.util.Log.e(TAG, "Scanner is null")
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
          android.util.Log.e(TAG, "Scan Failed with error code: $errorCode")
          isScanning = false
          sendEvent("onStudentDiscovered", mapOf(
            "error" to true,
            "errorCode" to errorCode
          ))
        }
      }

      val scanSettings = ScanSettings.Builder()
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        .setReportDelay(0)
        .build()

      try {
        bluetoothLeScanner?.startScan(null, scanSettings, scanCallback)
        isScanning = true
        android.util.Log.i(TAG, "Scanning started successfully")
        promise.resolve(mapOf("success" to true))
      } catch (e: SecurityException) {
        android.util.Log.e(TAG, "SecurityException in startScan", e)
        promise.resolve(mapOf("success" to false, "error" to "Security exception: ${e.message}"))
      } catch (e: Exception) {
        android.util.Log.e(TAG, "Exception in startScan", e)
        promise.resolve(mapOf("success" to false, "error" to e.message))
      }
    }

    Function("stopStudentScan") {
      android.util.Log.d(TAG, "stopStudentScan called")
      if (!isScanning || scanCallback == null) {
        return@Function mapOf("success" to false, "error" to "Not scanning")
      }

      try {
        bluetoothLeScanner?.stopScan(scanCallback)
      } catch (e: SecurityException) {
        // Ignore - might not have permission
      }
      
      isScanning = false
      scanCallback = null
      scanClassId = null
      android.util.Log.i(TAG, "Scanning stopped")
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
      return@Function true
    }

    AsyncFunction("sendAlertToStudent") { deviceAddress: String, alertType: Int, promise: Promise ->
      android.util.Log.d(TAG, "sendAlertToStudent: $deviceAddress")
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.resolve(mapOf("success" to false, "error" to "No activity"))
        return@AsyncFunction
      }

      val device = try {
        bluetoothAdapter?.getRemoteDevice(deviceAddress)
      } catch (e: Exception) {
        promise.resolve(mapOf("success" to false, "error" to "Invalid device address"))
        return@AsyncFunction
      }

      if (device == null) {
        promise.resolve(mapOf("success" to false, "error" to "Device not found"))
        return@AsyncFunction
      }

      gattConnectionPromise = promise

      // Set connection timeout
      connectionTimeoutRunnable = Runnable {
        android.util.Log.w(TAG, "Connection timeout for $deviceAddress")
        currentGatt?.let {
          try {
            it.disconnect()
            it.close()
          } catch (e: SecurityException) {}
        }
        currentGatt = null
        gattConnectionPromise?.resolve(mapOf("success" to false, "error" to "Connection timeout"))
        gattConnectionPromise = null
      }
      alertHandler?.postDelayed(connectionTimeoutRunnable!!, CONNECTION_TIMEOUT_MS)

      val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
          android.util.Log.d(TAG, "GATT State Change: Status=$status, NewState=$newState")
          when (newState) {
            BluetoothProfile.STATE_CONNECTED -> {
              try {
                gatt?.discoverServices()
              } catch (e: SecurityException) {
                handleGattError("Security exception during service discovery")
              }
            }
            BluetoothProfile.STATE_DISCONNECTED -> {
              cleanupGattConnection()
            }
          }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
          android.util.Log.d(TAG, "Services Discovered: Status=$status")
          if (status != BluetoothGatt.GATT_SUCCESS) {
            handleGattError("Service discovery failed")
            return
          }

          val service = gatt?.getService(UUID.fromString(ATTENDANCE_SERVICE_UUID))
          if (service == null) {
            handleGattError("Attendance service not found")
            return
          }

          val characteristic = service.getCharacteristic(UUID.fromString(ALERT_CHARACTERISTIC_UUID))
          if (characteristic == null) {
            handleGattError("Alert characteristic not found")
            return
          }

          try {
            android.util.Log.d(TAG, "Writing Alert Type: $alertType")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
              gatt.writeCharacteristic(characteristic, byteArrayOf(alertType.toByte()), BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT)
            } else {
              characteristic.value = byteArrayOf(alertType.toByte())
              characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
              gatt.writeCharacteristic(characteristic)
            }
          } catch (e: SecurityException) {
            handleGattError("Security exception during write")
          }
        }

        override fun onCharacteristicWrite(
          gatt: BluetoothGatt?,
          characteristic: BluetoothGattCharacteristic?,
          status: Int
        ) {
          android.util.Log.d(TAG, "Characteristic Write: Status=$status")
          connectionTimeoutRunnable?.let { alertHandler?.removeCallbacks(it) }
          
          if (status == BluetoothGatt.GATT_SUCCESS) {
            discoveredStudents.values.find { it.deviceAddress == deviceAddress }?.let {
              it.verified = true
              it.verifiedAt = System.currentTimeMillis()
            }
            gattConnectionPromise?.resolve(mapOf("success" to true))
          } else {
            gattConnectionPromise?.resolve(mapOf("success" to false, "error" to "Write failed with status $status"))
          }
          
          gattConnectionPromise = null
          
          try {
            gatt?.disconnect()
            gatt?.close()
          } catch (e: SecurityException) {}
          currentGatt = null
        }

        private fun handleGattError(error: String) {
          android.util.Log.e(TAG, "GATT Error: $error")
          connectionTimeoutRunnable?.let { alertHandler?.removeCallbacks(it) }
          gattConnectionPromise?.resolve(mapOf("success" to false, "error" to error))
          gattConnectionPromise = null
          try {
            currentGatt?.disconnect()
            currentGatt?.close()
          } catch (e: SecurityException) {}
          currentGatt = null
        }

        private fun cleanupGattConnection() {
          try {
            currentGatt?.close()
          } catch (e: SecurityException) {}
          currentGatt = null
        }
      }

      try {
        currentGatt = device.connectGatt(activity, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
      } catch (e: SecurityException) {
        connectionTimeoutRunnable?.let { alertHandler?.removeCallbacks(it) }
        promise.resolve(mapOf("success" to false, "error" to "Security exception: ${e.message}"))
        gattConnectionPromise = null
      }
    }

    AsyncFunction("sendAlertToAll") { studentAddresses: List<String>, alertType: Int, delayMs: Int, promise: Promise ->
      android.util.Log.d(TAG, "sendAlertToAll: ${studentAddresses.size} students")
      if (isAlertRolloutActive) {
        promise.resolve(mapOf("success" to false, "error" to "Alert rollout already in progress"))
        return@AsyncFunction
      }

      isAlertRolloutActive = true
      alertRolloutCancelled = false

      val results = mutableListOf<Map<String, Any>>()
      var successCount = 0
      var failedCount = 0
      val total = studentAddresses.size

      Thread {
        for ((index, address) in studentAddresses.withIndex()) {
          if (alertRolloutCancelled) {
            android.util.Log.d(TAG, "Alert Rollout Cancelled")
            break
          }

          // Send progress event
          Handler(Looper.getMainLooper()).post {
            sendEvent("onAlertProgress", bundleOf(
              "current" to (index + 1),
              "total" to total,
              "deviceAddress" to address,
              "status" to "connecting"
            ))
          }

          // Synchronous alert send using a latch
          val latch = java.util.concurrent.CountDownLatch(1)
          var alertSuccess = false
          var alertError: String? = null

          Handler(Looper.getMainLooper()).post {
            sendAlertToStudentSync(address, alertType) { success, error ->
              alertSuccess = success
              alertError = error
              latch.countDown()
            }
          }

          try {
            latch.await(CONNECTION_TIMEOUT_MS + 2000, java.util.concurrent.TimeUnit.MILLISECONDS)
          } catch (e: Exception) {
            alertError = "Timeout"
          }

          if (alertSuccess) successCount++ else failedCount++

          results.add(mapOf(
            "deviceAddress" to address,
            "success" to alertSuccess,
            "error" to (alertError ?: "")
          ))

          // Send progress update
          Handler(Looper.getMainLooper()).post {
            sendEvent("onAlertProgress", bundleOf(
              "current" to (index + 1),
              "total" to total,
              "deviceAddress" to address,
              "status" to if (alertSuccess) "success" else "failed"
            ))
          }

          // Delay between students
          if (index < studentAddresses.size - 1 && !alertRolloutCancelled) {
            Thread.sleep(delayMs.toLong())
          }
        }

        isAlertRolloutActive = false
        android.util.Log.i(TAG, "Alert Rollout Finished. Success: $successCount, Failed: $failedCount")

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

    Function("cancelAlertRollout") {
      if (!isAlertRolloutActive) {
        return@Function mapOf("success" to false, "error" to "No rollout in progress")
      }
      alertRolloutCancelled = true
      return@Function mapOf("success" to true)
    }

    Function("isAlertRolloutActive") {
      return@Function isAlertRolloutActive
    }

    Function("markStudentVerified") { studentId: Int ->
      discoveredStudents[studentId]?.let {
        it.verified = true
        it.verifiedAt = System.currentTimeMillis()
        return@Function true
      }
      return@Function false
    }

    Function("getAttendanceReport") {
      return@Function discoveredStudents.values.map { student ->
        val status = when {
          student.verified -> "present"
          else -> "unverified"
        }
        mapOf(
          "studentId" to student.studentId,
          "deviceAddress" to student.deviceAddress,
          "status" to status,
          "discoveredAt" to student.discoveredAt,
          "verifiedAt" to student.verifiedAt
        )
      }
    }

    // ============== STUDENT FUNCTIONS (BleAttendee) ==============

    AsyncFunction("checkIn") { classId: String, studentId: Int, promise: Promise ->
      android.util.Log.d("ExpoBleCore", "➡️ checkIn called: classId='$classId', studentId=$studentId")

      val activity = appContext.activityProvider?.currentActivity
      if (activity == null || !hasRequiredPermissions(activity) || bluetoothAdapter?.isEnabled != true) {
        promise.resolve(mapOf("success" to false, "error" to "Setup failed"))
        return@AsyncFunction
      }

      if (isAdvertising) {
        promise.resolve(mapOf("success" to false, "error" to "Already checked in"))
        return@AsyncFunction
      }

      bluetoothLeAdvertiser = bluetoothAdapter?.bluetoothLeAdvertiser
      if (bluetoothLeAdvertiser == null) {
        promise.resolve(mapOf("success" to false, "error" to "Advertising not supported"))
        return@AsyncFunction
      }

      // Setup GATT Server
      if (!setupGattServer(activity)) {
        promise.resolve(mapOf("success" to false, "error" to "GATT Server failed"))
        return@AsyncFunction
      }

      // ============================================================
      // NEW STRATEGY: Service UUID in Main Packet, Data in Response
      // ============================================================
      
      // 1. Prepare Payload (Data)
      val classIdBytes = classId.toByteArray(Charsets.UTF_8)
      val studentIdBytes = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(studentId).array()
      val payload = classIdBytes + "_".toByteArray() + studentIdBytes
      
      android.util.Log.d("ExpoBleCore", "📦 Payload: ${payload.size} bytes (${classId}_$studentId)")

      // 2. Main Packet (The "Announcement")
      // We put the Service UUID here so iOS sees it immediately.
      val serviceUUID = ParcelUuid.fromString(ATTENDANCE_SERVICE_UUID)
      val advertiseData = AdvertiseData.Builder()
        .addServiceUuid(serviceUUID) 
        .setIncludeDeviceName(false)
        .setIncludeTxPowerLevel(true) // Helps iOS calculate distance
        .build()

      // 3. Scan Response (The "Details")
      // We put the Manufacturer Data here. iOS will request this automatically.
      val scanResponse = AdvertiseData.Builder()
        .addManufacturerData(MANUFACTURER_ID, payload)
        .build()

      val settings = AdvertiseSettings.Builder()
        .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
        .setConnectable(true)
        .setTimeout(0)
        .build()

      advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
          android.util.Log.i("ExpoBleCore", "✅ Advertising Started! (UUID in Main, Data in Resp)")
          isAdvertising = true
          currentClassId = classId
          currentStudentId = studentId
          checkInTimestamp = System.currentTimeMillis()
          promise.resolve(mapOf("success" to true))
        }

        override fun onStartFailure(errorCode: Int) {
          android.util.Log.e("ExpoBleCore", "❌ Advertising Failed: $errorCode")
          stopGattServer()
          promise.resolve(mapOf("success" to false, "error" to "Start failure: $errorCode"))
        }
      }

      try {
        bluetoothLeAdvertiser?.startAdvertising(settings, advertiseData, scanResponse, advertiseCallback)
      } catch (e: Exception) {
        android.util.Log.e("ExpoBleCore", "❌ Exception: ${e.message}")
        stopGattServer()
        promise.resolve(mapOf("success" to false, "error" to e.message))
      }
    }

    Function("checkOut") {
      android.util.Log.d(TAG, "checkOut called")
      if (!isAdvertising) {
        return@Function mapOf("success" to false, "error" to "Not checked in")
      }

      try {
        advertiseCallback?.let {
          bluetoothLeAdvertiser?.stopAdvertising(it)
        }
      } catch (e: SecurityException) {
        // Ignore
      }

      stopGattServer()

      isAdvertising = false
      currentClassId = null
      currentStudentId = null
      checkInTimestamp = null
      advertiseCallback = null
      android.util.Log.i(TAG, "Checked out successfully")
      return@Function mapOf("success" to true)
    }

    Function("isCheckedIn") {
      return@Function isAdvertising
    }

    Function("getCheckInStatus") {
      if (!isAdvertising) {
        return@Function null
      }
      return@Function mapOf(
        "classId" to currentClassId,
        "studentId" to currentStudentId,
        "checkedInAt" to checkInTimestamp
      )
    }
  }

  // ============== HELPER FUNCTIONS ==============

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

  private fun processScanResult(result: ScanResult) {
    val scanRecord = result.scanRecord ?: return
    val device = result.device
    val rssi = result.rssi
    
    // DEBUG: Uncomment if you want to see EVERY raw BLE packet (very noisy)
    // android.util.Log.v(TAG, "Raw Packet: ${device.address}")

    var foundClassId: String? = null
    var foundStudentId: Int? = null

    // =========================================================
    // 1. Try Manufacturer Data (Android Student Format)
    // =========================================================
    scanRecord.getManufacturerSpecificData(MANUFACTURER_ID)?.let { bytes ->
       // FIX: Do NOT convert the whole thing to String. 
       // Find the separator byte (0x5F is '_')
       val separatorIndex = bytes.indexOf(0x5F.toByte())
       
       if (separatorIndex != -1) {
           try {
               // A. Decode Class ID (Bytes BEFORE separator)
               val classIdBytes = bytes.copyOfRange(0, separatorIndex)
               foundClassId = String(classIdBytes, Charsets.UTF_8)
               
               // B. Decode Student ID (Bytes AFTER separator)
               val startOfInt = separatorIndex + 1
               // We need at least 4 bytes for the Int
               if (bytes.size >= startOfInt + 4) {
                   val studentIdBytes = bytes.copyOfRange(startOfInt, startOfInt + 4)
                   foundStudentId = ByteBuffer.wrap(studentIdBytes).order(ByteOrder.LITTLE_ENDIAN).int
               }
               
               android.util.Log.d(TAG, "⚡ Parsed Manuf Packet: '$foundClassId', ID: $foundStudentId")
           } catch (e: Exception) {
               android.util.Log.e(TAG, "⚠️ Parse Error: ${e.message}")
           }
       }
    }

    // =========================================================
    // 2. Try Local Name (iOS Student Format)
    // =========================================================
    if (foundClassId == null) {
       scanRecord.deviceName?.let { name ->
          val parts = name.split("_")
          if (parts.size >= 2) {
             foundClassId = parts[0]
             foundStudentId = parts[1].toIntOrNull()
             // android.util.Log.d(TAG, "⚡ Parsed Name Packet: '$foundClassId', ID: $foundStudentId")
          }
       }
    }

    // =========================================================
    // 3. Validation & Reporting
    // =========================================================
    if (foundClassId != null && foundStudentId != null) {
       // Log if we found a class, even if it's the wrong one (Helps debugging)
       if (scanClassId != null && foundClassId != scanClassId) {
           // android.util.Log.d(TAG, "Ignored: Class '$foundClassId' != '$scanClassId'")
           return
       }
       
       // Don't spam duplicate events
       if (discoveredStudents.containsKey(foundStudentId)) {
           return
       }
       
       android.util.Log.i(TAG, "✅ MATCH FOUND! Class: $foundClassId, Student: $foundStudentId")

       val info = StudentInfo(foundStudentId!!, device.address, rssi, System.currentTimeMillis())
       discoveredStudents[foundStudentId!!] = info
       
       sendEvent("onStudentDiscovered", bundleOf(
         "studentId" to foundStudentId, 
         "deviceAddress" to device.address, 
         "rssi" to rssi, 
         "classId" to foundClassId
       ))
    }
  }

  private fun setupGattServer(context: Context): Boolean {
    android.util.Log.d(TAG, "setupGattServer called")
    if (bluetoothManager == null) {
      bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    }

    val gattCallback = object : BluetoothGattServerCallback() {
      override fun onConnectionStateChange(device: BluetoothDevice?, status: Int, newState: Int) {
        super.onConnectionStateChange(device, status, newState)
        android.util.Log.d(TAG, "GATT Server Connection Change: State=$newState")
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
        super.onCharacteristicWriteRequest(device, requestId, characteristic, preparedWrite, responseNeeded, offset, value)
        android.util.Log.d(TAG, "GATT Server Write Request")

        if (characteristic?.uuid == UUID.fromString(ALERT_CHARACTERISTIC_UUID)) {
          val alertType = value?.firstOrNull()?.toInt() ?: 0
          android.util.Log.i(TAG, "Received Alert Type: $alertType")

          // Send response if needed
          if (responseNeeded) {
            try {
              gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
            } catch (e: SecurityException) {
              // Ignore
            }
          }

          // Emit alert received event
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
        android.util.Log.e(TAG, "Failed to open GATT Server")
        return false
      }

      // Create service
      val service = BluetoothGattService(
        UUID.fromString(ATTENDANCE_SERVICE_UUID),
        BluetoothGattService.SERVICE_TYPE_PRIMARY
      )

      // Create alert characteristic (writable)
      val alertCharacteristic = BluetoothGattCharacteristic(
        UUID.fromString(ALERT_CHARACTERISTIC_UUID),
        BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
        BluetoothGattCharacteristic.PERMISSION_WRITE
      )

      service.addCharacteristic(alertCharacteristic)
      gattServer?.addService(service)
      android.util.Log.d(TAG, "GATT Server setup complete")
      true
    } catch (e: SecurityException) {
      android.util.Log.e(TAG, "SecurityException in setupGattServer", e)
      false
    } catch (e: Exception) {
      android.util.Log.e(TAG, "Exception in setupGattServer", e)
      false
    }
  }

  private fun stopGattServer() {
    android.util.Log.d(TAG, "stopGattServer called")
    try {
      gattServer?.clearServices()
      gattServer?.close()
    } catch (e: SecurityException) {
      // Ignore
    }
    gattServer = null
  }

  private fun sendAlertToStudentSync(deviceAddress: String, alertType: Int, callback: (Boolean, String?) -> Unit) {
    android.util.Log.d(TAG, "Connecting Sync to $deviceAddress")
    val activity = appContext.activityProvider?.currentActivity
    if (activity == null) {
      callback(false, "No activity")
      return
    }

    val device = try {
      bluetoothAdapter?.getRemoteDevice(deviceAddress)
    } catch (e: Exception) {
      callback(false, "Invalid device address")
      return
    }

    if (device == null) {
      callback(false, "Device not found")
      return
    }

    var callbackCalled = false

    val timeoutRunnable = Runnable {
      if (!callbackCalled) {
        callbackCalled = true
        android.util.Log.w(TAG, "Sync Connection Timeout")
        callback(false, "Connection timeout")
      }
    }
    alertHandler?.postDelayed(timeoutRunnable, CONNECTION_TIMEOUT_MS)

    val gattCallback = object : BluetoothGattCallback() {
      private var gatt: BluetoothGatt? = null

      override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
        this.gatt = gatt
        android.util.Log.d(TAG, "Sync Connect Change: $newState")
        when (newState) {
          BluetoothProfile.STATE_CONNECTED -> {
            try {
              gatt?.discoverServices()
            } catch (e: SecurityException) {
              finishWithError("Security exception")
            }
          }
          BluetoothProfile.STATE_DISCONNECTED -> {
            closeGatt()
          }
        }
      }

      override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
          finishWithError("Service discovery failed")
          return
        }

        val service = gatt?.getService(UUID.fromString(ATTENDANCE_SERVICE_UUID))
        val characteristic = service?.getCharacteristic(UUID.fromString(ALERT_CHARACTERISTIC_UUID))

        if (characteristic == null) {
          finishWithError("Characteristic not found")
          return
        }

        try {
          android.util.Log.d(TAG, "Sync writing value: $alertType")
          characteristic.value = byteArrayOf(alertType.toByte())
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            gatt.writeCharacteristic(characteristic, byteArrayOf(alertType.toByte()), BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT)
          } else {
            characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            gatt.writeCharacteristic(characteristic)
          }
        } catch (e: SecurityException) {
          finishWithError("Write security exception")
        }
      }

      override fun onCharacteristicWrite(
        gatt: BluetoothGatt?,
        characteristic: BluetoothGattCharacteristic?,
        status: Int
      ) {
        alertHandler?.removeCallbacks(timeoutRunnable)
        
        if (!callbackCalled) {
          callbackCalled = true
          if (status == BluetoothGatt.GATT_SUCCESS) {
            android.util.Log.i(TAG, "Sync Write Success!")
            // Mark as verified
            discoveredStudents.values.find { it.deviceAddress == deviceAddress }?.let {
              it.verified = true
              it.verifiedAt = System.currentTimeMillis()
            }
            callback(true, null)
          } else {
            callback(false, "Write failed: $status")
          }
        }
        
        closeGatt()
      }

      private fun finishWithError(error: String) {
        android.util.Log.e(TAG, "Sync Error: $error")
        alertHandler?.removeCallbacks(timeoutRunnable)
        if (!callbackCalled) {
          callbackCalled = true
          callback(false, error)
        }
        closeGatt()
      }

      private fun closeGatt() {
        try {
          gatt?.disconnect()
          gatt?.close()
        } catch (e: SecurityException) {
          // Ignore
        }
      }
    }

    try {
      device.connectGatt(activity, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    } catch (e: SecurityException) {
      alertHandler?.removeCallbacks(timeoutRunnable)
      callback(false, "Connect security exception")
    }
  }

  private fun cleanup() {
    // Stop scanning
    try {
      scanCallback?.let { bluetoothLeScanner?.stopScan(it) }
    } catch (e: SecurityException) {
      // Ignore
    }
    isScanning = false
    scanCallback = null

    // Stop advertising
    try {
      advertiseCallback?.let { bluetoothLeAdvertiser?.stopAdvertising(it) }
    } catch (e: SecurityException) {
      // Ignore
    }
    isAdvertising = false
    advertiseCallback = null

    // Stop GATT server
    stopGattServer()

    // Close current GATT connection
    try {
      currentGatt?.disconnect()
      currentGatt?.close()
    } catch (e: SecurityException) {
      // Ignore
    }
    currentGatt = null

    // Unregister Bluetooth state receiver
    val activity = appContext.activityProvider?.currentActivity
    bluetoothStateReceiver?.let {
      try {
        activity?.applicationContext?.unregisterReceiver(it)
      } catch (e: Exception) {
        // Ignore
      }
    }
    bluetoothStateReceiver = null

    // Clear data
    discoveredStudents.clear()
    discoveredDeviceAddresses.clear()
  }
}