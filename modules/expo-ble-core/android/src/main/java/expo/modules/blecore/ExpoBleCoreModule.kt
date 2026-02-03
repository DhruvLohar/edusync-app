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
    private const val DEFAULT_ALERT_DELAY_MS = 2000L
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
      val activity = appContext.activityProvider?.currentActivity
      activity?.let {
        bluetoothManager = it.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter
        alertHandler = Handler(Looper.getMainLooper())
      }
    }

    // Cleanup on destroy
    OnDestroy {
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
      val activity = appContext.activityProvider?.currentActivity
        ?: return@Function false
      return@Function hasRequiredPermissions(activity)
    }

    AsyncFunction("requestPermissions") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }

      // Check if we already have all permissions
      if (hasRequiredPermissions(activity)) {
        promise.resolve(true)
        return@AsyncFunction
      }

      // Get required permissions based on API level
      val permissionsToRequest = getRequiredPermissions(activity)
      
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
        
        // For Expo modules, handle permission result in JS side
        // Or wait and check again after a delay
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
        // Note: In production, you'd want to handle the activity result
        // For now, we resolve after a delay to check status
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

      if (bluetoothStateReceiver != null) {
        return@Function true // Already listening
      }

      bluetoothStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          if (intent?.action == BluetoothAdapter.ACTION_STATE_CHANGED) {
            val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
            val enabled = state == BluetoothAdapter.STATE_ON
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
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.resolve(mapOf("success" to false, "error" to "No activity"))
        return@AsyncFunction
      }

      if (!hasRequiredPermissions(activity)) {
        promise.resolve(mapOf("success" to false, "error" to "Missing permissions"))
        return@AsyncFunction
      }

      if (bluetoothAdapter?.isEnabled != true) {
        promise.resolve(mapOf("success" to false, "error" to "Bluetooth not enabled"))
        return@AsyncFunction
      }

      if (isScanning) {
        promise.resolve(mapOf("success" to false, "error" to "Already scanning"))
        return@AsyncFunction
      }

      bluetoothLeScanner = bluetoothAdapter?.bluetoothLeScanner
      if (bluetoothLeScanner == null) {
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
        promise.resolve(mapOf("success" to true))
      } catch (e: SecurityException) {
        promise.resolve(mapOf("success" to false, "error" to "Security exception: ${e.message}"))
      } catch (e: Exception) {
        promise.resolve(mapOf("success" to false, "error" to e.message))
      }
    }

    Function("stopStudentScan") {
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
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.resolve(mapOf("success" to false, "error" to "No activity"))
        return@AsyncFunction
      }

      if (bluetoothAdapter?.isEnabled != true) {
        promise.resolve(mapOf("success" to false, "error" to "Bluetooth not enabled"))
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
        currentGatt?.let {
          try {
            it.disconnect()
            it.close()
          } catch (e: SecurityException) {
            // Ignore
          }
        }
        currentGatt = null
        gattConnectionPromise?.resolve(mapOf("success" to false, "error" to "Connection timeout"))
        gattConnectionPromise = null
      }
      alertHandler?.postDelayed(connectionTimeoutRunnable!!, CONNECTION_TIMEOUT_MS)

      val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
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
            characteristic.value = byteArrayOf(alertType.toByte())
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
              gatt.writeCharacteristic(characteristic, byteArrayOf(alertType.toByte()), BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT)
            } else {
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
          connectionTimeoutRunnable?.let { alertHandler?.removeCallbacks(it) }
          
          if (status == BluetoothGatt.GATT_SUCCESS) {
            // Mark student as verified
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
          } catch (e: SecurityException) {
            // Ignore
          }
          currentGatt = null
        }

        private fun handleGattError(error: String) {
          connectionTimeoutRunnable?.let { alertHandler?.removeCallbacks(it) }
          gattConnectionPromise?.resolve(mapOf("success" to false, "error" to error))
          gattConnectionPromise = null
          try {
            currentGatt?.disconnect()
            currentGatt?.close()
          } catch (e: SecurityException) {
            // Ignore
          }
          currentGatt = null
        }

        private fun cleanupGattConnection() {
          try {
            currentGatt?.close()
          } catch (e: SecurityException) {
            // Ignore
          }
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

          if (alertSuccess) {
            successCount++
          } else {
            failedCount++
          }

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
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.resolve(mapOf("success" to false, "error" to "No activity"))
        return@AsyncFunction
      }

      if (!hasRequiredPermissions(activity)) {
        promise.resolve(mapOf("success" to false, "error" to "Missing permissions"))
        return@AsyncFunction
      }

      if (bluetoothAdapter?.isEnabled != true) {
        promise.resolve(mapOf("success" to false, "error" to "Bluetooth not enabled"))
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

      // Setup GATT server first
      val gattServerSetup = setupGattServer(activity)
      if (!gattServerSetup) {
        promise.resolve(mapOf("success" to false, "error" to "Failed to setup GATT server"))
        return@AsyncFunction
      }

      // Build manufacturer data: [classId bytes (up to 10)] + [studentId 4 bytes]
      val classIdBytes = classId.toByteArray(Charsets.UTF_8).take(10).toByteArray()
      val studentIdBytes = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(studentId).array()
      val manufacturerData = classIdBytes + "_".toByteArray() + studentIdBytes

      val settings = AdvertiseSettings.Builder()
        .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
        .setConnectable(true)
        .setTimeout(0) // Advertise indefinitely
        .build()

      val serviceUUID = ParcelUuid.fromString(ATTENDANCE_SERVICE_UUID)
      val data = AdvertiseData.Builder()
        .addServiceUuid(serviceUUID)
        .addManufacturerData(MANUFACTURER_ID, manufacturerData)
        .setIncludeDeviceName(false)
        .build()

      advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
          super.onStartSuccess(settingsInEffect)
          isAdvertising = true
          currentClassId = classId
          currentStudentId = studentId
          checkInTimestamp = System.currentTimeMillis()
          promise.resolve(mapOf("success" to true))
        }

        override fun onStartFailure(errorCode: Int) {
          super.onStartFailure(errorCode)
          val errorMsg = when (errorCode) {
            ADVERTISE_FAILED_DATA_TOO_LARGE -> "Data too large"
            ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> "Too many advertisers"
            ADVERTISE_FAILED_ALREADY_STARTED -> "Already started"
            ADVERTISE_FAILED_INTERNAL_ERROR -> "Internal error"
            ADVERTISE_FAILED_FEATURE_UNSUPPORTED -> "Feature unsupported"
            else -> "Unknown error: $errorCode"
          }
          stopGattServer()
          promise.resolve(mapOf("success" to false, "error" to errorMsg))
        }
      }

      try {
        bluetoothLeAdvertiser?.startAdvertising(settings, data, advertiseCallback)
      } catch (e: SecurityException) {
        stopGattServer()
        promise.resolve(mapOf("success" to false, "error" to "Security exception: ${e.message}"))
      }
    }

    Function("checkOut") {
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
    val manufacturerData = scanRecord.getManufacturerSpecificData(MANUFACTURER_ID) ?: return

    // Parse manufacturer data: [classId]_[studentId]
    val dataString = String(manufacturerData, Charsets.UTF_8)
    val parts = dataString.split("_")
    
    if (parts.size < 2) return
    
    val scannedClassId = parts[0]
    
    // Filter by class ID
    if (scanClassId != null && scannedClassId != scanClassId) return
    
    // Extract student ID from remaining bytes
    val studentIdBytes = manufacturerData.takeLast(4).toByteArray()
    val studentId = ByteBuffer.wrap(studentIdBytes).order(ByteOrder.LITTLE_ENDIAN).int
    
    val deviceAddress = result.device.address

    // De-duplicate
    if (discoveredStudents.containsKey(studentId)) {
      return
    }

    val studentInfo = StudentInfo(
      studentId = studentId,
      deviceAddress = deviceAddress,
      rssi = result.rssi,
      discoveredAt = System.currentTimeMillis()
    )

    discoveredStudents[studentId] = studentInfo
    discoveredDeviceAddresses.add(deviceAddress)

    // Emit event
    sendEvent("onStudentDiscovered", bundleOf(
      "studentId" to studentId,
      "deviceAddress" to deviceAddress,
      "rssi" to result.rssi,
      "classId" to scannedClassId
    ))
  }

  private fun setupGattServer(context: Context): Boolean {
    if (bluetoothManager == null) {
      bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    }

    val gattCallback = object : BluetoothGattServerCallback() {
      override fun onConnectionStateChange(device: BluetoothDevice?, status: Int, newState: Int) {
        super.onConnectionStateChange(device, status, newState)
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

        if (characteristic?.uuid == UUID.fromString(ALERT_CHARACTERISTIC_UUID)) {
          val alertType = value?.firstOrNull()?.toInt() ?: 0

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

      true
    } catch (e: SecurityException) {
      false
    } catch (e: Exception) {
      false
    }
  }

  private fun stopGattServer() {
    try {
      gattServer?.clearServices()
      gattServer?.close()
    } catch (e: SecurityException) {
      // Ignore
    }
    gattServer = null
  }

  private fun sendAlertToStudentSync(deviceAddress: String, alertType: Int, callback: (Boolean, String?) -> Unit) {
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
        callback(false, "Connection timeout")
      }
    }
    alertHandler?.postDelayed(timeoutRunnable, CONNECTION_TIMEOUT_MS)

    val gattCallback = object : BluetoothGattCallback() {
      private var gatt: BluetoothGatt? = null

      override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
        this.gatt = gatt
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
