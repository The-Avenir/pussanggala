import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { colors, typography } from './theme';

export function Action({ label, onPress, secondary = false, disabled = false, style }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} aria-disabled={disabled} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.action, secondary ? styles.secondary : styles.primary,
      (pressed || disabled) && styles.dimmed, style]}>
    <Text style={[typography.label, !secondary && styles.white]}>{label}</Text>
  </Pressable>;
}

export function Card({ children, tone = 'white', style }: {
  children: ReactNode; tone?: 'white' | 'orangeSoft' | 'blueSoft' | 'surface'; style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return <View style={[styles.card, { backgroundColor: colors[tone] }, style]}>{children}</View>;
}

export function StatusChip({ label, Icon, tone = 'orange' }: {
  label: string; Icon: ComponentType<SvgProps>; tone?: 'orange' | 'green' | 'blue';
}): React.JSX.Element {
  const backgroundColor = tone === 'green' ? colors.greenSoft : tone === 'blue' ? colors.blueSoft : colors.orangeSoft;
  return <View style={[styles.status, { backgroundColor }]}>
    <Icon /><Text style={[typography.caption, { color: colors[tone], flex: 1 }]}>{label}</Text>
  </View>;
}

export function FactRow({ Icon, title, subtitle }: {
  Icon: ComponentType<SvgProps>; title: string; subtitle: string;
}): React.JSX.Element {
  return <View style={styles.fact}><Icon /><View style={styles.factText}>
    <Text style={typography.label}>{title}</Text><Text style={typography.caption}>{subtitle}</Text>
  </View></View>;
}

export function FeatureRow({ Icon, title, subtitle }: {
  Icon: ComponentType<SvgProps>; title: string; subtitle: string;
}): React.JSX.Element {
  return <View style={styles.feature}><View style={styles.tile}><Icon /></View>
    <View style={styles.factText}><Text style={typography.label}>{title}</Text>
      <Text style={typography.caption}>{subtitle}</Text></View>
  </View>;
}

export function SettingsRow({ Icon, title, subtitle, onPress }: {
  Icon: ComponentType<SvgProps>; title: string; subtitle: string; onPress: () => void;
}): React.JSX.Element {
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.settingsRow, pressed && styles.dimmed]}>
    <Icon /><View style={styles.factText}><Text style={typography.label}>{title}</Text>
      <Text style={typography.caption}>{subtitle}</Text></View><Text style={typography.heading}>›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  action: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  primary: { backgroundColor: colors.orange },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  white: { color: colors.white }, dimmed: { opacity: 0.6 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 10 },
  status: { minHeight: 34, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  factText: { flex: 1, gap: 3 },
  feature: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: { width: 48, height: 48, borderRadius: 20, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  settingsRow: { minHeight: 74, borderRadius: 20, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
});
