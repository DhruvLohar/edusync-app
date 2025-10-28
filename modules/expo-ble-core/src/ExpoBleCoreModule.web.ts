import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './ExpoBleCore.types';

type ExpoBleCoreModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ExpoBleCoreModule extends NativeModule<ExpoBleCoreModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ExpoBleCoreModule, 'ExpoBleCoreModule');
