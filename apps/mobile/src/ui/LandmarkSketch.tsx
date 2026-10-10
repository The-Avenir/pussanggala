import Svg, { Circle, Path } from 'react-native-svg';
import { palette } from './travel';

// Decorative landmark sketches; these do not depict an entrance or a street map.
const outlines = {
  ayala: 'M24 48V20h23V9h33v39m-56-28h56m-45 8h34m-34 8h34m-34 8h34M80 48V25h30v23m-22-16h14m-14 8h14',
  cubao: 'M20 48V28h100v20M30 28c0-23 80-23 80 0M37 48V35h17v13m13 0V35h17v13m13 0V35h13v13',
  north: 'M16 48V22h108v26M28 22V12h38v10m14 0V16h28v6M28 33h15v15m12-15h15v15m12-15h15v15m12-15h5',
  heritage: 'M20 48V26h100v22M26 26V16h12v10m13 0V16h12v10m14 0V16h12v10m13 0V16h12v10M58 48V35q12-14 24 0v13',
} as const;
export function LandmarkSketch({ scene }: { scene: keyof typeof outlines }): React.JSX.Element {
  return <Svg width="100%" height={52} viewBox="0 0 140 60" accessible={false} aria-hidden>
    <Circle cx={116} cy={13} r={9} fill={palette.card}/>
    <Path d={outlines[scene]} fill="none" stroke="#896A49" strokeWidth={1.5} strokeLinejoin="round"/>
    <Path d="M8 49h124M22 54h96" stroke="#896A49" strokeWidth={1} opacity={0.3}/>
  </Svg>;
}
