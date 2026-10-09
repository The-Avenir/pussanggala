import { Image } from 'react-native';
import type { ImageSourcePropType, StyleProp, ImageStyle } from 'react-native';

// Trimmed Gaile poses share one scale (assets/mascot/README.md), so a common
// height keeps the character the same size across screens.
const POSES = {
  binoculars: { source: require('../../assets/mascot/trimmed/gaile-binoculars.png'), width: 413, height: 505 },
  cheer: { source: require('../../assets/mascot/trimmed/gaile-cheer.png'), width: 409, height: 495 },
  compass: { source: require('../../assets/mascot/trimmed/gaile-compass.png'), width: 461, height: 498 },
  idle: { source: require('../../assets/mascot/trimmed/gaile-idle.png'), width: 383, height: 502 },
  map: { source: require('../../assets/mascot/trimmed/gaile-map.png'), width: 404, height: 506 },
  pointing: { source: require('../../assets/mascot/trimmed/gaile-pointing.png'), width: 465, height: 504 },
  think: { source: require('../../assets/mascot/trimmed/gaile-think.png'), width: 363, height: 499 },
  walk: { source: require('../../assets/mascot/trimmed/gaile-walk.png'), width: 394, height: 512 },
  wave: { source: require('../../assets/mascot/trimmed/gaile-wave.png'), width: 383, height: 507 },
} satisfies Record<string, { source: ImageSourcePropType; width: number; height: number }>;
export type Pose = keyof typeof POSES;

export function Mascot({ pose, height, style }: {
  pose: Pose; height: number; style?: StyleProp<ImageStyle>;
}): React.JSX.Element {
  const art = POSES[pose];
  return <Image source={art.source} accessibilityIgnoresInvertColors testID={`mascot-${pose}`}
    accessible={false} resizeMode="contain"
    style={[{ height, width: Math.round(height * art.width / art.height) }, style]} />;
}
