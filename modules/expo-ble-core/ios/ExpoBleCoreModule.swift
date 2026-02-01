import ExpoModulesCore

public class ExpoBleCoreModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoBleCore")

    Function("hello") {
      "Hello world!"
    }

    Function("startAdvertising") {
      "BLE advertising is not implemented on iOS"
    }

    Function("stopAdvertising") {
      "BLE advertising is not implemented on iOS"
    }
  }
}
