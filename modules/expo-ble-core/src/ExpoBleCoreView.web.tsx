import * as React from 'react';

import { ExpoBleCoreViewProps } from './ExpoBleCore.types';

export default function ExpoBleCoreView(props: ExpoBleCoreViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
