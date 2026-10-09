import { StyleSheet } from 'react-native';

// Sunset Playful values from tools/figma-mockups/spec/tokens.json.
export const colors = {
  ink: '#2e1c14', muted: '#7c6c60', gold: '#ffb729', orange: '#f34b16',
  pink: '#ff6787', surface: '#fff9ef', orangeSoft: '#fff0dd', white: '#ffffff',
  green: '#187856', greenSoft: '#e7f5eb', blue: '#166dfa', blueSoft: '#eaf2ff',
  border: '#efdcca', map: '#f1efe5', canvas: '#fff0e5',
} as const;

export const typography = StyleSheet.create({
  display: { fontFamily: 'NunitoExtraBold', fontSize: 34, lineHeight: 40, color: colors.ink },
  title: { fontFamily: 'NunitoExtraBold', fontSize: 24, lineHeight: 30, color: colors.ink },
  heading: { fontFamily: 'NunitoBold', fontSize: 18, lineHeight: 24, color: colors.ink },
  label: { fontFamily: 'DMSansBold', fontSize: 14, lineHeight: 20, color: colors.ink },
  body: { fontFamily: 'DMSans', fontSize: 14, lineHeight: 21, color: colors.ink },
  caption: { fontFamily: 'DMSans', fontSize: 12, lineHeight: 17, color: colors.muted },
});
