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
  // Use a dedicated serial queue to prevent main thread freezing/race conditions
  let bleQueue = DispatchQueue(label: "com.edusync.ble.queue", qos: .userInitiated)
  
  var centralManager: CBCentralManager!
  var peripheralManager: CBPeripheralManager!
  var bleDelegate: BleDelegate!  // Delegate handler
  
  // Teacher State
  var isScanning = false
  var scanClassId: String?
  var discoveredStudents = [Int: [String: Any]]()
  var discoveredPeripherals = [String: CBPeripheral]()
  
  // Student State
  private var isAdvertising = false
  private var currentClassId: String?
  private var currentStudentId: Int?
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
      self.log("🚀 iOS MODULE INITIALIZED")
      self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      
      // Create delegate handler
      self.bleDelegate = BleDelegate(module: self)
      
      // Initialize Managers with delegate handler
      self.centralManager = CBCentralManager(delegate: self.bleDelegate, queue: self.bleQueue)
      self.peripheralManager = CBPeripheralManager(delegate: self.bleDelegate, queue: self.bleQueue)
      
      // Force a state check log after initialization
      self.bleQueue.asyncAfter(deadline: .now() + 0.5) {
          self.log("📋 Post-Init Delegate Check:")
          self.log("   Central Delegate: \(self.centralManager.delegate != nil ? "✓ SET" : "✗ NIL")")
          self.log("   Peripheral Delegate: \(self.peripheralManager.delegate != nil ? "✓ SET" : "✗ NIL")")
          self.log("   Central State: \(self.stateString(self.centralManager.state))")
          self.log("   Peripheral State: \(self.stateString(self.peripheralManager.state))")
          
          if self.centralManager.delegate == nil {
              self.log("❌ CRITICAL: Central delegate is NIL! Scanning will NOT work!")
          }
      }
    }

    Events("onStudentDiscovered", "onAlertProgress", "onAlertReceived", "onBluetoothStateChanged", "onLog")

    // ============== PERMISSIONS & UTILS ==============
    
    Function("hasPermissions") {
      if #available(iOS 13.1, *) {
        let auth = CBCentralManager.authorization
        self.log("📱 Authorization Status: \(self.authString(auth))")
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
      self.log("📡 Bluetooth Enabled: \(enabled) (State: \(self.stateString(self.centralManager.state)))")
      return enabled
    }
    
    AsyncFunction("requestEnableBluetooth") { (promise: Promise) in
      self.log("ℹ️ iOS cannot programmatically enable Bluetooth")
      promise.resolve(false)
    }
    
    Function("isBleAdvertisingSupported") {
      return true
    }
    
    Function("startBluetoothStateListener") {
      self.log("📻 Bluetooth state listener attached (automatic on iOS)")
      return true
    }
    
    Function("stopBluetoothStateListener") {
      return true
    }
    
    Function("resetBluetoothCache") {
      self.bleQueue.async {
          self.log("🔄 Resetting Bluetooth Cache...")
          
          // Stop any active operations
          if self.isScanning {
              self.centralManager.stopScan()
              self.isScanning = false
          }
          
          // Recreate managers (forces iOS to refresh)
          self.centralManager = nil
          self.peripheralManager = nil
          
          // Wait a moment for cleanup
          Thread.sleep(forTimeInterval: 0.5)
          
          // Reinitialize with delegate
          self.centralManager = CBCentralManager(delegate: self.bleDelegate, queue: self.bleQueue)
          self.peripheralManager = CBPeripheralManager(delegate: self.bleDelegate, queue: self.bleQueue)
          
          self.log("✅ Bluetooth cache reset complete")
      }
      return true
    }

    // ============== TEACHER FUNCTIONS ==============
    
    AsyncFunction("startStudentScan") { (classId: String, promise: Promise) in
      self.bleQueue.async {
          let state = self.centralManager.state
          
          self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
          self.log("🔵 START STUDENT SCAN")
          self.log("   ClassID: '\(classId)'")
          self.log("   Current State: \(state.rawValue) (\(self.stateString(state)))")
          self.log("   Is Already Scanning: \(self.isScanning)")
          self.log("   Delegate Set: \(self.centralManager.delegate != nil ? "YES" : "NO")")
          
          // CRITICAL: Check actual state
          guard state == .poweredOn else {
            let errorMsg = "Bluetooth not ready (state: \(self.stateString(state)))"
            self.log("❌ \(errorMsg)")
            self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            promise.resolve(["success": false, "error": errorMsg])
            return
          }
          
          if self.isScanning {
            self.log("⚠️ Already scanning")
            self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            promise.resolve(["success": false, "error": "Already scanning"])
            return
          }

          self.scanClassId = classId
          self.isScanning = true
          self.discoveredStudents.removeAll()
          self.discoveredPeripherals.removeAll()
          
          self.log("📡 Starting scan for ALL devices...")
          self.log("   Services: nil (scan everything)")
          self.log("   AllowDuplicates: true")
          
          // Scan for ALL devices to debug
          self.centralManager.scanForPeripherals(
            withServices: nil,
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
          )
          
          self.log("✅ Scan command issued to iOS CoreBluetooth")
          self.log("   Waiting for delegate callbacks...")
          
          // Add diagnostic timer
          DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
              if self.discoveredStudents.isEmpty {
                  self.log("⚠️ DIAGNOSTIC: 5 seconds elapsed, NO devices discovered")
                  self.log("   Possible issues:")
                  self.log("   1. No BLE devices nearby (try with LightBlue app)")
                  self.log("   2. Delegate not firing (check Xcode console)")
                  self.log("   3. Bluetooth hardware issue (restart device)")
                  self.log("   Try: ExpoBleCore.resetBluetoothCache()")
              } else {
                  self.log("✓ Found \(self.discoveredStudents.count) matching students")
              }
          }
          
          self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
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
    
    Function("isScanning") {
      return self.isScanning
    }
    
    Function("getDiscoveredStudents") {
      return Array(self.discoveredStudents.values)
    }
    
    Function("clearDiscoveredStudents") {
      self.log("🧹 Clearing discovered students list")
      self.discoveredStudents.removeAll()
      self.discoveredPeripherals.removeAll()
      return true
    }
    
    AsyncFunction("sendAlertToStudent") { (deviceAddress: String, alertType: Int, promise: Promise) in
      self.bleQueue.async {
          self.log("📤 Sending alert to \(deviceAddress)")
          guard let peripheral = self.discoveredPeripherals[deviceAddress] else {
            self.log("❌ Device not found in cache")
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
      
      self.log("📢 Starting alert rollout to \(studentAddresses.count) students")
      self.isAlertRolloutActive = true
      self.alertRolloutCancelled = false
      
      DispatchQueue.global().async {
        var results: [[String: Any]] = []
        var successCount = 0
        var failedCount = 0
        
        for (index, uuid) in studentAddresses.enumerated() {
          if self.alertRolloutCancelled {
            self.log("⚠️ Rollout cancelled")
            break
          }
          
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
              } else {
                self.log("⚠️ Device \(uuid) not found")
                semaphore.signal()
              }
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
    
    Function("isAlertRolloutActive") {
      return self.isAlertRolloutActive
    }

    Function("markStudentVerified") { (studentId: Int) in
      if var student = self.discoveredStudents[studentId] {
        student["verified"] = true
        student["verifiedAt"] = Date().timeIntervalSince1970 * 1000
        self.discoveredStudents[studentId] = student
        self.log("✓ Student \(studentId) marked as verified")
        return true
      }
      return false
    }

    Function("getAttendanceReport") {
      return self.discoveredStudents.values.map { student -> [String: Any] in
        let verified = student["verified"] as? Bool ?? false
        let status = verified ? "present" : "unverified"
        return [
          "studentId": student["studentId"] ?? 0,
          "deviceAddress": student["deviceAddress"] ?? "",
          "status": status,
          "discoveredAt": student["discoveredAt"] ?? 0,
          "verifiedAt": student["verifiedAt"] ?? NSNull()
        ]
      }
    }
    
    // ============== STUDENT FUNCTIONS ==============
    
    AsyncFunction("checkIn") { (classId: String, studentId: Int, promise: Promise) in
      self.bleQueue.async {
          self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
          self.log("📍 CHECK-IN REQUESTED")
          self.log("   ClassID: '\(classId)'")
          self.log("   StudentID: \(studentId)")
          
          guard self.peripheralManager.state == .poweredOn else {
            let errorMsg = "Bluetooth not ready (state: \(self.stateString(self.peripheralManager.state)))"
            self.log("❌ \(errorMsg)")
            self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            promise.resolve(["success": false, "error": errorMsg])
            return
          }
          
          if self.isAdvertising {
            self.log("⚠️ Already advertising")
            self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            promise.resolve(["success": false, "error": "Already Active"])
            return
          }
          
          self.currentClassId = classId
          self.currentStudentId = studentId
          
          // Create GATT Service
          self.log("🔧 Setting up GATT service...")
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
          
          // iOS Advertisement Format: Use Local Name
          // (iOS cannot set manufacturer data like Android)
          let localName = "\(classId)_\(studentId)"
          
          self.log("📢 Starting advertisement...")
          self.log("   Format: LocalName")
          self.log("   LocalName: '\(localName)'")
          self.log("   Service UUID: \(self.ATTENDANCE_SERVICE_UUID.uuidString)")
          
          // Calculate approximate size
          let nameBytes = localName.utf8.count
          let serviceBytes = 18 // Approximate
          let totalBytes = nameBytes + serviceBytes + 3 // +3 for headers
          
          self.log("   Estimated packet size: ~\(totalBytes) bytes")
          
          if totalBytes > 31 {
              self.log("⚠️ WARNING: Packet may be too large!")
              self.log("   Consider using shorter class IDs (max 8 chars recommended)")
          }
          
          self.peripheralManager.startAdvertising([
            CBAdvertisementDataServiceUUIDsKey: [self.ATTENDANCE_SERVICE_UUID],
            CBAdvertisementDataLocalNameKey: localName
          ])
          
          self.isAdvertising = true
          self.checkInTimestamp = Date().timeIntervalSince1970 * 1000
          
          self.log("✅ Advertisement started successfully")
          self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
          promise.resolve(["success": true])
      }
    }
    
    Function("checkOut") {
      self.bleQueue.async {
          self.log("📤 Checking out...")
          self.peripheralManager.stopAdvertising()
          self.peripheralManager.removeAllServices()
          self.isAdvertising = false
          self.currentClassId = nil
          self.currentStudentId = nil
          self.log("✅ Checked out successfully")
      }
      return ["success": true]
    }
    
    Function("isCheckedIn") {
      return self.isAdvertising
    }
    
    Function("getCheckInStatus") {
      if !self.isAdvertising { return nil as [String: Any]? }
      return [
        "classId": self.currentClassId as Any,
        "studentId": self.currentStudentId as Any,
        "checkedInAt": self.checkInTimestamp as Any
      ] as [String: Any]
    }
  }
  
  // ============== DELEGATE METHODS (Called by BleDelegate) ==============
  
  // 1. Central Manager State
  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    let stateStr = self.stateString(central.state)
    let isPoweredOn = central.state == .poweredOn
    
    self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    self.log("📱 Central Manager State Changed")
    self.log("   State: \(stateStr) (Raw: \(central.state.rawValue))")
    self.log("   Powered On: \(isPoweredOn)")
    
    if !isPoweredOn {
        self.log("   ⚠️ Bluetooth is NOT ready!")
        
        switch central.state {
        case .poweredOff:
            self.log("   → Turn on Bluetooth in Settings")
        case .unauthorized:
            self.log("   → Grant Bluetooth permissions in Settings")
        case .unsupported:
            self.log("   → Device doesn't support Bluetooth LE")
        case .resetting:
            self.log("   → Bluetooth is resetting, please wait...")
        default:
            break
        }
    } else {
        self.log("   ✅ Ready to scan and connect!")
    }
    
    self.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    self.sendEvent("onBluetoothStateChanged", ["enabled": isPoweredOn])
  }
  
  // 2. Device Discovery (CRITICAL - This must fire for scanning to work)
  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
    // Get device name
    let name = peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? "Unknown"
    let uuid = peripheral.identifier.uuidString
    
    // LOG EVERY DEVICE (helps debug if delegate is working)
    print("[BLE-iOS] 🔎 DISCOVERED: \(name) [\(uuid)] RSSI: \(RSSI)dBm")
    
    // Log advertisement data details
    if !advertisementData.isEmpty {
        var dataKeys: [String] = []
        for key in advertisementData.keys {
            dataKeys.append(key)
        }
        print("[BLE-iOS]    Ad Data: \(dataKeys.joined(separator: ", "))")
        
        if let manufData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data {
            let hex = manufData.map { String(format: "%02X", $0) }.joined(separator: " ")
            print("[BLE-iOS]    ManufData: \(hex)")
        }
        
        if let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String {
            print("[BLE-iOS]    LocalName: '\(localName)'")
        }
        
        if let serviceUUIDs = advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] {
            print("[BLE-iOS]    Services: \(serviceUUIDs.map { $0.uuidString }.joined(separator: ", "))")
        }
    }
    
    guard self.isScanning, let scanClassId = self.scanClassId else {
        print("[BLE-iOS]    ⏩ Skipped (not scanning or no classId set)")
        return
    }
    
    var foundClassId: String?
    var foundStudentId: Int?
    var dataSource = "none"
    
    // =========================================================
    // 1. Try Manufacturer Data (Android Student Format)
    // =========================================================
    if let manufData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data {
        print("[BLE-iOS]    🔍 Checking Manufacturer Data...")
        
        // Find separator byte (0x5F = "_")
        if let sep = manufData.firstIndex(of: 0x5F) {
            let classData = manufData.subdata(in: 0..<sep)
            
            if let cid = String(data: classData, encoding: .utf8) {
                foundClassId = cid
                
                // Extract student ID from bytes AFTER separator
                let startInt = sep + 1
                if manufData.count >= startInt + 4 {
                    let idData = manufData.subdata(in: startInt..<startInt+4)
                    let idVal = idData.withUnsafeBytes { $0.load(as: Int32.self) }
                    foundStudentId = Int(idVal)
                    dataSource = "manufacturer_data"
                    
                    print("[BLE-iOS]    ✓ Parsed: ClassID='\(cid)', StudentID=\(foundStudentId!)")
                }
            }
        } else {
            print("[BLE-iOS]    ✗ No separator found in manufacturer data")
        }
    }
    
    // =========================================================
    // 2. Try Local Name (iOS Student Format)
    // =========================================================
    if foundClassId == nil, let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String {
        print("[BLE-iOS]    🔍 Checking Local Name: '\(localName)'")
        
        let parts = localName.split(separator: "_")
        if parts.count >= 2 {
            foundClassId = String(parts[0])
            foundStudentId = Int(parts[1])
            dataSource = "local_name"
            
            print("[BLE-iOS]    ✓ Parsed: ClassID='\(foundClassId!)', StudentID=\(foundStudentId!)")
        } else {
            print("[BLE-iOS]    ✗ Format invalid (expected 'classId_studentId')")
        }
    }
    
    // =========================================================
    // 3. Match & Filter
    // =========================================================
    if let cid = foundClassId, let sid = foundStudentId {
        print("[BLE-iOS]    📊 Match Check: Found='\(cid)', Expected='\(scanClassId)'")
        
        if cid == scanClassId {
            if self.discoveredStudents[sid] == nil {
                 print("[BLE-iOS]    🎉 ✅ MATCH! Student \(sid) from \(dataSource)")
                 
                 self.discoveredPeripherals[peripheral.identifier.uuidString] = peripheral
                 
                 let info: [String: Any] = [
                    "studentId": sid,
                    "deviceAddress": peripheral.identifier.uuidString,
                    "rssi": RSSI.intValue,
                    "discoveredAt": Date().timeIntervalSince1970 * 1000,
                    "verified": false,
                    "verifiedAt": NSNull()
                 ]
                 
                 self.discoveredStudents[sid] = info
                 
                 self.sendEvent("onStudentDiscovered", [
                    "studentId": sid,
                    "deviceAddress": peripheral.identifier.uuidString,
                    "rssi": RSSI.intValue,
                    "classId": cid
                 ])
            } else {
                print("[BLE-iOS]    ℹ️ Already discovered (duplicate)")
            }
        } else {
            print("[BLE-iOS]    ⏩ Class mismatch (ignored)")
        }
    } else {
        print("[BLE-iOS]    ⏩ No valid student data found")
    }
  }
  
  // 3. Peripheral Manager State
  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    let stateStr = self.stateString(peripheral.state)
    self.log("📢 Peripheral Manager State: \(stateStr)")
  }
  
  // 4. Alert Received (Student side)
  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
     for r in requests {
        if r.characteristic.uuid == self.ALERT_CHARACTERISTIC_UUID, let v = r.value?.first {
           self.log("🔔 Alert Received: Type \(v)")
           self.sendEvent("onAlertReceived", ["alertType": Int(v), "timestamp": Date().timeIntervalSince1970 * 1000])
        }
        peripheral.respond(to: r, withResult: .success)
     }
  }
  
  // ============== CONNECTION LOGIC (Teacher sending alerts) ==============
  
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
        self.log("📤 Writing alert value: \(val)")
        peripheral.writeValue(Data([UInt8(val)]), for: c, type: c.properties.contains(.write) ? .withResponse : .withoutResponse)
        
        if !c.properties.contains(.write) {
            // No response expected
            finish(true, nil)
        }
     }
  }
  
  func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    if let error = error {
        self.log("❌ Write failed: \(error.localizedDescription)")
        finish(false, error.localizedDescription)
    } else {
        self.log("✅ Alert sent successfully")
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

  // ============== HELPER FUNCTIONS ==============
  
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
