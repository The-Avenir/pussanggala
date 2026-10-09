import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../ui/theme';
import type { Preference } from './previewJourney';

export const PREFERENCES: readonly { value: Preference; label: string }[] = [
  { value: 'cheapest', label: 'Cheapest' }, { value: 'fastest', label: 'Fastest' },
  { value: 'fewest-transfers', label: 'Fewest transfers' },
];
export function PreferenceChips({ preference, onSelect }: {
  preference: Preference; onSelect: (preference: Preference) => void;
}): React.JSX.Element {
  return <View style={styles.chips}>{PREFERENCES.map(item =>
    <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: item.value === preference }} aria-selected={item.value === preference}
      onPress={() => onSelect(item.value)} style={[styles.chip, item.value === preference ? styles.selected : styles.idle]}>
      <Text style={[typography.caption, styles.ink]}>{item.label}</Text>
    </Pressable>)}</View>;
}
const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8 }, chip: { flex: 1, minHeight: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 5 },
  selected: { backgroundColor: colors.orangeSoft }, idle: { backgroundColor: colors.blueSoft }, ink: { color: colors.ink },
});
