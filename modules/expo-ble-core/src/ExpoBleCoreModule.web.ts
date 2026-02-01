import { registerWebModule, NativeModule } from 'expo';

import { ExpoBleCoreModuleType } from './ExpoBleCore.types';

class ExpoBleCoreModule extends NativeModule implements ExpoBleCoreModuleType {
  hello() {
    return 'Hello world!';
  }

  startAdvertising() {
    return 'BLE advertising is not supported on web';
  }

  stopAdvertising() {
    return 'BLE advertising is not supported on web';
  }
}

export default registerWebModule(ExpoBleCoreModule, 'ExpoBleCore');
