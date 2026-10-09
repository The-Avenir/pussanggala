declare module '*.svg' {
  import type { ComponentType } from 'react';
  import type { SvgProps } from 'react-native-svg';
  const asset: ComponentType<SvgProps>;
  export default asset;
}
