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
export function PlanScreen({ origin, destination, landmarksOpen, onLandmarksOpen, onEdit, onSwap, onFind, onExample, onResources, onLocation, onIntro, onSuggestion }: {
  origin: string; destination: string; onEdit: (slot: 'origin' | 'destination') => void; onSwap: () => void;
  landmarksOpen: boolean; onLandmarksOpen: (open: boolean) => void;
  onFind: () => void; onExample: () => void; onResources: () => void; onLocation: () => void; onIntro: () => void;
  onSuggestion: (query: string) => void;
}): React.JSX.Element {
  return <View style={ui.screen}>
    <View style={styles.greeting}><View style={styles.greetingText}><Text style={[type.caption, styles.eyebrow]}>YOUR NCR COMMUTE COMPANION</Text>
      <Text accessibilityRole="header" accessibilityLabel="Where to go?" style={type.display}>Where to go?</Text>
      <Text style={type.secondary}>Tell Gaile where you’re headed.</Text></View><Gaile pose="map" height={164}/></View>
    <View style={styles.intro}><View style={styles.avatar}><Gaile pose="idle" height={46}/></View>
      <View style={ui.flex}><Text style={type.heading}>Hi, I’m Gaile!</Text>
        <Text style={type.secondary}>Ask about a commute in Taglish or English.</Text></View></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Enter landmarks" accessibilityState={{ expanded: landmarksOpen }} aria-expanded={landmarksOpen}
      onPress={() => onLandmarksOpen(!landmarksOpen)} style={({ pressed }) => [styles.disclosure, pressed && ui.pressed]}>
      <View style={ui.flex}><Text style={type.label}>Enter landmarks</Text>
        <Text style={type.caption}>{landmarksOpen ? 'Type your starting point and destination' : 'Prefer to plan with From and To?'}</Text></View>
      <Text style={styles.disclosureIcon}>{landmarksOpen ? '−' : '+'}</Text>
    </Pressable>
    {landmarksOpen ? <View style={styles.landmarks}>
      <EndpointFields origin={origin} destination={destination} onEdit={onEdit} onSwap={onSwap}/>
      <Button label="Find routes" icon="arrow" onPress={onFind}/>
      <Button label="Use my location" icon="location" variant="text" onPress={onLocation}/>
    </View> : null}
    <View style={styles.suggestions}>
      <Text style={[type.caption, styles.eyebrow]}>ASK A QUICK QUESTION</Text>
      <View style={styles.suggestionRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Paano pumunta sa One Ayala?" onPress={() => onSuggestion('Paano pumunta sa One Ayala?')}
          style={({ pressed }) => [styles.suggestion, pressed && ui.pressed]}>
          <Text style={[type.secondary, styles.suggestionText]}>Paano pumunta sa One Ayala?</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Saan ako bababa?" onPress={() => onSuggestion('Saan ako bababa?')}
          style={({ pressed }) => [styles.suggestion, pressed && ui.pressed]}>
          <Text style={[type.secondary, styles.suggestionText]}>Saan ako bababa?</Text>
        </Pressable>
      </View>
    </View>
    <Section title="QUICK LINKS"><ListRow title="Try an example journey" detail="Monumento → One Ayala · design walkthrough" icon="bus" onPress={onExample}/>
      <ListRow title="Offline resources" detail="See what’s available on this phone" icon="map" onPress={onResources}/>
      <ListRow title="How Pusang Gala works" icon="info" onPress={onIntro}/></Section>
  </View>;
}
const styles = StyleSheet.create({
  greeting: { marginHorizontal: -20, marginTop: -24, paddingHorizontal: 20, paddingVertical: 20, minHeight: 220, backgroundColor: palette.gold,
    borderBottomWidth: 7, borderBottomColor: palette.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  greetingText: { flex: 1, minWidth: 175, gap: 8 },
  eyebrow: { color: palette.ink, fontWeight: '700', letterSpacing: 1.2 },
  intro: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.goldSoft, padding: 14, borderRadius: 20 },
  avatar: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 27, backgroundColor: palette.paper },
  disclosure: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: palette.line, borderRadius: 16,
    backgroundColor: palette.paper, flexDirection: 'row', alignItems: 'center', gap: 12 },
  disclosureIcon: { color: palette.accent, fontSize: 28, lineHeight: 32, paddingHorizontal: 5 },
  landmarks: { gap: 12, padding: 14, backgroundColor: palette.background, borderRadius: 18 },
  suggestions: { gap: 8 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestion: { maxWidth: '100%', minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, justifyContent: 'center', borderRadius: 16,
    backgroundColor: palette.background, borderWidth: 1, borderColor: palette.line },
  suggestionText: { color: palette.ink },
  endpoints: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 16, backgroundColor: palette.paper, paddingHorizontal: 14 },
  endpoint: { minHeight: 72, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  endpointRule: { borderBottomWidth: 1, borderBottomColor: palette.line },
  point: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: palette.secondary },
  destination: { backgroundColor: palette.accent, borderColor: palette.accent, borderRadius: 2 },
  placeholder: { color: palette.secondary },
});
