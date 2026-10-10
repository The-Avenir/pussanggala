import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Gaile, Icon, IconButton, Notice, palette, type, ui } from '../ui/travel';
import { PreferenceChips } from './Preferences';
import { rankedPreviewRoutes } from './previewJourney';
import type { Preference, PreviewRoute, PreviewStep } from './previewJourney';

export function TripSummary({ route }: { route: PreviewRoute }): React.JSX.Element {
  return <View style={styles.metrics}>
    <View><Text style={type.heading}>{route.time}</Text><Text style={type.caption}>Travel time</Text></View>
    <View><Text style={type.heading}>{route.fare}</Text><Text style={type.caption}>Fare</Text></View>
    <View><Text style={type.heading}>{route.transfers === 0 ? 'Direct' : route.transfers + ' transfer'}</Text>
      <Text style={type.caption}>{route.steps.filter(step => step.mode === 'ride').length} rides</Text></View>
  </View>;
}
export function RouteOptionsScreen({ selected, preference, onSelect, onPreference }: {
  selected: PreviewRoute; preference: Preference; onSelect: (route: PreviewRoute) => void;
  onPreference: (preference: Preference) => void;
}): React.JSX.Element {
  return <View style={ui.screen}>
    <View style={{ gap: 6 }}><Text style={type.caption}>FROM MONUMENTO</Text>
      <Text accessibilityRole="header" style={type.title}>To One Ayala</Text></View>
    <View style={{ gap: 10 }}><Text style={type.secondary}>Compare the example estimates</Text>
      <PreferenceChips preference={preference} onSelect={onPreference}/></View>
    <View accessibilityRole="radiogroup" accessibilityLabel="Choose a route">{rankedPreviewRoutes(preference).map(route =>
      <Pressable key={route.id} accessibilityRole="radio" accessibilityLabel={route.title}
        accessibilityState={{ checked: selected.id === route.id }} aria-checked={selected.id === route.id}
        onPress={() => onSelect(route)} style={[styles.option, selected.id === route.id && styles.selectedOption]}>
        <View style={styles.optionTitle}><View style={styles.radio}>{selected.id === route.id ? <View style={styles.radioDot}/> : null}</View>
          <Text style={[type.heading, ui.flex]}>{route.title}</Text></View>
        <View style={styles.optionMetrics}><Text style={type.label}>{route.time}</Text><Text style={type.body}>{route.fare}</Text>
          <Text style={type.secondary}>{route.transfers === 0 ? 'No transfers' : route.transfers + ' transfer'}</Text></View>
        {route.id.endsWith('carousel-mrt') && preference === 'cheapest' ? <Text style={[type.secondary, styles.accent]}>Lowest example fare</Text>
          : route.transfers === 0 ? <Text style={[type.secondary, styles.accent]}>One ride, no change of vehicle</Text> : null}
      </Pressable>)}</View>
    <Text style={type.secondary}>3 example options. Compare the fare, travel time, and number of transfers.</Text>
    <Text style={type.caption}>These estimates are placeholders for the example journey.</Text>
  </View>;
}
function Signboard({ step }: { step: PreviewStep }): React.JSX.Element | null {
  if (!step.signboard) return null;
  return <View style={styles.signboard}><Text style={[type.caption, styles.signboardCaption]}>LOOK FOR THIS SIGNBOARD</Text>
    <Text style={[type.heading, styles.signboardText]}>{step.signboard}</Text></View>;
}
export function RouteStepsScreen({ route, stepIndex, onStep, onMap, onSave, onAsk }: {
  route: PreviewRoute; stepIndex: number; onStep: (index: number) => void;
  onMap: () => void; onSave: () => void; onAsk: () => void;
}): React.JSX.Element {
  return <View style={ui.screen}>
    <View style={{ gap: 8 }}><Text style={type.caption}>MONUMENTO → ONE AYALA</Text>
      <Text accessibilityRole="header" style={type.title}>{route.title}</Text><TripSummary route={route}/></View>
    <View style={styles.links}><Button variant="text" icon="map" label="Map / stop diagram" onPress={onMap}/>
      <Button variant="text" icon="save" label="Save route" onPress={onSave}/></View>
    <View>{route.steps.map((step, index) => <View key={step.id} style={styles.timelineRow}>
      <View style={styles.timelineRail}><View style={[styles.number, index === stepIndex && styles.numberSelected]}>
        <Text style={[type.label, index === stepIndex && styles.white]}>{index + 1}</Text></View>
        {index < route.steps.length - 1 ? <View style={[styles.railLine, step.mode === 'walk' && styles.walkLine]}/> : null}
      </View>
      <View style={styles.timelineBody}>
        <Pressable accessibilityRole="button" accessibilityLabel={'Show step ' + (index + 1)} accessibilityState={{ expanded: index === stepIndex }}
          onPress={() => onStep(index)} style={styles.stepHeading}>
          <View style={styles.mode}><Icon name={step.mode === 'walk' ? 'walk' : step.title.includes('MRT') || step.title.includes('LRT') ? 'train' : 'bus'}
            color={step.mode === 'walk' ? palette.secondary : palette.rail} size={19}/><Text style={type.caption}>{step.mode === 'walk' ? 'WALK / TRANSFER' : 'RIDE'}</Text></View>
          <Text style={type.heading}>{step.title}</Text><Text style={type.secondary}>{step.subtitle}</Text>
        </Pressable>
        {index === stepIndex ? <View style={styles.stepDetail}><Signboard step={step}/><Text style={type.body}>{step.instruction}</Text>
          {step.mode === 'ride' ? <Text style={type.secondary}>Alighting landmark: {step.stop}</Text> : null}
        </View> : null}
      </View>
    </View>)}
      <View style={styles.destination}><Icon name="pin" color={palette.accent}/><Text style={type.heading}>Arrive at One Ayala</Text></View>
    </View>
    <View style={ui.rule}/>
    <Button variant="text" label="Ask about this route" icon="chat" onPress={onAsk}/>
  </View>;
}
export function StopDiagram({ route, currentStep, compact = false, zoom = 1, onStep }: {
  route: PreviewRoute; currentStep?: number; compact?: boolean; zoom?: number; onStep?: (index: number) => void;
}): React.JSX.Element {
  const start = compact ? currentStep ?? 0 : 0;
  const steps = compact ? route.steps.slice(start, start + 2) : route.steps;
  return <View style={styles.diagram}>{steps.map((step, index) => {
    const isCurrent = currentStep === start + index;
    const content = <><View style={styles.diagramRail}>
      <View style={[styles.node, isCurrent && styles.currentNode]}><Text style={[type.caption, isCurrent && styles.white]}>{start + index + 1}</Text></View>
      {index < steps.length - 1 ? <View style={[styles.diagramLine, step.mode === 'walk' && styles.walkLine]}/> : null}</View>
      <View style={{ flex: 1, paddingBottom: compact ? 16 : 32 * zoom, gap: 5 }}>
        <Text style={[type.heading, { fontSize: 20 * zoom, lineHeight: 27 * zoom }, isCurrent && styles.accent]}>{step.stop}</Text>
        <View style={styles.mode}><Icon name={step.mode === 'walk' ? 'walk' : step.title.includes('MRT') || step.title.includes('LRT') ? 'train' : 'bus'}
          size={18} color={step.mode === 'walk' ? palette.secondary : palette.rail}/>
          <Text style={type.secondary}>{step.mode === 'walk' ? 'Walk / transfer' : 'Alight here'}</Text></View>
      </View></>;
    return onStep ? <Pressable key={step.id} accessibilityRole="button" accessibilityLabel={'Inspect step ' + (start + index + 1) + ': ' + step.stop}
      onPress={() => onStep(start + index)} style={styles.diagramRow}>{content}</Pressable>
      : <View key={step.id} style={styles.diagramRow}>{content}</View>;
  })}</View>;
}
export function RouteMapScreen({ route, schematic, onMode, onLocation, onSteps, onResources, onStep }: {
  route: PreviewRoute | null; schematic: boolean; onMode: (schematic: boolean) => void; onLocation: () => void;
  onSteps: () => void; onResources: () => void; onStep: (index: number) => void;
}): React.JSX.Element {
  const [zoom, setZoom] = useState(1);
  return <View style={ui.screen}>
    <View style={styles.mapMode}>{[{ label: 'Map view', value: false }, { label: 'Stop diagram', value: true }].map(item =>
      <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: schematic === item.value }}
        onPress={() => onMode(item.value)} style={[styles.mapSegment, schematic === item.value && styles.mapSegmentSelected]}>
        <Text style={[type.label, schematic === item.value && styles.accent]}>{item.label}</Text></Pressable>)}</View>
    {!schematic ? <View style={styles.mapUnavailable}><Icon name="map" size={36} color={palette.secondary}/>
      <Text accessibilityRole="header" style={type.title}>Basemap unavailable</Text>
      <Text style={type.body}>The NCR map isn’t installed in this preview. No position or street route is being shown.</Text>
      {route ? <Button label="Use stop diagram" onPress={() => onMode(true)}/>
        : <Button label="Check offline resources" onPress={onResources}/>}
    </View> : route ? <View style={styles.mapCanvas}>
      <View style={ui.between}><Text style={type.caption}>STOP ORDER · NOT TO SCALE</Text><Icon name="map" size={19} color={palette.secondary}/></View>
      <StopDiagram route={route} zoom={zoom} onStep={onStep}/>
      <View style={ui.between}><Text style={[type.caption, ui.flex]}>Tap a point for its instruction.</Text><View style={styles.zoomControls}>
        <IconButton name="minus" label="Zoom out diagram" disabled={zoom <= 1} onPress={() => setZoom(value => Math.max(1, value - 0.25))}/>
        <IconButton name="plus" label="Zoom in diagram" disabled={zoom >= 1.5} onPress={() => setZoom(value => Math.min(1.5, value + 0.25))}/>
      </View></View>
    </View> : <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={type.title}>See your journey{ '\n' }in context.</Text>
      <Text style={type.body}>Choose a route in Plan to see its boarding points, transfers and destination.</Text>
      <Notice action="Check offline resources" onAction={onResources}>The basemap is missing. A selected route can still use a stop diagram.</Notice>
    </View>}
    {route ? <View style={styles.mapSummary}><Text style={type.caption}>SELECTED JOURNEY</Text>
      <Text style={type.heading}>{route.title}</Text><Text style={type.secondary}>Monumento → One Ayala</Text>
      <Button variant="text" icon="arrow" label="See directions" onPress={onSteps}/></View> : null}
    <Button variant="text" icon="location" label="Location" onPress={onLocation}/>
  </View>;
}
export function ActiveTripScreen({ route, stepIndex, onEnd, onAsk, onSteps }: {
  route: PreviewRoute; stepIndex: number; onEnd: () => void; onAsk: () => void; onSteps: () => void;
}): React.JSX.Element {
  const step = route.steps[stepIndex]!;
  const next = route.steps[stepIndex + 1];
  const actionTitle = step.mode === 'ride'
    ? step.title.split(' southbound')[0]!.split(' northbound')[0]!.replace(' to One Ayala', '') : step.title;
  return <View style={ui.screen}>
    <View style={{ gap: 12 }}><View style={ui.between}><Text style={type.secondary}>{'Step ' + (stepIndex + 1) + ' of ' + route.steps.length}</Text>
      <Text style={[type.caption, styles.accent]}>MANUAL PROGRESS</Text></View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: ((stepIndex + 1) / route.steps.length * 100) + '%' as `${number}%` }]}/></View>
      <View style={styles.mode}><Icon name={step.mode === 'walk' ? 'walk' : step.title.includes('MRT') || step.title.includes('LRT') ? 'train' : 'bus'} color={palette.accent}/>
        <Text style={[type.caption, styles.accent]}>{step.mode === 'walk' ? 'WALK / TRANSFER' : 'BOARD & RIDE'}</Text></View>
      <Text accessibilityRole="header" style={type.title}>{actionTitle}</Text>
      {step.mode === 'ride' ? <View style={styles.landmark}><Text style={type.caption}>GET OFF AT</Text>
        <Text style={type.title}>{step.stop}</Text></View> : null}
      <Signboard step={step}/>
      {step.mode === 'ride' ? <Text style={type.secondary}>{step.title.includes('southbound') ? 'Southbound · ' : step.title.includes('northbound') ? 'Northbound · ' : ''}{step.subtitle}</Text> : null}
      <Text style={type.body}>{step.instruction}</Text>
    </View>
    {next ? <View style={styles.next}><Text style={type.caption}>NEXT</Text><Text style={type.label}>{next.title}</Text></View>
      : <Text style={type.secondary}>One Ayala is your final landmark. Finish only when you reach it.</Text>}
    <StopDiagram route={route} currentStep={stepIndex} compact/>
    <Text style={type.secondary}>Location unavailable. Tap Next when you reach each point; your position won’t advance a step.</Text>
    <View style={ui.row}><Button variant="text" label="All steps" onPress={onSteps}/>
      <Button variant="text" icon="chat" label="Ask about this trip" onPress={onAsk}/></View>
    <Button variant="text" label="End trip" onPress={onEnd}/>
  </View>;
}
export function TripCompleteScreen({ onSave, onReturn, onDone }: { onSave: () => void; onReturn: () => void; onDone: () => void }): React.JSX.Element {
  return <View style={[ui.screen, { paddingVertical: 24 }]}><Gaile pose="cheer" height={90}/>
    <Text accessibilityRole="header" style={type.display}>Nakarating ka!</Text>
    <Text style={type.body}>You completed the example journey to One Ayala.</Text>
    <Button label="Save this route" icon="save" onPress={onSave}/>
    <Button label="Plan return trip" variant="secondary" onPress={onReturn}/>
    <Button label="Done" variant="text" onPress={onDone}/>
  </View>;
}
const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 12, paddingVertical: 14 },
  option: { paddingVertical: 20, paddingHorizontal: 12, gap: 10, borderBottomWidth: 1, borderColor: palette.line },
  selectedOption: { backgroundColor: palette.accentSoft, borderRadius: 18, borderWidth: 1, borderColor: palette.gold, paddingHorizontal: 14 },
  optionTitle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionMetrics: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4, marginLeft: 32 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: palette.secondary, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accent },
  accent: { color: palette.accent }, white: { color: palette.white },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  signboard: { alignSelf: 'stretch', backgroundColor: palette.dark, borderRadius: 14, padding: 16, gap: 4 },
  signboardText: { color: palette.white, letterSpacing: 1.3 }, signboardCaption: { color: '#E3EDE6' },
  timelineRow: { flexDirection: 'row', gap: 16 },
  timelineRail: { minWidth: 30, alignItems: 'center' },
  number: { minWidth: 30, minHeight: 30, padding: 4, borderRadius: 24, borderWidth: 1.5, borderColor: palette.secondary, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.paper },
  numberSelected: { backgroundColor: palette.accent, borderColor: palette.accent },
  railLine: { flex: 1, width: 0, borderLeftWidth: 2, borderLeftColor: palette.rail, minHeight: 16 },
  walkLine: { borderStyle: 'dashed', borderLeftColor: palette.secondary },
  timelineBody: { flex: 1, paddingBottom: 28, gap: 12 },
  stepHeading: { gap: 6, minHeight: 60 }, mode: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDetail: { gap: 12 }, destination: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingTop: 4 },
  diagram: { paddingTop: 20 }, diagramRow: { flexDirection: 'row', gap: 18, minHeight: 70 },
  diagramRail: { minWidth: 26, alignItems: 'center' },
  node: { minWidth: 26, minHeight: 26, padding: 2, borderRadius: 24, borderWidth: 2, borderColor: palette.rail, backgroundColor: palette.paper, alignItems: 'center', justifyContent: 'center' },
  currentNode: { borderColor: palette.accent, backgroundColor: palette.accent },
  diagramLine: { flex: 1, width: 0, borderLeftWidth: 2, borderLeftColor: palette.rail, minHeight: 16 },
  mapMode: { flexDirection: 'row', backgroundColor: palette.background, padding: 4, borderRadius: 16, gap: 4 },
  mapSegment: { flex: 1, minHeight: 48, padding: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  mapSegmentSelected: { backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.gold },
  mapUnavailable: { gap: 20, padding: 20, backgroundColor: palette.goldSoft, borderRadius: 20 }, mapCanvas: { backgroundColor: palette.background, marginHorizontal: -20, padding: 20 },
  zoomControls: { flexDirection: 'row', backgroundColor: palette.paper, borderRadius: 14 },
  mapSummary: { gap: 6, borderTopWidth: 1, borderColor: palette.line, paddingTop: 20 },
  progressTrack: { height: 6, borderRadius: 6, backgroundColor: palette.line, overflow: 'hidden' }, progressFill: { height: 6, backgroundColor: palette.orange },
  landmark: { padding: 16, gap: 4, borderRadius: 18, backgroundColor: palette.goldSoft }, next: { paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, gap: 5 },
});
