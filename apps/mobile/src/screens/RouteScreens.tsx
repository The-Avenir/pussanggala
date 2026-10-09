import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Gaile, Icon, IconButton, ListRow, Notice, Section, palette, type, ui } from '../ui/travel';
import type { IconName } from '../ui/travel';
import { PreferenceChips } from './Preferences';
import { rankedPreviewRoutes } from './previewJourney';
import type { Preference, PreviewRoute, PreviewStep } from './previewJourney';

const SUPPORTED_NEARBY: readonly string[] = ['Monumento', 'North Avenue', 'Ayala', 'Quiapo', 'Divisoria'];

function stepIcon(step: PreviewStep): IconName {
  return step.mode === 'walk' ? 'walk' : step.title.includes('MRT') || step.title.includes('LRT') ? 'train' : 'bus';
}
function routeWarnings(route: PreviewRoute): string[] {
  const warnings: string[] = [];
  if (route.steps.some(step => (step.fareReports?.length ?? 0) > 1)) warnings.push('Reports disagree on fare');
  if (route.steps.some(step => step.oldReport)) warnings.push('Some reports are over 180 days old');
  return warnings;
}
function FareReports({ step }: { step: PreviewStep }): React.JSX.Element | null {
  const reports = step.fareReports;
  if (!reports?.length) return null;
  if (reports.length > 1) return <View style={styles.fareConflict}>
    <Text style={type.label}>Fare reports differ: {reports.map(report => `${report.amount} (${report.date})`).join(' · ')}</Text>
    <Text style={type.caption}>Both dated reports are shown; they are never averaged.</Text>
  </View>;
  return <Text style={type.secondary}>Reported fare: {reports[0]!.amount} ({reports[0]!.date})</Text>;
}

