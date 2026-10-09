import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Assets from '../ui/assets';
import { Action, Card, FactRow, StatusChip } from '../ui/components';
import { colors, typography } from '../ui/theme';
import { ScaledArtwork } from '../ui/ScaledArtwork';
import { PreferenceChips } from './Preferences';
import { rankedPreviewRoutes } from './previewJourney';
import type { Preference, PreviewRoute, PreviewStep } from './previewJourney';

export function TripSummary({ route }: { route: PreviewRoute }): React.JSX.Element {
  return <View style={styles.summary}>
    {[{ value: route.fare, label: 'reported fare' }, { value: route.time, label: 'reported time' },
      { value: String(route.transfers), label: 'transfers' }].map(item =>
      <View key={item.label} style={styles.summaryItem}><Text style={typography.label}>{item.value}</Text>
        <Text style={typography.caption}>{item.label}</Text></View>)}
  </View>;
}

export function RouteOptionsScreen({ selected, preference, onSelect, onPreference }: {
  selected: PreviewRoute; preference: Preference; onSelect: (route: PreviewRoute) => void;
  onPreference: (preference: Preference) => void;
}): React.JSX.Element {
  return <View style={styles.screen}>
    <StatusChip Icon={Assets.OrangePin} label="Monumento → One Ayala · example" />
    <Text style={typography.title}>Your trip, your way.</Text>
    <Text style={[typography.body, styles.muted]}>Choose what matters most today.</Text>
    <PreferenceChips preference={preference} onSelect={onPreference} />
    {rankedPreviewRoutes(preference).map((route, index) => {
      const Icon = route.transfers === 0 ? Assets.BluePin : index === 0 && preference === 'fastest' ? Assets.Bolt : Assets.OrangeBus;
      return <Pressable key={route.id} accessibilityRole="radio" accessibilityState={{ checked: selected.id === route.id }} aria-checked={selected.id === route.id}
        onPress={() => onSelect(route)}>
        <Card tone={selected.id === route.id ? 'orangeSoft' : 'white'}>
          <View style={styles.optionHeader}><Icon /><Text style={[typography.heading, styles.flex]}>{route.title}</Text>
            <View style={[styles.radio, selected.id === route.id && styles.radioSelected]} /></View>
          <Text style={typography.title}>{route.fare}</Text>
          <Text style={typography.caption}>{route.time} · {route.transfers} transfers</Text>
          {route.badges.length > 0 ? <Text style={[typography.caption, styles.orange]}>{route.badges.join(' · ')}</Text> : null}
        </Card>
      </Pressable>;
    })}
    <Text style={typography.caption}>Compared among 3 walkthrough examples. Reported time ranges overlap.</Text>
    <Card tone="surface"><Text style={typography.caption}>Example values are not pack data. In the app, fares and times are community-reported as of the dates shown. Check signboards and ask the driver before boarding.</Text></Card>
  </View>;
}

function Signboard({ step }: { step: PreviewStep }): React.JSX.Element | null {
  if (!step.signboard) return null;
  return <Card tone="blueSoft"><Text style={[typography.caption, styles.blue]}>LOOK FOR THIS SIGNBOARD</Text>
    <Text style={typography.heading}>{step.signboard}</Text>
    <Text style={typography.caption}>Confirm that the ride passes your alighting stop before you board.</Text></Card>;
}

export function RouteStepsScreen({ route, stepIndex, onStep, onMap, onSave }: {
  route: PreviewRoute; stepIndex: number; onStep: (index: number) => void;
  onMap: () => void; onSave: () => void;
}): React.JSX.Element {
  const step = route.steps[stepIndex]!;
  const nextRide = step.mode === 'walk' ? route.steps.slice(stepIndex + 1).find(item => item.mode === 'ride') : undefined;
  return <View style={styles.screen}>
    <StatusChip Icon={Assets.OrangePin} label="Monumento → One Ayala · example" />
    <ScaledArtwork width={350} height={180}><Assets.BusIllustration /></ScaledArtwork>
    <Card><FactRow Icon={step.mode === 'walk' ? Assets.Walk : Assets.OrangeBus} title={step.title} subtitle={step.subtitle} />
      <Text style={typography.body}>{step.instruction}</Text></Card>
    <Signboard step={step} />
    {nextRide ? <><Text style={typography.caption}>Next ride</Text><Signboard step={nextRide} /></> : null}
    <Text style={typography.label}>Local tip</Text>
    <Text style={typography.body}>Check the signboard and confirm your alighting point with the driver or station staff.</Text>
    <Text style={typography.caption}>Walkthrough example · dates and source links require the installed pack</Text>
    <View style={styles.stepPicker}>{route.steps.map((item, index) => <Pressable key={item.id}
      accessibilityRole="button" accessibilityLabel={`Show step ${index + 1}`} accessibilityState={{ selected: index === stepIndex }} aria-selected={index === stepIndex}
      onPress={() => onStep(index)} style={[styles.stepNumber, index === stepIndex && styles.stepSelected]}>
      <Text style={[typography.label, index === stepIndex && styles.white]}>{index + 1}</Text>
    </Pressable>)}</View>
    <View style={styles.row}><Action secondary label="Map / Schematic" onPress={onMap} style={styles.flex} />
      <Action secondary label="☆ Save" onPress={onSave} style={styles.flex} /></View>
  </View>;
}

