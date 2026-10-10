import type { ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Reference UI's warm paper and orange identity, with readable text/action tones.
export const palette = {
  ink: '#422D20', secondary: '#76634F', accent: '#B04A1B', accentSoft: '#FFEBD7',
  orange: '#EE7B32', gold: '#F5DDA9', goldSoft: '#F8EBD3',
  paper: '#FFF9ED', card: '#FFFDF7', background: '#F5E9CC', line: '#E0CFB6',
  rail: '#3F7185', railSoft: '#E8F0F4', success: '#326C61', successSoft: '#EAF2E9', warning: '#80531D', warningSoft: '#FBF2DD',
  destructive: '#A83229', dark: '#486159', white: '#FFFFFF',
} as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, page: 20, xl: 24, xxl: 32 } as const;
const fontFamily = Platform.select({ ios: 'DMSans', android: 'DMSans', default: 'DMSans' });
export const type = StyleSheet.create({
  display: { fontFamily: 'NunitoExtraBold', fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5, color: palette.ink },
  title: { fontFamily: 'NunitoExtraBold', fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -0.25, color: palette.ink },
  heading: { fontFamily: 'NunitoBold', fontSize: 18, lineHeight: 24, fontWeight: '700', color: palette.ink },
  body: { fontFamily, fontSize: 15, lineHeight: 23, color: palette.ink },
  label: { fontFamily: 'DMSansBold', fontSize: 14, lineHeight: 20, color: palette.ink },
  secondary: { fontFamily, fontSize: 13, lineHeight: 20, color: palette.secondary },
  caption: { fontFamily, fontSize: 12, lineHeight: 18, color: palette.secondary },
});
export type IconName = 'arrow' | 'back' | 'pin' | 'map' | 'chat' | 'trips' | 'settings' | 'walk' | 'bus' | 'train' | 'save' | 'check' | 'close' | 'location' | 'info' | 'swap' | 'send' | 'plus' | 'minus';
const paths: Record<IconName, string> = {
  arrow: 'M5 12h14m-5-5 5 5-5 5', back: 'M19 12H5m5-5-5 5 5 5',
  pin: 'M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12Z M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16',
  chat: 'M4 4h16v12H9l-5 4V4Zm4 5h8m-8 3h5', trips: 'M4 7h16v14H4V7Zm5 0V3h6v4m-3 5v4m-4-4v4m8-4v4',
  settings: 'm9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3H9Zm3 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  walk: 'M14 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-2 5 3 3 4 1M8 12l3-4 3 1-2 7 5 5m-5-5-4 5',
  bus: 'M5 4h14v14H5V4Zm0 3h14M8 11h8M8 18v3m8-3v3M8 15h1m6 0h1',
  train: 'M6 3h12v14H6V3Zm0 6h12M9 17l-3 4m9-4 3 4M9 14h1m4 0h1',
  save: 'M6 3h12v18l-6-4-6 4V3Z', check: 'm5 12 4 4L19 6', close: 'm6 6 12 12M6 18 18 6',
  location: 'm3 10 18-7-7 18-3-8-8-3Z', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10v1',
  swap: 'M8 3v16m-4-4 4 4 4-4m4 6V5m-4 4 4-4 4 4', send: 'm3 3 18 9-18 9 4-9-4-9Zm4 9h14',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
};
export function Icon({ name, size = 22, color = palette.ink }: { name: IconName; size?: number; color?: string }): React.JSX.Element {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} aria-hidden>
    <Path d={paths[name]} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>;
}
const gaileArt = {
  idle: { source: require('../../assets/mascot/trimmed/gaile-idle.png'), width: 383, height: 502 },
  wave: { source: require('../../assets/mascot/trimmed/gaile-wave.png'), width: 383, height: 507 },
  map: { source: require('../../assets/mascot/trimmed/gaile-map.png'), width: 404, height: 506 },
  think: { source: require('../../assets/mascot/trimmed/gaile-think.png'), width: 363, height: 499 },
  binoculars: { source: require('../../assets/mascot/trimmed/gaile-binoculars.png'), width: 413, height: 505 },
  cheer: { source: require('../../assets/mascot/trimmed/gaile-cheer.png'), width: 409, height: 495 },
} as const;
export function Gaile({ pose, height }: { pose: keyof typeof gaileArt; height: number }): React.JSX.Element {
  const art = gaileArt[pose];
  return <Image testID={'gaile-' + pose} source={art.source} accessible={false} accessibilityIgnoresInvertColors resizeMode="contain"
    style={{ height, width: Math.round(height * art.width / art.height) }}/>
}
export function GaileMessage({ children, pose = 'idle' }: { children: ReactNode; pose?: keyof typeof gaileArt }): React.JSX.Element {
  return <View style={ui.message}>
    <View style={ui.messageAvatar}><Gaile pose={pose} height={39}/></View>
    <View style={ui.messageBubble}><Text style={[type.caption, ui.speaker]}>Gaile</Text>{children}</View>
  </View>;
}
export function Button({ label, onPress, variant = 'primary', icon, disabled = false, style }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'text' | 'danger'; icon?: IconName;
  disabled?: boolean; style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const color = variant === 'primary' || variant === 'danger' ? palette.white : palette.accent;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }}
    style={({ pressed }) => [ui.button, variant === 'primary' ? ui.primary : variant === 'danger' ? ui.danger : variant === 'secondary' ? ui.secondaryButton : ui.textButton,
      pressed && ui.pressed, disabled && ui.disabled, style]} onPress={onPress}>
    <Text style={[type.label, { color, flexShrink: 1 }]}>{label}</Text>{icon ? <Icon name={icon} color={color} size={19}/> : null}
  </Pressable>;
}
export function IconButton({ name, label, onPress, disabled = false }: { name: IconName; label: string; onPress: () => void; disabled?: boolean }): React.JSX.Element {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [ui.iconButton, pressed && ui.pressed, disabled && ui.disabled]}><Icon name={name}/></Pressable>;
}
export function Notice({ title, children, action, onAction }: { title?: string; children: ReactNode; action?: string; onAction?: () => void }): React.JSX.Element {
  return <View style={ui.notice} accessibilityRole="alert"><Icon name="info" size={19} color={palette.warning}/><View style={ui.flex}>
    {title ? <Text style={[type.label, { color: palette.warning }]}>{title}</Text> : null}
    <Text style={[type.secondary, { color: palette.warning }]}>{children}</Text>
    {action && onAction ? <Button label={action} variant="text" onPress={onAction} style={ui.noticeAction}/> : null}
  </View></View>;
}
export function ListRow({ title, detail, value, icon, onPress, destructive = false }: {
  title: string; detail?: string; value?: string; icon?: IconName; onPress?: () => void; destructive?: boolean;
}): React.JSX.Element {
  const content = <>{icon ? <View style={ui.rowIcon}><Icon name={icon} color={destructive ? palette.destructive : palette.accent} size={20}/></View> : null}
    <View style={ui.flex}><View style={[ui.between, { gap: 8 }]}>
      <Text style={[type.body, { maxWidth: '100%' }, destructive && { color: palette.destructive }]}>{title}</Text>
      {value ? <Text style={[type.secondary, { maxWidth: '100%', flexShrink: 1 }]}>{value}</Text> : null}</View>
      {detail ? <Text style={type.secondary}>{detail}</Text> : null}</View>
    {onPress ? <Icon name="arrow" size={18} color={palette.secondary}/> : null}</>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={detail} onPress={onPress} style={({ pressed }) => [ui.listRow, pressed && ui.pressed]}>{content}</Pressable>
    : <View style={ui.listRow}>{content}</View>;
}
export function Section({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return <View style={{ gap: 4 }}><Text accessibilityRole="header" style={[type.caption, ui.sectionTitle]}>{title}</Text>{children}</View>;
}
export const ui = StyleSheet.create({
  screen: { gap: 12 }, flex: { flex: 1, minWidth: 0 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  button: { minWidth: 44, maxWidth: '100%', minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primary: { backgroundColor: palette.accent }, danger: { backgroundColor: palette.destructive },
  secondaryButton: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line },
  textButton: { paddingHorizontal: 0, justifyContent: 'flex-start' }, pressed: { opacity: 0.7 }, disabled: { opacity: 0.45 },
  iconButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  listRow: { minHeight: 64, padding: 14, marginVertical: 3, borderRadius: 16, backgroundColor: palette.card, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: palette.line },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accentSoft },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: palette.line, borderRadius: 14, backgroundColor: palette.warningSoft, padding: 14 },
  noticeAction: { minHeight: 44, paddingVertical: 8 }, sectionTitle: { fontWeight: '600', letterSpacing: 1, marginTop: 8, marginBottom: 6 },
  input: { minHeight: 50, padding: 12, borderWidth: 1, borderColor: palette.line, borderRadius: 16, backgroundColor: palette.card },
  rule: { height: 1, backgroundColor: palette.line },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  messageAvatar: { width: 32, height: 32, borderRadius: 16, marginTop: 2, backgroundColor: palette.accentSoft, borderWidth: 1, borderColor: palette.line, overflow: 'hidden', alignItems: 'center' },
  messageBubble: { flex: 1, minWidth: 0, padding: 12, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, borderRadius: 14, borderTopLeftRadius: 3, gap: 4 },
  speaker: { fontFamily: 'DMSansBold', color: palette.accent },
});