export function TripSummary({ route }: { route: PreviewRoute }): React.JSX.Element {
  return <View style={styles.metrics}>
    <View><Text style={type.heading}>{route.timeUnknown ? '—' : route.time}</Text>
      <Text style={type.caption}>{route.timeUnknown ? 'Time not reported' : 'reported time'}</Text></View>
    <View><Text style={type.heading}>{route.fareUnknown ? '—' : route.fare}</Text>
      <Text style={type.caption}>{route.fareUnknown ? 'Fare not reported' : 'reported fare'}</Text></View>
    <View><Text style={type.heading}>{route.transfers === 0 ? 'Direct' : route.transfers + ' transfer'}</Text>
      <Text style={type.caption}>{route.steps.filter(step => step.mode === 'ride').length} rides</Text></View>
  </View>;
}
export function RouteOptionsScreen({ selected, preference, onSelect, onPreference, routes, onViewSteps }: {
  selected: PreviewRoute; preference: Preference; onSelect: (route: PreviewRoute) => void;
  onPreference: (preference: Preference) => void;
  routes?: readonly PreviewRoute[]; onViewSteps?: (route: PreviewRoute) => void;
}): React.JSX.Element {
  const ranked = routes ?? rankedPreviewRoutes(preference);
  const isUnreported = (item: PreviewRoute): boolean =>
    preference === 'cheapest' ? !!item.fareUnknown : preference === 'fastest' ? !!item.timeUnknown : false;
  const reported = ranked.filter(item => !isUnreported(item));
  const unreported = ranked.filter(isUnreported);
  const footnote = preference === 'cheapest'
    ? `Compared among ${reported.length} of ${ranked.length} options with full fare reports.`
    : preference === 'fastest'
    ? `Compared among ${reported.length} of ${ranked.length} options with reported times. Times are reported ranges and overlap.`
    : `All ${ranked.length} options report ride counts; ties break on the lowest reported fare.`;
  function optionCard(item: PreviewRoute): React.JSX.Element {
    const checked = selected.id === item.id;
    return <View key={item.id} style={[styles.option, checked && styles.selectedOption]}>
      <Pressable accessibilityRole="radio" accessibilityLabel={item.title}
        accessibilityState={{ checked }} aria-checked={checked} onPress={() => onSelect(item)} style={styles.optionBody}>
        <View style={styles.optionTitle}><View style={styles.radio}>{checked ? <View style={styles.radioDot}/> : null}</View>
          <Text style={[type.heading, ui.flex]}>{item.title}</Text></View>
        <View style={styles.legStrip}>{item.steps.map((step, index) => <Fragment key={step.id}>
          {index ? <Icon name="arrow" size={13} color={palette.secondary}/> : null}
          <Icon name={stepIcon(step)} size={17} color={step.mode === 'walk' ? palette.secondary : palette.rail}/>
        </Fragment>)}</View>
        <View style={styles.optionMetrics}><Text style={type.label}>{item.time}</Text><Text style={type.body}>{item.fare}</Text>
          <Text style={type.secondary}>{item.transfers === 0 ? 'No transfers' : item.transfers + ' transfer'}</Text></View>
        {item.badges.length ? <View style={styles.badgeRow}>{item.badges.map(badge => <View key={badge} style={styles.badge}>
          <Icon name="check" size={13} color={palette.success}/><Text style={[type.caption, styles.badgeText]}>{badge}</Text>
        </View>)}</View> : null}
        {routeWarnings(item).map(warning => <Text key={warning} style={[type.caption, styles.warning]}>⚠ {warning}</Text>)}
        {item.sourceLine ? <Text style={type.caption}>{item.sourceLine}</Text> : null}
      </Pressable>
      <Button variant="text" icon="arrow" label="View steps" onPress={() => (onViewSteps ?? onSelect)(item)} style={styles.viewSteps}/>
    </View>;
  }
  return <View style={ui.screen}>
    <View style={{ gap: 6 }}><Text style={type.caption}>ROUTE OPTIONS</Text>
      <Text accessibilityRole="header" style={type.title}>Monumento → One Ayala</Text></View>
    {ranked.length > 1 ? <View style={{ gap: 10 }}><Text style={type.secondary}>Sort by reported values</Text>
      <PreferenceChips preference={preference} onSelect={onPreference}/></View>
      : <Text style={type.secondary}>1 supported route found</Text>}
    <View accessibilityRole="radiogroup" accessibilityLabel="Choose a route">{reported.map(optionCard)}
      {unreported.length ? <View style={styles.dividerRow} accessibilityRole="header">
        <View style={[ui.flex, styles.dividerLine]}/>
        <Text style={[type.caption, styles.dividerLabel]}>{preference === 'cheapest' ? 'Fare not fully reported' : 'Time not reported'}</Text>
        <View style={[ui.flex, styles.dividerLine]}/></View> : null}
      {unreported.map(optionCard)}</View>
    <Text style={type.secondary}>{footnote}</Text>
    <Text style={type.caption}>Fares and times are community-reported as of the dates shown. Check signboards and ask the driver/conductor.</Text>
    <Text style={type.caption}>Values illustrate the interface. Actual route reports require the installed pack and source dates.</Text>
  </View>;
}
function Signboard({ step }: { step: PreviewStep }): React.JSX.Element | null {
  if (!step.signboard) return null;
  return <View style={styles.signboard}><Text style={[type.caption, styles.signboardCaption]}>LOOK FOR THIS SIGNBOARD</Text>
    <Text style={[type.heading, styles.signboardText]}>{step.signboard}</Text></View>;
}
export function RouteStepsScreen({ route, stepIndex, onStep, onMap, onSave, onAsk, onSources, onStartTrip }: {
  route: PreviewRoute; stepIndex: number; onStep: (index: number) => void;
  onMap: () => void; onSave: () => void; onAsk: () => void; onSources: () => void; onStartTrip?: () => void;
}): React.JSX.Element {
  return <View style={ui.screen}>
    <View style={{ gap: 8 }}><Text style={type.caption}>MONUMENTO → ONE AYALA · STEP LIST</Text>
      <Text accessibilityRole="header" style={type.title}>{route.title}</Text><TripSummary route={route}/>
      {route.sourceLine ? <Text style={type.caption}>{route.sourceLine}</Text> : null}</View>
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
          <View style={styles.mode}><Icon name={stepIcon(step)}
            color={step.mode === 'walk' ? palette.secondary : palette.rail} size={19}/><Text style={type.caption}>{step.mode === 'walk' ? 'WALK / TRANSFER' : 'RIDE'}</Text></View>
          <Text style={type.heading}>{step.title}</Text><Text style={type.secondary}>{step.subtitle}</Text>
        </Pressable>
        {index === stepIndex ? <View style={styles.stepDetail}><Signboard step={step}/><Text style={type.body}>{step.instruction}</Text>
          {step.mode === 'ride' ? <Text style={type.secondary}>Alighting landmark: {step.stop}</Text> : null}
          <FareReports step={step}/>
          {step.mode === 'ride' ? <Text style={type.secondary}>{step.hours ?? 'Hours not reported'}</Text> : null}
          {step.oldReport ? <Text style={[type.caption, styles.warning]}>⚠ Reported over 180 days ago</Text> : null}
          {step.tips?.length ? <View style={styles.tips}><Text style={[type.caption, styles.tipsLabel]}>RIDER TIPS · PARAPHRASED</Text>
            {step.tips.map(tip => <Text key={tip} style={type.secondary}>{tip}</Text>)}</View> : null}
          {step.source ? <Pressable accessibilityRole="button" accessibilityLabel="About this source" onPress={onSources} style={styles.sourceRow}>
            <Icon name="info" size={15} color={palette.secondary}/>
            <Text style={[type.caption, ui.flex]}>Reported in {step.source.label} · posted {step.source.postedAt} · <Text style={styles.accent}>Open source</Text></Text>
          </Pressable> : null}
        </View> : null}
      </View>
    </View>)}
      <View style={styles.destination}><Icon name="pin" color={palette.accent}/><Text style={type.heading}>Arrive at One Ayala</Text></View>
    </View>
    {onStartTrip ? <Button label="Start trip" icon="arrow" onPress={onStartTrip}/> : null}
    <View style={ui.rule}/>
    <Button variant="text" label="Ask about this route" icon="chat" onPress={onAsk}/>
    <Button variant="text" label="Sources & limitations" icon="info" onPress={onSources}/>
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
        <View style={styles.mode}><Icon name={stepIcon(step)}
          size={18} color={step.mode === 'walk' ? palette.secondary : palette.rail}/>
          <Text style={type.secondary}>{step.mode === 'walk' ? 'Walk / transfer' : 'Alight here'}</Text></View>
      </View></>;
    return onStep ? <Pressable key={step.id} accessibilityRole="button" accessibilityLabel={'Inspect step ' + (start + index + 1) + ': ' + step.stop}
      onPress={() => onStep(start + index)} style={styles.diagramRow}>{content}</Pressable>
      : <View key={step.id} style={styles.diagramRow}>{content}</View>;
  })}</View>;
}
export function RouteMapScreen({ route, schematic, onMode, onLocation, onSteps, onResources, onStep,
  locationStatus = 'off', onRecenter, onShowRoute, onStartFrom, onGoHere }: {
  route: PreviewRoute | null; schematic: boolean; onMode: (schematic: boolean) => void; onLocation: () => void;
  onSteps: () => void; onResources: () => void; onStep: (index: number) => void;
  locationStatus?: 'off' | 'live' | 'stale';
  onRecenter?: () => void; onShowRoute?: () => void;
  onStartFrom?: (place: string) => void; onGoHere?: (place: string) => void;
}): React.JSX.Element {
  const [zoom, setZoom] = useState(1);
  const locationChip = locationStatus === 'live' ? 'Updated 8 s ago · ±15 m'
    : locationStatus === 'stale' ? 'Last known position · 2 min ago'
    : 'Location is off. Type or pick your starting point.';
  const unmapped = route?.steps.filter(step => step.unmapped) ?? [];
  return <View style={ui.screen}>
    <View style={styles.mapMode}>{[{ label: 'Map view', value: false }, { label: 'Stop diagram', value: true }].map(item =>
      <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: schematic === item.value }}
        onPress={() => onMode(item.value)} style={[styles.mapSegment, schematic === item.value && styles.mapSegmentSelected]}>
        <Text style={[type.label, schematic === item.value && styles.accent]}>{item.label}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" accessibilityLabel={'Location status: ' + locationChip} onPress={onLocation} style={styles.locationChip}>
      <Icon name="location" size={16} color={locationStatus === 'off' ? palette.secondary : palette.success}/>
      <Text style={[type.caption, ui.flex]}>{locationChip}</Text>
      {locationStatus === 'off' ? <Text style={[type.caption, styles.accent]}>Set start</Text> : null}
    </Pressable>
    {!schematic ? <View style={styles.mapUnavailable}><Icon name="map" size={36} color={palette.secondary}/>
      <Text accessibilityRole="header" style={type.title}>Map unavailable on this device.</Text>
      <Text style={type.body}>Showing stop diagram. The NCR basemap isn’t installed in this preview, so no position or street path can render.</Text>
      {route ? <Button label="Use stop diagram" onPress={() => onMode(true)}/>
        : <Button label="Check offline resources" onPress={onResources}/>}
      <Text style={type.caption}>Basemap tiles: © OpenStreetMap contributors</Text>
    </View> : route ? <View style={styles.mapCanvas}>
      <View style={ui.between}><Text style={type.caption}>STOP ORDER · NOT TO SCALE</Text><Icon name="map" size={19} color={palette.secondary}/></View>
      <StopDiagram route={route} zoom={zoom} onStep={onStep}/>
      {unmapped.map(step => <ListRow key={step.id} icon="pin" title={'Unmapped: ' + step.stop}
        detail="No reported coordinates — this point stays in the step list."/>)}
      <View style={ui.between}><Text style={[type.caption, ui.flex]}>Tap a point for its instruction.</Text><View style={styles.zoomControls}>
        <IconButton name="minus" label="Zoom out diagram" disabled={zoom <= 1} onPress={() => setZoom(value => Math.max(1, value - 0.25))}/>
        <IconButton name="plus" label="Zoom in diagram" disabled={zoom >= 1.5} onPress={() => setZoom(value => Math.min(1.5, value + 0.25))}/>
      </View></View>
      <View style={ui.row}>
        <Button variant="text" icon="location" label="Recenter" onPress={onRecenter ?? onLocation}/>
        <Button variant="text" icon="map" label="Show whole route" onPress={onShowRoute ?? (() => onMode(true))}/>
      </View>
      <Text style={type.caption}>Basemap tiles: © OpenStreetMap contributors</Text>
    </View> : <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={type.title}>See your journey{ '\n' }in context.</Text>
      <Text style={type.body}>Choose a route in Plan to see its boarding points, transfers and destination.</Text>
      <Notice action="Check offline resources" onAction={onResources}>The basemap is missing. A selected route can still use a stop diagram.</Notice>
      <Section title="SUPPORTED PLACES NEARBY">
        {SUPPORTED_NEARBY.map(place => <View key={place} style={styles.placeRow}>
          <View style={[ui.row, styles.placeName]}><Icon name="pin" size={18} color={palette.secondary}/><Text style={type.label}>{place}</Text></View>
          <Button variant="text" label="Start from here" disabled={!onStartFrom} onPress={() => { onStartFrom?.(place); }}/>
          <Button variant="text" label="Go here" disabled={!onGoHere} onPress={() => { onGoHere?.(place); }}/>
        </View>)}
      </Section>
      <Text style={type.caption}>Tap a place, then confirm — nothing is picked for you. Basemap tiles: © OpenStreetMap contributors</Text>
    </View>}
    {route ? <View style={styles.mapSummary}><Text style={type.caption}>SELECTED JOURNEY</Text>
      <Text style={type.heading}>{route.title}</Text><Text style={type.secondary}>Monumento → One Ayala</Text>
      <Button variant="text" icon="arrow" label="See directions" onPress={onSteps}/></View> : null}
    <Button variant="text" icon="location" label="Location" onPress={onLocation}/>
  </View>;
}
export function ActiveTripScreen({ route, stepIndex, onEnd, onAsk, onSteps, onSave }: {
  route: PreviewRoute; stepIndex: number; onEnd: () => void; onAsk: () => void; onSteps: () => void; onSave?: () => void;
}): React.JSX.Element {
  const step = route.steps[stepIndex]!;
  const next = route.steps[stepIndex + 1];
  const actionTitle = step.mode === 'ride'
    ? step.title.split(' southbound')[0]!.split(' northbound')[0]!.replace(' to One Ayala', '') : step.title;
  return <View style={ui.screen}>
    <View style={{ gap: 12 }}><View style={ui.between}><Text style={type.secondary}>{'Step ' + (stepIndex + 1) + ' of ' + route.steps.length}</Text>
      <Text style={[type.caption, styles.accent]}>MANUAL PROGRESS</Text></View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: ((stepIndex + 1) / route.steps.length * 100) + '%' as `${number}%` }]}/></View>
      <View style={styles.mode}><Icon name={stepIcon(step)} color={palette.accent}/>
        <Text style={[type.caption, styles.accent]}>{step.mode === 'walk' ? 'WALK / TRANSFER' : 'BOARD & RIDE'}</Text></View>
      <Text accessibilityRole="header" style={type.title}>{actionTitle}</Text>
      {step.mode === 'ride' ? <View style={styles.landmark}><Text style={type.caption}>GET OFF AT</Text>
        <Text style={type.title}>{step.stop}</Text></View> : null}
      <Signboard step={step}/>
      {step.mode === 'ride' ? <Text style={type.secondary}>{step.title.includes('southbound') ? 'Southbound · ' : step.title.includes('northbound') ? 'Northbound · ' : ''}{step.subtitle}</Text> : null}
      <Text style={type.body}>{step.instruction}</Text>
      {step.mode === 'ride' ? (step.fareReports?.length ? <FareReports step={step}/> : <Text style={type.secondary}>Fare not reported</Text>) : null}
    </View>
    {next ? <View style={styles.next}><Text style={type.caption}>NEXT</Text><Text style={type.label}>{next.title}</Text></View>
      : <Text style={type.secondary}>One Ayala is your final landmark. Finish only when you reach it.</Text>}
    <StopDiagram route={route} currentStep={stepIndex} compact/>
    <View style={{ gap: 4 }}>
      <Text style={type.secondary}>Keep the app open to see your position. Tap Next when you reach each point.</Text>
      <Text style={type.caption}>Location is unavailable in this preview, so your position won’t advance a step.</Text>
    </View>
    <View style={ui.row}><Button variant="text" label="All steps" onPress={onSteps}/>
      {onSave ? <Button variant="text" icon="save" label="Save route" onPress={onSave}/> : null}
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
  option: { paddingVertical: 20, paddingHorizontal: 12, gap: 6, borderBottomWidth: 1, borderColor: palette.line },
  selectedOption: { backgroundColor: palette.accentSoft, borderRadius: 18, borderWidth: 1, borderColor: palette.gold, paddingHorizontal: 14 },
  optionBody: { gap: 10 },
  optionTitle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionMetrics: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4, marginLeft: 32 },
  legStrip: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 4, marginLeft: 32 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 32 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: palette.goldSoft, borderWidth: 1, borderColor: palette.gold },
  badgeText: { color: palette.ink, fontWeight: '600' },
  warning: { color: palette.warning, marginLeft: 32 },
  viewSteps: { alignSelf: 'flex-start', marginLeft: 32 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  dividerLine: { height: 1, backgroundColor: palette.line },
  dividerLabel: { fontWeight: '600' },
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
  tips: { gap: 6, backgroundColor: palette.background, borderRadius: 14, padding: 14 },
  tipsLabel: { fontWeight: '600', letterSpacing: 0.4 },
  fareConflict: { gap: 4, borderLeftWidth: 3, borderLeftColor: palette.gold, backgroundColor: palette.goldSoft, padding: 12 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  diagram: { paddingTop: 20 }, diagramRow: { flexDirection: 'row', gap: 18, minHeight: 70 },
  diagramRail: { minWidth: 26, alignItems: 'center' },
  node: { minWidth: 26, minHeight: 26, padding: 2, borderRadius: 24, borderWidth: 2, borderColor: palette.rail, backgroundColor: palette.paper, alignItems: 'center', justifyContent: 'center' },
  currentNode: { borderColor: palette.accent, backgroundColor: palette.accent },
  diagramLine: { flex: 1, width: 0, borderLeftWidth: 2, borderLeftColor: palette.rail, minHeight: 16 },
  mapMode: { flexDirection: 'row', backgroundColor: palette.background, padding: 4, borderRadius: 16, gap: 4 },
  mapSegment: { flex: 1, minHeight: 48, padding: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  mapSegmentSelected: { backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.gold },
  mapUnavailable: { gap: 20, padding: 20, backgroundColor: palette.goldSoft, borderRadius: 20 }, mapCanvas: { backgroundColor: palette.background, marginHorizontal: -20, padding: 20 },
  locationChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, borderRadius: 20, paddingHorizontal: 14, minHeight: 44 },
  placeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 6 },
  placeName: { flex: 1, minWidth: 120 },
  zoomControls: { flexDirection: 'row', backgroundColor: palette.paper, borderRadius: 14 },
  mapSummary: { gap: 6, borderTopWidth: 1, borderColor: palette.line, paddingTop: 20 },
  progressTrack: { height: 6, borderRadius: 6, backgroundColor: palette.line, overflow: 'hidden' }, progressFill: { height: 6, backgroundColor: palette.orange },
  landmark: { padding: 16, gap: 4, borderRadius: 18, backgroundColor: palette.goldSoft }, next: { paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, gap: 5 },
});
