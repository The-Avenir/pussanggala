import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Icon, IconButton, ListRow, Section, palette, type, ui } from '../ui/travel';

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
export function PlanScreen({ origin, destination, onEdit, onSwap, onFind, onAsk, onExample, onResources, onLocation, onIntro }: {
  origin: string; destination: string; onEdit: (slot: 'origin' | 'destination') => void; onSwap: () => void;
  onFind: () => void; onAsk: () => void; onExample: () => void; onResources: () => void; onLocation: () => void; onIntro: () => void;
}): React.JSX.Element {
  return <View style={ui.screen}>
    <View style={{ gap: 8 }}><Text style={[type.caption, styles.eyebrow]}>METRO MANILA</Text>
      <Text accessibilityRole="header" style={type.display}>Saan tayo?</Text>
      <Text style={type.secondary}>Plan your next NCR commute.</Text></View>
    <View style={{ gap: 12 }}><EndpointFields origin={origin} destination={destination} onEdit={onEdit} onSwap={onSwap}/>
      <Button label="Find routes" icon="arrow" onPress={onFind}/>
      <Button label="Use my location" icon="location" variant="text" onPress={onLocation}/></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Ask Pusang Gala" onPress={onAsk} style={styles.ask}>
      <Icon name="chat" color={palette.accent}/><View style={ui.flex}>
        <Text style={type.heading}>Ask Pusang Gala</Text><Text style={type.secondary}>Your commute questions, in Taglish or English.</Text>
      </View><Icon name="arrow" color={palette.accent}/>
    </Pressable>
    <Section title="BEFORE YOU GO"><ListRow title="Offline resources" detail="Route data, assistant and basemap unavailable" icon="map" onPress={onResources}/>
      <ListRow title="Try an example journey" detail="Monumento → One Ayala · design walkthrough" icon="bus" onPress={onExample}/>
      <ListRow title="How Pusang Gala works" icon="info" onPress={onIntro}/></Section>
  </View>;
}
const styles = StyleSheet.create({
  eyebrow: { color: palette.accent, fontWeight: '700', letterSpacing: 1.6 },
  endpoints: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 12, backgroundColor: palette.paper, paddingHorizontal: 14 },
  endpoint: { minHeight: 72, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  endpointRule: { borderBottomWidth: 1, borderBottomColor: palette.line },
  point: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: palette.secondary },
  destination: { backgroundColor: palette.accent, borderColor: palette.accent, borderRadius: 2 },
  placeholder: { color: palette.secondary },
  ask: { flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, paddingVertical: 22 },
});