export function StopDiagram({ route, currentStep, compact = false }: { route: PreviewRoute; currentStep?: number; compact?: boolean }): React.JSX.Element {
  const start = compact ? currentStep ?? 0 : 0;
  const steps = compact ? route.steps.slice(start, start + 2) : route.steps;
  return <Card style={styles.diagram}>{steps.map((step, index) =>
    <View key={step.id} style={styles.stop}>
      {index === steps.length - 1 ? <Assets.EndRail /> : <Assets.Rail />}
      <View style={styles.stopText}><Text style={[typography.heading, currentStep === start + index && styles.orange]}>{step.stop}</Text>
        <Text style={typography.caption}>{step.mode === 'walk' ? 'Reported walk / transfer' : 'Reported ride · alighting point'}</Text></View>
    </View>)}
  </Card>;
}

// This artwork is retained exactly from Figma, not used as geographic evidence.
// Neither the painted route line nor blue dot represents the selected journey/GPS.
export function IllustrativeMap({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return <ScaledArtwork width={350} height={compact ? 270 : 370}>
    <View style={styles.mapArtwork} accessibilityLabel="Design illustration only, not a navigable map or GPS position">
    {compact ? <Assets.ActiveMapIllustration /> : <Assets.MapIllustration />}
    <View style={styles.artLabel}><Text style={typography.label}>Design illustration</Text>
      <Text style={typography.caption}>Not a route path or your position</Text></View>
    <View style={styles.artFooter}><Text style={typography.caption}>Example artwork · not geographic data</Text></View>
    </View>
  </ScaledArtwork>;
}

export function RouteMapScreen({ route, schematic, onMode, onLocation }: {
  route: PreviewRoute | null; schematic: boolean; onMode: (schematic: boolean) => void;
  onLocation: () => void;
}): React.JSX.Element {
  if (schematic) return <View style={styles.screen}>
    <StatusChip Icon={Assets.OrangeMap} label="Using the stop diagram" />
    <Text style={typography.title}>Every stop, simply.</Text>
    <Text style={[typography.body, styles.muted]}>The stop diagram works even when street map resources aren’t available.</Text>
    <MapMode schematic onMode={onMode} />
    {route ? <StopDiagram route={route} /> : <Card><Text style={typography.body}>Choose a journey in Ask to see its stop order.</Text></Card>}
    <Text style={typography.caption}>Stop order only · distances are not to scale.</Text>
  </View>;
  return <View style={styles.screen}>
    <StatusChip Icon={Assets.GreenMap} label="Map unavailable · design preview" tone="green" />
    <IllustrativeMap />
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onLocation} style={styles.mapControl}><Assets.BlueTarget /><Text style={typography.caption}>Location</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => onMode(true)} style={styles.mapControl}><Assets.Layers /><Text style={typography.caption}>Stop diagram</Text></Pressable>
    </View>
    {route ? <Card><FactRow Icon={Assets.OrangeBus} title={route.title} subtitle="Monumento → One Ayala · example" />
      <Text style={typography.caption}>See the stop diagram for the example journey. The illustration above does not show this route.</Text></Card> : null}
    <Text style={typography.caption}>The local NCR basemap is not installed in this preview. No online map is loaded.</Text>
  </View>;
}
function MapMode({ schematic, onMode }: { schematic: boolean; onMode: (schematic: boolean) => void }): React.JSX.Element {
  return <View style={styles.mode}>{[{ label: 'Map view', value: false }, { label: 'Schematic', value: true }].map(item =>
    <Pressable key={item.label} accessibilityRole="button" accessibilityState={{ selected: item.value === schematic }} aria-selected={item.value === schematic}
      onPress={() => onMode(item.value)} style={[styles.modeTab, item.value === schematic && styles.modeSelected]}>
      <Text style={[typography.label, item.value === schematic ? styles.white : styles.muted]}>{item.label}</Text>
    </Pressable>)}</View>;
}

