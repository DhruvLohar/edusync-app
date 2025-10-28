import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoBleCoreViewProps } from './ExpoBleCore.types';

const NativeView: React.ComponentType<ExpoBleCoreViewProps> =
  requireNativeView('ExpoBleCore');

export default function ExpoBleCoreView(props: ExpoBleCoreViewProps) {
  return <NativeView {...props} />;
}
