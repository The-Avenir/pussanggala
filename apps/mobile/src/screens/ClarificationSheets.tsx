import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ListRow, palette, type, ui } from '../ui/travel';

// Walkthrough §4: clarification sheets open over the conversation, keep its context,
// and never auto-select — every outcome needs a user tap (INV-6).
export interface ClarifyCandidate { name: string; area: string; }
export interface NearbyCandidate { name: string; distance: string; }

// Synthetic NCR candidates for the design preview. The pack supplies real lists.
export const SAMPLE_PLACES: {
  ambiguous: readonly ClarifyCandidate[]; nearby: readonly NearbyCandidate[]; landmarks: readonly NearbyCandidate[];
} = {
  ambiguous: [
    { name: 'SM City North EDSA', area: 'Quezon City · near MRT-3 North Avenue' },
    { name: 'SM City Manila', area: 'Ermita, Manila · near LRT-1 Central' },
    { name: 'SM Southmall', area: 'Las Piñas · Alabang–Zapote Road' },
  ],
  nearby: [
    { name: 'LRT-1 Monumento', distance: '~40 m' },
    { name: 'SM City Grand Central', distance: '~260 m' },
    { name: 'MCU Hospital, Caloocan', distance: '~450 m' },
  ],
  landmarks: [
    { name: 'LRT-1 Monumento', distance: '~120 m' },
    { name: 'SM City Grand Central', distance: '~300 m' },
    { name: 'Caloocan City Hall', distance: '~700 m' },
  ],
};

// §4a "Which place?" — ambiguous alias or low-confidence/typo match.
export function PlaceClarifySheet({ candidates, onPick, onNone, didYouMean }: {
  candidates: readonly ClarifyCandidate[]; onPick: (index: number) => void; onNone: () => void; didYouMean?: string | undefined;
}): React.JSX.Element {
  return <View style={{ gap: 16 }}>
    <View style={{ gap: 6 }}>
      <Text accessibilityRole="header" style={type.heading}>{didYouMean ? 'Did you mean…?' : 'Which place?'}</Text>
      <Text style={type.secondary}>{didYouMean
        ? 'I can’t find “' + didYouMean + '”. Pick the supported place you meant:'
        : 'That name matches a few supported places. Pick one — I won’t guess.'}</Text>
    </View>
    <View>
      {candidates.map((candidate, index) => <ListRow key={candidate.name} title={candidate.name} detail={candidate.area}
        icon="pin" onPress={() => onPick(index)}/>)}
      <ListRow title="None of these" detail="Type a nearby supported landmark instead" icon="close" onPress={onNone}/>
    </View>
  </View>;
}

// §4b "Start from here?" — after Use my location; always a tap, never a guess.
export function LocationConfirmSheet({ places, fixAge, accuracy, rough = false, onConfirm, onDismiss }: {
  places: readonly NearbyCandidate[]; fixAge?: string | undefined; accuracy?: string | undefined; rough?: boolean;
  onConfirm: (place: NearbyCandidate) => void; onDismiss: () => void;
}): React.JSX.Element {
  const [selected, setSelected] = useState<number | null>(null);
  const fix = [accuracy ? '±' + accuracy : null, fixAge ? 'fix ' + fixAge : null].filter(Boolean).join(' · ');
  return <View style={{ gap: 16 }}>
    <View style={{ gap: 6 }}>
      <Text accessibilityRole="header" style={type.heading}>{rough ? 'Pick your starting point' : 'Start from here?'}</Text>
      <Text style={type.secondary}>{rough
        ? 'Location is rough (' + (accuracy ? '±' + accuracy : '±300 m') + '). Pick your starting point.'
        : 'Nearest supported places to your location:'}</Text>
    </View>
    <View accessibilityRole="radiogroup" accessibilityLabel="Nearby supported places">
      {places.map((place, index) => <Pressable key={place.name} accessibilityRole="radio"
        accessibilityLabel={place.name + ', ' + place.distance + ' away'} accessibilityState={{ checked: selected === index }}
        aria-checked={selected === index} onPress={() => setSelected(index)}
        style={({ pressed }) => [styles.pickRow, pressed && ui.pressed, selected === index && styles.picked]}>
        <View style={styles.radio}>{selected === index ? <View style={styles.radioDot}/> : null}</View>
        <View style={ui.flex}><Text style={type.body}>{place.name}</Text>
          <Text style={type.secondary}>{'Within ' + place.distance + (!rough && fix ? ' · ' + fix : '')}</Text></View>
      </Pressable>)}
    </View>
    <Button label="Start from here" disabled={selected === null}
      onPress={() => { if (selected !== null) onConfirm(places[selected]!); }}/>
    <Button variant="text" label="Not now" onPress={onDismiss}/>
  </View>;
}

// §4c "Nearest supported landmark" — typed address has no routes; offer known landmarks.
export function NearbyLandmarkSheet({ places, onPick, onDismiss }: {
  places: readonly NearbyCandidate[]; onPick: (index: number) => void; onDismiss: () => void;
}): React.JSX.Element {
  return <View style={{ gap: 16 }}>
    <View style={{ gap: 6 }}>
      <Text accessibilityRole="header" style={type.heading}>Nearby supported landmark</Text>
      <Text style={type.body}>I don’t have routes from that exact address. Pick a nearby landmark I know:</Text>
    </View>
    <View>{places.map((place, index) => <ListRow key={place.name} title={place.name} detail={place.distance + ' away'}
      icon="pin" onPress={() => onPick(index)}/>)}</View>
    <Button variant="text" label="Not now" onPress={onDismiss}/>
  </View>;
}

const styles = StyleSheet.create({
  pickRow: { minHeight: 64, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderBottomWidth: 1, borderBottomColor: palette.line, borderRadius: 12, paddingHorizontal: 4 },
  picked: { backgroundColor: palette.accentSoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: palette.secondary, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accent },
});
