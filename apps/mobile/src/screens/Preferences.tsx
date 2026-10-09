import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, type } from '../ui/travel';
import type { Preference } from './previewJourney';

export const PREFERENCES: readonly { value: Preference; label: string }[] = [
  { value: 'cheapest', label: 'Fare' }, { value: 'fastest', label: 'Time' },
  { value: 'fewest-transfers', label: 'Transfers' },
];
export function PreferenceChips({ preference, onSelect }: {
  preference: Preference; onSelect: (preference: Preference) => void;
}): React.JSX.Element {
  return <View accessibilityLabel="Sort routes by reported values" style={styles.control}>{PREFERENCES.map(item =>
    <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={'Sort by ' + item.label.toLowerCase()}
      accessibilityState={{ selected: item.value === preference }} aria-selected={item.value === preference}
      onPress={() => onSelect(item.value)} style={[styles.segment, item.value === preference && styles.selected]}>
      <Text style={[type.label, styles.text, item.value === preference && styles.active]}>{item.label}</Text>
    </Pressable>)}</View>;
}
const styles = StyleSheet.create({
  control: { flexDirection: 'row', backgroundColor: palette.background, borderRadius: 10, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', padding: 8, borderRadius: 8 },
  selected: { backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line },
  text: { color: palette.secondary }, active: { color: palette.accent },
});
