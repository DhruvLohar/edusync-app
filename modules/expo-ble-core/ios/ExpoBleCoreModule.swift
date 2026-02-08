import ExpoModulesCore
import CoreBluetooth

// ============== DELEGATE HANDLER CLASS ==============
class BleDelegate: NSObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate {
  weak var module: ExpoBleCoreModule?

  init(module: ExpoBleCoreModule) {
    self.module = module
    super.init()
  }

  // Forward all delegate calls to module
  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    module?.centralManagerDidUpdateState(central)
  }

  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
    module?.centralManager(central, didDiscover: peripheral, advertisementData: advertisementData, rssi: RSSI)
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    module?.centralManager(central, didConnect: peripheral)
  }

  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    module?.centralManager(central, didFailToConnect: peripheral, error: error)
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    module?.peripheral(peripheral, didDiscoverServices: error)
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    module?.peripheral(peripheral, didDiscoverCharacteristicsFor: service, error: error)
  }

  func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    module?.peripheral(peripheral, didWriteValueFor: characteristic, error: error)
  }

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    module?.peripheralManagerDidUpdateState(peripheral)
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
    module?.peripheralManager(peripheral, didReceiveWrite: requests)
  }
}

public class ExpoBleCoreModule: Module {

  // ============== CONSTANTS ==============
  let ATTENDANCE_SERVICE_UUID = CBUUID(string: "0c287abd-eb75-4dd3-afc6-b3f3368307fa")
  let ALERT_CHARACTERISTIC_UUID = CBUUID(string: "0c287abd-eb75-4dd3-afc6-b3f3368307fb")

  // ============== STATE ==============
  let bleQueue = DispatchQueue(label: "com.edusync.ble.queue", qos: .userInitiated)

  var centralManager: CBCentralManager!
  var peripheralManager: CBPeripheralManager!
  var bleDelegate: BleDelegate!

  // Teacher State
  var isScanning = false
  var scanClassId: String?
  var discoveredStudents = [String: [String: Any]]()
  var discoveredPeripherals = [String: CBPeripheral]()

  // Cache to avoid spamming JS
  var discoveredLabels = Set<String>()

  // Student State
  private var isAdvertising = false
  private var currentCombinedId: String?
  private var checkInTimestamp: Double?
  private var alertCharacteristic: CBMutableCharacteristic?

  // Rollout State
  private var isAlertRolloutActive = false
  private var alertRolloutCancelled = false

  // Promise handling
  var pendingPromise: Promise?
  var syncCallback: ((Bool, String?) -> Void)?
  var targetCharUUID: CBUUID?
  var targetAlertType: Int?
  var currentPeripheral: CBPeripheral?

  public func definition() -> ModuleDefinition {
    Name("ExpoBleCore")

    OnCreate {
      self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      self.log("🚀 iOS MODULE INITIALIZED (CROSS-PLATFORM COMPATIBLE)")
      self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

      // Create delegate handler
      self.bleDelegate = BleDelegate(module: self)

      // Initialize Managers with delegate handler
      self.centralManager = CBCentralManager(delegate: self.bleDelegate, queue: self.bleQueue)
      self.peripheralManager = CBPeripheralManager(delegate: self.bleDelegate, queue: self.bleQueue)

      // Verify setup
      self.bleQueue.asyncAfter(deadline: .now() + 0.5) {
          self.log("📋 Post-Init Check:")
          self.log("   Central Delegate: \(self.centralManager.delegate != nil ? "✓ SET" : "✗ NIL")")
          self.log("   Peripheral Delegate: \(self.peripheralManager.delegate != nil ? "✓ SET" : "✗ NIL")")
          self.log("   Central State: \(self.stateString(self.centralManager.state))")
          self.log("   Peripheral State: \(self.stateString(self.peripheralManager.state))")

          if self.centralManager.delegate == nil {
              self.log("❌ CRITICAL: Central delegate is NIL!")
          }
      }
    }

    Events("onStudentDiscovered", "onAlertProgress", "onAlertReceived", "onBluetoothStateChanged", "onLog")

    // ============== PERMISSIONS & UTILS ==============

    Function("hasPermissions") {
      if #available(iOS 13.1, *) {
        let auth = CBCentralManager.authorization
        self.log("📱 Authorization: \(self.authString(auth))")
        return auth == .allowedAlways
      }
      return true
    }

