import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Gaile, IconButton, ListRow, Section, palette, type, ui } from '../ui/travel';

export function EndpointFields({ origin, destination, onEdit, onSwap }: {
  origin: string; destination: string; onEdit: (slot: 'origin' | 'destination') => void; onSwap: () => void;
}): React.JSX.Element {
  return <View style={styles.endpoints}>
    <View style={ui.flex}>{(['origin', 'destination'] as const).map((slot, index) =>
      <Pressable key={slot} accessibilityRole="button" accessibilityLabel={'Edit ' + (slot === 'origin' ? 'starting point' : 'destination')}
        onPress={() => onEdit(slot)} style={[styles.endpoint, index === 0 && styles.endpointRule]}>
        <View style={[styles.point, index === 1 && styles.destination]}/>
        <View style={ui.flex}><Text style={type.caption}>{slot === 'origin' ? 'From' : 'To'}</Text>
          <Text style={[type.label, !(slot === 'origin' ? origin : destination) && styles.placeholder]}>
            {(slot === 'origin' ? origin : destination) || (slot === 'origin' ? 'Starting landmark' : 'Where to?')}</Text></View>
      </Pressable>)}</View>
    <IconButton name="swap" label="Swap starting point and destination" onPress={onSwap}/>
  </View>;
}
// Manual place selection (F1 fallback), pushed from the Ask empty state.
export function PlanScreen({ origin, destination, onEdit, onSwap, onFind, onExample, onResources, onLocation }: {
  origin: string; destination: string; onEdit: (slot: 'origin' | 'destination') => void; onSwap: () => void;
  onFind: () => void; onExample: () => void; onResources: () => void; onLocation: () => void;
}): React.JSX.Element {
  return <View style={ui.screen}>
    <View style={styles.greeting}><View style={styles.greetingText}><Text style={[type.caption, styles.eyebrow]}>MANUAL ENTRY</Text>
      <Text accessibilityRole="header" style={type.title}>Plan with landmarks</Text>
      <Text style={type.secondary}>Pick a supported starting landmark and destination inside Metro Manila.</Text></View>
      <Gaile pose="map" height={110}/></View>
    <EndpointFields origin={origin} destination={destination} onEdit={onEdit} onSwap={onSwap}/>
    <Button label="Find routes" icon="arrow" onPress={onFind}/>
    <Button label="Use my location" icon="location" variant="text" onPress={onLocation}/>
    <Section title="QUICK LINKS"><ListRow title="Try an example journey" detail="Monumento → One Ayala · design walkthrough" icon="bus" onPress={onExample}/>
      <ListRow title="Offline resources" detail="See what’s available on this phone" icon="map" onPress={onResources}/></Section>
    <Text style={type.caption}>The route pack isn’t installed in this preview, so manual entry keeps your input without guessing a place.</Text>
  </View>;
}
const styles = StyleSheet.create({
  greeting: { marginHorizontal: -20, marginTop: -24, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: palette.gold,
    borderBottomWidth: 7, borderBottomColor: palette.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  greetingText: { flex: 1, minWidth: 175, gap: 8 },
  eyebrow: { color: palette.ink, fontWeight: '700', letterSpacing: 1.2 },
  endpoints: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 16, backgroundColor: palette.paper, paddingHorizontal: 14 },
  endpoint: { minHeight: 72, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  endpointRule: { borderBottomWidth: 1, borderBottomColor: palette.line },
  point: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: palette.secondary },
  destination: { backgroundColor: palette.accent, borderColor: palette.accent, borderRadius: 2 },
  placeholder: { color: palette.secondary },
});
