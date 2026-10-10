import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Gaile, GaileMessage, Icon, IconButton, ListRow, Section, palette, type, ui } from '../ui/travel';
import { LandmarkSketch } from '../ui/LandmarkSketch';

export function EndpointFields({ origin, destination, onEdit, onSwap }: {
  origin: string; destination: string; onEdit: (slot: 'origin' | 'destination') => void; onSwap: () => void;
}): React.JSX.Element {
  return <View style={styles.endpoints}>
    <View style={ui.flex}>{(['origin', 'destination'] as const).map((slot, index) =>
      <Pressable key={slot} accessibilityRole="button" accessibilityLabel={'Edit ' + (slot === 'origin' ? 'starting point' : 'destination')}
        onPress={() => onEdit(slot)} style={[styles.endpoint, index === 0 && styles.endpointRule]}>
        <Icon name="pin" color={slot === 'origin' ? palette.success : palette.accent} size={21}/>
        <View style={ui.flex}><Text style={type.caption}>{slot === 'origin' ? 'From · starting landmark' : 'To · destination'}</Text>
          <Text style={[type.heading, !(slot === 'origin' ? origin : destination) && styles.placeholder]}>
            {(slot === 'origin' ? origin : destination) || (slot === 'origin' ? 'Choose your starting point' : 'Where are we heading?')}</Text></View>
      </Pressable>)}</View>
    <IconButton name="swap" label="Swap starting point and destination" onPress={onSwap}/>
  </View>;
}
const destinations = [
  { name: 'One Ayala', area: 'Makati', scene: 'ayala', tint: palette.accentSoft, query: 'Paano pumunta sa One Ayala?' },
  { name: 'SM North EDSA', area: 'Quezon City', scene: 'north', tint: palette.successSoft, query: 'Paano pumunta sa SM North EDSA?' },
  { name: 'Cubao', area: 'Quezon City', scene: 'cubao', tint: palette.railSoft, query: 'Paano pumunta sa Cubao?' },
  { name: 'Intramuros', area: 'Manila', scene: 'heritage', tint: palette.goldSoft, query: 'Paano pumunta sa Intramuros?' },
] as const;
export function PlanScreen({ origin, destination, landmarksOpen, onLandmarksOpen, onEdit, onSwap, onFind, onExample, onResources, onLocation, onIntro, onSuggestion }: {
  origin: string; destination: string; onEdit: (slot: 'origin' | 'destination') => void; onSwap: () => void;
  landmarksOpen: boolean; onLandmarksOpen: (open: boolean) => void;
  onFind: () => void; onExample: () => void; onResources: () => void; onLocation: () => void; onIntro: () => void;
  onSuggestion: (query: string) => void;
}): React.JSX.Element {
  return <View style={ui.screen}>
    <View style={styles.greeting}><View style={styles.greetingText}>
      <Text accessibilityRole="header" style={type.title}>Kumusta, gala?</Text>
      <Text style={type.secondary}>Ako si Gaile. Samahan kita, one step at a time.</Text>
    </View><Gaile pose="map" height={108}/></View>
    <GaileMessage pose="think"><Text accessibilityRole="header" accessibilityLabel="Where to go?" style={type.body}>Saan tayo punta? Tell me a place, or check your landmarks below.</Text></GaileMessage>
    <View style={styles.planner}>
      <Pressable accessibilityRole="button" accessibilityLabel="Enter landmarks" accessibilityState={{ expanded: landmarksOpen }} aria-expanded={landmarksOpen}
        onPress={() => onLandmarksOpen(!landmarksOpen)} style={({ pressed }) => [styles.disclosure, pressed && ui.pressed]}>
        <Text style={[type.label, ui.flex]}>Plan with landmarks</Text><Icon name={landmarksOpen ? 'minus' : 'plus'} color={palette.accent} size={18}/>
      </Pressable>
      {landmarksOpen ? <View style={styles.landmarks}>
        <EndpointFields origin={origin} destination={destination} onEdit={onEdit} onSwap={onSwap}/>
        <Button label="Use my location" icon="location" variant="secondary" onPress={onLocation}/>
        <Button label="Find routes" icon="arrow" onPress={onFind}/>
      </View> : <Text style={type.caption}>You can also ask Gaile in the chat below.</Text>}
    </View>
    <View style={styles.suggestions}><Text style={[type.caption, styles.eyebrow]}>A FEW PLACES TO EXPLORE</Text>
      <View style={styles.destinationGrid}>{destinations.map(place =>
        <Pressable key={place.name} accessibilityRole="button" accessibilityLabel={place.query} onPress={() => onSuggestion(place.query)}
          style={({ pressed }) => [styles.destinationTile, pressed && ui.pressed]}>
          <View style={{ backgroundColor: place.tint }}><LandmarkSketch scene={place.scene}/></View>
          <View style={styles.destinationDetail}><Text style={type.label}>{place.name}</Text><Text style={type.caption}>{place.area}</Text></View>
        </Pressable>)}</View>
      <Button label="Saan ako bababa?" variant="text" icon="chat" onPress={() => onSuggestion('Saan ako bababa?')}/>
    </View>
    <Section title="MORE FOR YOUR JOURNEY"><ListRow title="Try an example journey" detail="Monumento → One Ayala · design walkthrough" icon="bus" onPress={onExample}/>
      <ListRow title="Offline resources" detail="See what’s available on this phone" icon="map" onPress={onResources}/>
      <ListRow title="How Pusang Gala works" icon="info" onPress={onIntro}/></Section>
  </View>;
}
const styles = StyleSheet.create({
  greeting: { padding: 16, minHeight: 126, backgroundColor: palette.accentSoft, borderWidth: 1, borderColor: palette.line, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  greetingText: { flex: 1, minWidth: 0, gap: 8 },
  planner: { borderWidth: 1, borderColor: palette.line, borderRadius: 14, padding: 12, backgroundColor: palette.card, gap: 8 },
  disclosure: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  landmarks: { gap: 10 },
  endpoints: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.card },
  endpoint: { minHeight: 68, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  endpointRule: { borderBottomWidth: 1, borderBottomColor: palette.line },
  placeholder: { color: palette.secondary, fontSize: 16, lineHeight: 22 },
  suggestions: { gap: 8 }, eyebrow: { letterSpacing: 1, fontFamily: 'DMSansBold' },
  destinationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  destinationTile: { flexBasis: '45%', flexGrow: 1, minWidth: 0, overflow: 'hidden', borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, borderRadius: 14 },
  destinationDetail: { padding: 10, gap: 2 },
});