    AsyncFunction("requestPermissions") { (promise: Promise) in
      if #available(iOS 13.1, *) {
         let status = CBCentralManager.authorization
         self.log("📱 Permission Status: \(self.authString(status))")
         promise.resolve(status == .allowedAlways)
      } else {
         promise.resolve(true)
      }
    }

    Function("isBluetoothEnabled") {
      let enabled = self.centralManager.state == .poweredOn
      return enabled
    }

    AsyncFunction("requestEnableBluetooth") { (promise: Promise) in
      self.log("ℹ️ iOS cannot programmatically enable Bluetooth")
      promise.resolve(false)
    }

    Function("isBleAdvertisingSupported") { return true }

    Function("startBluetoothStateListener") {
      self.log("📻 Bluetooth state listener active")
      return true
    }

    Function("stopBluetoothStateListener") { return true }

    Function("resetBluetoothCache") {
      self.bleQueue.async {
          self.log("🔄 Resetting Bluetooth cache...")

          if self.isScanning {
              self.centralManager.stopScan()
              self.isScanning = false
          }

          self.centralManager = nil
          self.peripheralManager = nil
          Thread.sleep(forTimeInterval: 0.5)

          self.centralManager = CBCentralManager(delegate: self.bleDelegate, queue: self.bleQueue)
          self.peripheralManager = CBPeripheralManager(delegate: self.bleDelegate, queue: self.bleQueue)

          self.log("✅ Cache reset complete")
      }
      return true
    }

    // ============== TEACHER FUNCTIONS (Scanning) ==============

    AsyncFunction("startStudentScan") { (classPrefix: String, promise: Promise) in
      self.bleQueue.async {
          let state = self.centralManager.state

          self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
          self.log("🔵 START STUDENT SCAN (iOS Teacher)")
          self.log("   Prefix Filter: '\(classPrefix)'")
          self.log("   Service UUID: \(self.ATTENDANCE_SERVICE_UUID.uuidString)")
          self.log("   Strategy: LocalName (iOS) + ManufacturerData (Android)")

          guard state == .poweredOn else {
            let errorMsg = "Bluetooth not ready (state: \(self.stateString(state)))"
            self.log("❌ \(errorMsg)")
            promise.resolve(["success": false, "error": errorMsg])
            return
          }

          if self.isScanning {
            self.log("⚠️ Already scanning")
            promise.resolve(["success": false, "error": "Already scanning"])
            return
          }

          self.scanClassId = classPrefix
          self.isScanning = true
          self.discoveredStudents.removeAll()
          self.discoveredLabels.removeAll()
          self.discoveredPeripherals.removeAll()

          self.log("📡 Starting scan...")
          self.log("   Options: AllowDuplicates=true")

          // CRITICAL: Scan for Service UUID to work in background
          self.centralManager.scanForPeripherals(
            withServices: [self.ATTENDANCE_SERVICE_UUID],
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
          )

          self.log("✅ Scan started")
          promise.resolve(["success": true])
      }
    }

    Function("stopStudentScan") {
      self.bleQueue.async {
          self.log("🛑 Stopping scan")
          self.centralManager.stopScan()
          self.isScanning = false
          self.scanClassId = nil
      }
      return ["success": true]
    }

    Function("isScanning") { return self.isScanning }

    Function("getDiscoveredStudents") { return Array(self.discoveredStudents.values) }

    Function("clearDiscoveredStudents") {
      self.log("🧹 Clearing discovered students")
      self.discoveredStudents.removeAll()
      self.discoveredLabels.removeAll()
      self.discoveredPeripherals.removeAll()
      return true
    }

    AsyncFunction("sendAlertToStudent") { (deviceAddress: String, alertType: Int, promise: Promise) in
      self.bleQueue.async {
          self.log("📤 Sending alert to \(deviceAddress)")
          guard let peripheral = self.discoveredPeripherals[deviceAddress] else {
            self.log("❌ Device not found")
            promise.resolve(["success": false, "error": "Device not found"])
            return
          }
          self.connectAndAlert(peripheral: peripheral, alertType: alertType, serviceUUID: self.ATTENDANCE_SERVICE_UUID, charUUID: self.ALERT_CHARACTERISTIC_UUID, promise: promise)
      }
    }

    AsyncFunction("sendAlertToAll") { (studentAddresses: [String], alertType: Int, delayMs: Int, promise: Promise) in
      if self.isAlertRolloutActive {
        self.log("⚠️ Alert rollout already active")
        promise.resolve(["success": false, "error": "Active"])
        return
      }

      self.log("📢 Starting alert rollout: \(studentAddresses.count) students")
      self.isAlertRolloutActive = true
      self.alertRolloutCancelled = false

      DispatchQueue.global().async {
        var results: [[String: Any]] = []
        var successCount = 0
        var failedCount = 0

        for (index, uuid) in studentAddresses.enumerated() {
          if self.alertRolloutCancelled { break }

          self.sendEvent("onAlertProgress", [
            "current": index + 1,
            "total": studentAddresses.count,
            "deviceAddress": uuid,
            "status": "connecting"
          ])

          let semaphore = DispatchSemaphore(value: 0)
          var opSuccess = false

          self.bleQueue.async {
              if let peripheral = self.discoveredPeripherals[uuid] {
                self.connectAndAlertSync(peripheral: peripheral, alertType: alertType, serviceUUID: self.ATTENDANCE_SERVICE_UUID, charUUID: self.ALERT_CHARACTERISTIC_UUID) { success, _ in
                  opSuccess = success
                  semaphore.signal()
                }
              } else { semaphore.signal() }
          }

          _ = semaphore.wait(timeout: .now() + .seconds(10))
          if opSuccess { successCount += 1 } else { failedCount += 1 }

          results.append(["deviceAddress": uuid, "success": opSuccess])

          self.sendEvent("onAlertProgress", [
            "current": index + 1,
            "total": studentAddresses.count,
            "deviceAddress": uuid,
            "status": opSuccess ? "success" : "failed"
          ])

          if index < studentAddresses.count - 1 && !self.alertRolloutCancelled {
            usleep(useconds_t(delayMs * 1000))
          }
        }

        self.isAlertRolloutActive = false
        self.log("✅ Rollout complete: \(successCount) success, \(failedCount) failed")
        promise.resolve(["success": successCount, "failed": failedCount, "results": results])
      }
    }

    Function("cancelAlertRollout") {
      self.alertRolloutCancelled = true
      self.log("🛑 Alert rollout cancelled")
      return ["success": true as Any]
    }

    Function("isAlertRolloutActive") { return self.isAlertRolloutActive }

    Function("markStudentVerified") { (studentId: String) in
      if var student = self.discoveredStudents[studentId] {
        student["verified"] = true
        student["verifiedAt"] = Date().timeIntervalSince1970 * 1000
        self.discoveredStudents[studentId] = student
        self.log("✓ Student \(studentId) verified")
        return true
      }
      return false
    }

    Function("getAttendanceReport") {
      return self.discoveredStudents.values.map { student -> [String: Any] in
        let verified = student["verified"] as? Bool ?? false
        let status = verified ? "present" : "unverified"
        return [
          "studentId": student["studentId"] ?? "unknown",
          "deviceAddress": student["deviceAddress"] ?? "",
          "status": status,
          "discoveredAt": student["discoveredAt"] ?? 0,
          "verifiedAt": student["verifiedAt"] ?? NSNull()
        ]
      }
    }

    // ============== STUDENT FUNCTIONS (Advertising) ==============

    AsyncFunction("checkIn") { (combinedId: String, promise: Promise) in
      self.bleQueue.async {
          self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
          self.log("📍 CHECK-IN (iOS Student)")
          self.log("   ID: '\(combinedId)'")

          guard self.peripheralManager.state == .poweredOn else {
            let errorMsg = "Bluetooth not ready"
            self.log("❌ \(errorMsg)")
            promise.resolve(["success": false, "error": errorMsg])
            return
          }

          if self.isAdvertising {
            self.log("⚠️ Already advertising")
            promise.resolve(["success": false, "error": "Already Active"])
            return
          }

          if combinedId.utf8.count > 8 {
             self.log("❌ ID too long (Max 8 bytes)")
             promise.resolve(["success": false, "error": "ID too long"])
             return
          }

          self.currentCombinedId = combinedId

          // Create Service
          self.log("🔧 Setup GATT...")
          let alertChar = CBMutableCharacteristic(
            type: self.ALERT_CHARACTERISTIC_UUID,
            properties: [.write, .writeWithoutResponse],
            value: nil,
            permissions: [.writeable]
          )
          self.alertCharacteristic = alertChar

          let service = CBMutableService(type: self.ATTENDANCE_SERVICE_UUID, primary: true)
          service.characteristics = [alertChar]

          self.peripheralManager.removeAllServices()
          self.peripheralManager.add(service)

          // ✅ CRITICAL: iOS can ONLY advertise via LocalName
          // iOS does NOT support Service Data in peripheral mode
          // Android teachers MUST read the LocalName field
          self.log("📢 Advertising configuration:")
          self.log("   - Service UUID: \(self.ATTENDANCE_SERVICE_UUID.uuidString)")
          self.log("   - Local Name: '\(combinedId)' (cross-platform)")
          self.log("   - Note: iOS cannot use Service Data (platform limitation)")

          let advData: [String: Any] = [
            CBAdvertisementDataServiceUUIDsKey: [self.ATTENDANCE_SERVICE_UUID],
            CBAdvertisementDataLocalNameKey: combinedId
          ]

          self.peripheralManager.startAdvertising(advData)

          self.isAdvertising = true
          self.checkInTimestamp = Date().timeIntervalSince1970 * 1000

          self.log("✅ Advertising started (LocalName mode)")
          promise.resolve(["success": true])
      }
    }

    Function("checkOut") {
      self.bleQueue.async {
          self.log("📤 Checking out...")
          self.peripheralManager.stopAdvertising()
          self.peripheralManager.removeAllServices()
          self.isAdvertising = false
          self.currentCombinedId = nil
          self.log("✅ Checked out")
      }
      return ["success": true]
    }

    Function("isCheckedIn") { return self.isAdvertising }

    Function("getCheckInStatus") {
      if !self.isAdvertising { return nil as [String: Any]? }
      return [
        "studentId": self.currentCombinedId as Any,
        "checkedInAt": self.checkInTimestamp as Any
      ] as [String: Any]
    }
  }

  // ============== DELEGATE METHODS ==============

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    self.log("📱 Central State: \(self.stateString(central.state))")
    self.sendEvent("onBluetoothStateChanged", ["enabled": central.state == .poweredOn])
  }

  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
    guard self.isScanning else { return }

    self.log("━━━━ ADVERTISEMENT RECEIVED ━━━━")
    self.log("Peripheral: \(peripheral.identifier.uuidString)")
    self.log("RSSI: \(RSSI)")

    var studentLabel: String?

    // Strategy 1: Check LocalName (iOS students advertise here)
    if let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String {
        self.log("✓ Local Name: '\(localName)'")
        if localName.matches("^[A-Za-z0-9]+$") && localName.count <= 8 {
            studentLabel = localName
            self.log("  → Accepted as Student ID")
        } else {
            self.log("  → Rejected (invalid format)")
        }
    } else {
        self.log("✗ No Local Name")
    }

    // Strategy 2: Check Manufacturer Data (Android students advertise here)
    if studentLabel == nil, let manufData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data {
        self.log("✓ Manufacturer Data: \(manufData.count) bytes")
        self.log("  Hex: \(manufData.map { String(format: "%02X", $0) }.joined(separator: " "))")

        // Android format: [0xFF, 0xFF, ...student ID bytes...]
        // iOS receives this as-is (with the 2-byte manufacturer ID prefix)
        if manufData.count > 2 {
            let actualData = manufData.subdata(in: 2..<manufData.count)
            if let str = String(data: actualData, encoding: .utf8) {
                 self.log("  Decoded: '\(str)' (skipped 2-byte prefix)")
                 if str.matches("^[A-Za-z0-9]+$") && str.count <= 8 {
                     studentLabel = str
                     self.log("  → Accepted as Student ID")
                 } else {
                     self.log("  → Rejected (invalid format)")
                 }
            } else {
                self.log("  ✗ Failed UTF-8 decode")
            }
        } else {
            self.log("  ✗ Data too short")
        }
    } else if studentLabel == nil {
        self.log("✗ No Manufacturer Data")
    }

    // Process result
    if let label = studentLabel {
        // Filter by prefix
        if let prefix = self.scanClassId, !label.hasPrefix(prefix) {
            self.log("⏩ Ignored: '\(label)' (prefix mismatch, expected '\(prefix)')")
            return
        }

        // De-duplication
        if !self.discoveredLabels.contains(label) {
            self.log("✅ NEW STUDENT FOUND: \(label) (RSSI: \(RSSI))")

            self.discoveredLabels.insert(label)
            self.discoveredPeripherals[peripheral.identifier.uuidString] = peripheral

            // Store by String ID
            self.discoveredStudents[label] = [
                "studentId": label,
                "deviceAddress": peripheral.identifier.uuidString,
                "rssi": RSSI,
                "verified": false,
                "discoveredAt": Date().timeIntervalSince1970 * 1000
            ]

            // Send to JS
            self.sendEvent("onStudentDiscovered", [
                "studentId": label,
                "deviceAddress": peripheral.identifier.uuidString,
                "rssi": RSSI,
                "classId": label
            ])
        } else {
            self.log("ℹ️  Already discovered: \(label)")
        }
    } else {
        self.log("⚠️  No student ID found in advertisement")
        self.log("Available fields: \(advertisementData.keys)")
    }
  }

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    self.log("📢 Peripheral State: \(self.stateString(peripheral.state))")
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
     for r in requests {
        if r.characteristic.uuid == self.ALERT_CHARACTERISTIC_UUID, let v = r.value?.first {
           self.log("🔔 Alert Received: Type \(v)")
           self.sendEvent("onAlertReceived", ["alertType": Int(v), "timestamp": Date().timeIntervalSince1970 * 1000])
        }
        peripheral.respond(to: r, withResult: .success)
     }
  }

  // ============== CONNECTION LOGIC ==============

  func connectAndAlert(peripheral: CBPeripheral, alertType: Int, serviceUUID: CBUUID, charUUID: CBUUID, promise: Promise) {
    self.log("🔗 Connecting to \(peripheral.identifier.uuidString)...")
    self.pendingPromise = promise
    self.targetAlertType = alertType
    self.targetCharUUID = charUUID
    self.currentPeripheral = peripheral
    peripheral.delegate = self.bleDelegate
    self.centralManager.connect(peripheral, options: nil)
  }

  func connectAndAlertSync(peripheral: CBPeripheral, alertType: Int, serviceUUID: CBUUID, charUUID: CBUUID, callback: @escaping (Bool, String?) -> Void) {
    self.syncCallback = callback
    self.targetAlertType = alertType
    self.targetCharUUID = charUUID
    self.currentPeripheral = peripheral
    peripheral.delegate = self.bleDelegate
    self.centralManager.connect(peripheral, options: nil)
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    self.log("✅ Connected, discovering services...")
    peripheral.discoverServices([self.ATTENDANCE_SERVICE_UUID])
  }

  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    self.log("❌ Connection failed: \(error?.localizedDescription ?? "unknown")")
    finish(false, error?.localizedDescription)
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
     guard let s = peripheral.services?.first(where: { $0.uuid == self.ATTENDANCE_SERVICE_UUID }) else {
        self.log("❌ Service not found")
        finish(false, "No Service")
        return
     }
     self.log("✓ Service found, discovering characteristics...")
     peripheral.discoverCharacteristics([self.ALERT_CHARACTERISTIC_UUID], for: s)
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
     guard let c = service.characteristics?.first(where: { $0.uuid == self.ALERT_CHARACTERISTIC_UUID }) else {
        self.log("❌ Characteristic not found")
        finish(false, "No Char")
        return
     }

     if let val = targetAlertType {
        self.log("📤 Writing alert: \(val)")
        peripheral.writeValue(Data([UInt8(val)]), for: c, type: c.properties.contains(.write) ? .withResponse : .withoutResponse)

        if !c.properties.contains(.write) {
            finish(true, nil)
        }
     }
  }

  func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    if let error = error {
        self.log("❌ Write failed: \(error.localizedDescription)")
        finish(false, error.localizedDescription)
    } else {
        self.log("✅ Alert sent")
        finish(true, nil)
    }
  }

  func finish(_ success: Bool, _ err: String?) {
     pendingPromise?.resolve(["success": success, "error": err as Any])
     pendingPromise = nil

     syncCallback?(success, err)
     syncCallback = nil

     if let p = currentPeripheral {
        self.centralManager.cancelPeripheralConnection(p)
        currentPeripheral = nil
     }
  }

  // ============== HELPERS ==============

  func log(_ message: String) {
    let timestamp = Date()
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm:ss.SSS"
    let timeStr = formatter.string(from: timestamp)

    print("[ExpoBleCore \(timeStr)] \(message)")
    sendEvent("onLog", ["message": message, "timestamp": timestamp.timeIntervalSince1970 * 1000])
  }

  func stateString(_ state: CBManagerState) -> String {
    switch state {
    case .unknown: return "Unknown"
    case .resetting: return "Resetting"
    case .unsupported: return "Unsupported"
    case .unauthorized: return "Unauthorized"
    case .poweredOff: return "PoweredOff"
    case .poweredOn: return "PoweredOn"
    @unknown default: return "Unknown(\(state.rawValue))"
    }
  }

  func authString(_ auth: CBManagerAuthorization) -> String {
    switch auth {
    case .notDetermined: return "NotDetermined"
    case .restricted: return "Restricted"
    case .denied: return "Denied"
    case .allowedAlways: return "AllowedAlways"
    @unknown default: return "Unknown(\(auth.rawValue))"
    }
  }
}

// String extension for regex matching
extension String {
  func matches(_ pattern: String) -> Bool {
    return range(of: pattern, options: .regularExpression) != nil
  }
}
