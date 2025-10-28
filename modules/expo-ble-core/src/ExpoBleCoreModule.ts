import { NativeModule, requireNativeModule } from 'expo';

import { ExpoBleCoreModuleEvents } from './ExpoBleCore.types';

declare class ExpoBleCoreModule extends NativeModule<ExpoBleCoreModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoBleCoreModule>('ExpoBleCore');