export function ActiveTripScreen({ route, stepIndex, onEnd, onAsk, onSteps }: {
  route: PreviewRoute; stepIndex: number;
  onEnd: () => void; onAsk: () => void; onSteps: () => void;
}): React.JSX.Element {
  const [showArt, setShowArt] = useState(false);
  const step = route.steps[stepIndex]!;
  return <View style={styles.screen}>
    <StatusChip Icon={Assets.GreenTarget} label="Location off · manual progress" tone="green" />
    <Card><Text style={typography.heading}>On the way to One Ayala</Text>
      <Text style={[typography.body, styles.muted]}>Step {stepIndex + 1} of {route.steps.length}</Text>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: route.steps.length, now: stepIndex + 1 }} style={styles.progress}>
        <View style={[styles.progressFill, { width: `${(stepIndex + 1) / route.steps.length * 100}%` }]} />
      </View><TripSummary route={route} /></Card>
    <Card><FactRow Icon={step.mode === 'walk' ? Assets.Walk : Assets.OrangeBus} title={step.title} subtitle={step.subtitle} />
      <Text style={typography.body}>{step.instruction}</Text></Card>
    <Signboard step={step} />
    {route.steps[stepIndex + 1] ? <Text style={typography.caption}>Next: {route.steps[stepIndex + 1]!.title}</Text> : null}
    {showArt ? <IllustrativeMap compact /> : <StopDiagram route={route} currentStep={stepIndex} compact />}
    <Pressable accessibilityRole="button" onPress={() => setShowArt(!showArt)} style={styles.link}>
      <Text style={typography.caption}>{showArt ? 'Show stop diagram' : 'View design illustration'}</Text></Pressable>
    <Card tone="blueSoft"><View style={styles.row}><Assets.PositionCat /><View style={styles.flex}>
      <Text style={typography.label}>Follow your trip, one step at a time.</Text>
      <Text style={typography.caption}>Keep the app open to see your position when location is available. Tap Next when you reach each point.</Text>
    </View></View></Card>
    <Text style={typography.caption}>Example journey · GPS and restart recovery are not connected in this preview.</Text>
    <Action secondary label="Ask about this trip" onPress={onAsk} />
    <Action secondary label="View all steps" onPress={onSteps} />
    <Action secondary label="Stop trip" onPress={onEnd} />
  </View>;
}

export function TripCompleteScreen({ onDone, onSave, onReturn }: {
  onDone: () => void; onSave: () => void; onReturn: () => void;
}): React.JSX.Element {
  return <View style={styles.screen}><View style={styles.completeCat}><Assets.WelcomeCat /></View>
    <Text style={typography.display}>Nakarating ka!</Text>
    <Text style={typography.body}>Monumento → One Ayala</Text>
    <Text style={typography.caption}>Example journey complete · steps confirmed by you</Text>
    <Action label="☆ Save this route" onPress={onSave} />
    <Action secondary label="Plan return trip →" onPress={onReturn} />
    <Action secondary label="Done" onPress={onDone} /></View>;
}

const styles = StyleSheet.create({
  screen: { gap: 16 }, flex: { flex: 1 }, row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  muted: { color: colors.muted }, orange: { color: colors.orange }, blue: { color: colors.blue }, white: { color: colors.white },
  summary: { flexDirection: 'row', gap: 12, paddingTop: 6 }, summaryItem: { flex: 1, gap: 1 },
  optionHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  radio: { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: colors.muted },
  radioSelected: { backgroundColor: colors.orange, borderColor: colors.orange },
  stepPicker: { flexDirection: 'row', gap: 10 }, stepNumber: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.orangeSoft },
  stepSelected: { backgroundColor: colors.orange },
  diagram: { padding: 20, gap: 0 }, stop: { flexDirection: 'row', gap: 16, minHeight: 78 },
  stopText: { flex: 1, paddingTop: 16, gap: 4 },
  mapArtwork: { alignSelf: 'center', width: 350, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.map },
  artLabel: { position: 'absolute', left: 64, top: 44, backgroundColor: colors.white, padding: 8, borderRadius: 8 },
  artFooter: { position: 'absolute', bottom: 12, left: 12, right: 12, padding: 8, backgroundColor: colors.white, borderRadius: 8 },
  mapControl: { flex: 1, minHeight: 44, backgroundColor: colors.white, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  mode: { flexDirection: 'row', borderRadius: 24, backgroundColor: colors.white },
  modeTab: { flex: 1, borderRadius: 16, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  modeSelected: { backgroundColor: colors.ink },
  progress: { height: 6, borderRadius: 4, backgroundColor: colors.orangeSoft, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.green, borderRadius: 4 },
  link: { minHeight: 44, justifyContent: 'center' }, completeCat: { alignItems: 'center', backgroundColor: colors.orangeSoft, borderRadius: 20 },
});
