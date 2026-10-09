import { useState } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';

// Scale a fixed-size Figma export uniformly without overriding SVG root dimensions.
export function ScaledArtwork({ width, height, children }: {
  width: number; height: number; children: ReactNode;
}): React.JSX.Element {
  const [availableWidth, setAvailableWidth] = useState(width);
  const scale = Math.min(1, availableWidth / width);
  return <View onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)}
    style={{ alignSelf: 'center', width: '100%', maxWidth: width, height: height * scale, overflow: 'hidden' }}>
    <View style={{ width, height, transform: [{ scale }], transformOrigin: 'top left' }}>{children}</View>
  </View>;
}
