import { StyleSheet } from 'react-native';

// Sunset Playful values from tools/figma-mockups/spec/tokens.json.
export const colors = {
  ink: '#2e1c14', muted: '#7c6c60', gold: '#ffb729', orange: '#f34b16',
  pink: '#ff6787', surface: '#fff9ef', orangeSoft: '#fff0dd', white: '#ffffff',
  green: '#187856', greenSoft: '#e7f5eb', blue: '#166dfa', blueSoft: '#eaf2ff',
  border: '#efdcca', map: '#f1efe5', canvas: '#fff0e5', goldSoft: '#fff4d6',
  signboard: '#1d3b2f', warn: '#9a5b00',
} as const;

// Line colours used by leg strips and the stop diagram.
export const lineColors = {
  walk: colors.muted, carousel: colors.orange, 'mrt-3': colors.blue, 'lrt-1': colors.green,
} as const;
export type LineId = keyof typeof lineColors;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const typography = StyleSheet.create({
  display: { fontFamily: 'NunitoExtraBold', fontSize: 32, lineHeight: 38, color: colors.ink },
  title: { fontFamily: 'NunitoExtraBold', fontSize: 24, lineHeight: 30, color: colors.ink },
  heading: { fontFamily: 'NunitoBold', fontSize: 18, lineHeight: 24, color: colors.ink },
  label: { fontFamily: 'DMSansBold', fontSize: 14, lineHeight: 20, color: colors.ink },
  body: { fontFamily: 'DMSans', fontSize: 15, lineHeight: 22, color: colors.ink },
  caption: { fontFamily: 'DMSans', fontSize: 12, lineHeight: 17, color: colors.muted },
});
