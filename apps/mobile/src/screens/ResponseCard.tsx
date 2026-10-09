import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Gaile, Icon, palette, type, ui } from '../ui/travel';
import type { IconName } from '../ui/travel';
import type { PreviewRoute, PreviewStep } from './previewJourney';

// Walkthrough §5: route facts render as deterministic cards; the explanation only restates them.
// 'unavailable' renders the card-derived basic summary (AI unsupported on this phone).
export type ExplanationKind = 'streaming' | 'complete' | 'stopped' | 'failed' | 'unavailable';

const SOURCE_LINE = 'Community reports · posted Jun–Sep 2026';

export const QUICK_REPLIES: readonly { label: string; query: string }[] = [
  { label: 'Cheaper?', query: 'May mas mura ba kesa rito?' },
  { label: 'Fewer transfers?', query: 'Ilang sakay? Gusto ko mas kaunting lipat.' },
  { label: 'Pauwi?', query: 'Pauwi naman?' },
  { label: 'Last trip?', query: 'Anong oras last trip?' },
  { label: 'Saan ako bababa?', query: 'Saan ako bababa?' },
];

function stepIcon(step: PreviewStep): IconName {
  if (step.mode === 'walk') return 'walk';
  return step.title.includes('MRT') || step.title.includes('LRT') ? 'train' : 'bus';
}
function legLabel(step: PreviewStep): string {
  return step.title.replace(/^Ride /, '').replace(/ (southbound|northbound)/, '').replace(/ to .+$/, '');
}

export function RouteSummaryCard({ route, origin, destination, optionCount = 3, warnings, unreportedLegs = 0,
  sourceLine = SOURCE_LINE, onStartTrip, onSeeSteps, onOptions, onSave, onMap }: {
  route: PreviewRoute; origin?: string | undefined; destination?: string | undefined; optionCount?: number | undefined;
  warnings?: readonly string[] | undefined; unreportedLegs?: number | undefined; sourceLine?: string | undefined;
  onStartTrip?: (() => void) | undefined; onSeeSteps?: (() => void) | undefined;
  onOptions?: (() => void) | undefined; onSave?: (() => void) | undefined; onMap?: (() => void) | undefined;
}): React.JSX.Element {
  const rides = route.steps.filter(step => step.mode === 'ride').length;
  const endpoints = origin || destination ? (origin || 'Choose origin') + ' → ' + (destination || 'Choose destination') : route.title;
  const fare = route.fareUnknown || !route.fare ? 'Fare not reported'
    : unreportedLegs > 0 ? route.fare + ' + ' + unreportedLegs + ' ride' + (unreportedLegs > 1 ? 's' : '') + ' not reported'
    : route.fare + ' reported';
  const time = route.timeUnknown || !route.time ? 'Time not reported' : 'about ' + route.time + ' (reported)';
  const allWarnings = [...new Set([
    ...(route.steps.some(step => (step.fareReports?.length ?? 0) > 1) ? ['Reports disagree on fare'] : []),
    ...(route.steps.some(step => step.oldReport) ? ['Some reports are over 180 days old'] : []),
    ...(warnings ?? [])])];
  return <View style={styles.card}>
    <Text style={[type.caption, styles.overline]}>ROUTE SUMMARY · EXAMPLE DATA</Text>
    <Text accessibilityRole="header" style={type.heading}>{endpoints}</Text>
    <View style={styles.tag}><Text style={[type.caption, styles.tagText]}>
      {route.badges.length ? route.badges.join(' · ') + ' among ' + optionCount + ' options' : 'One of ' + optionCount + ' reported options'}
    </Text></View>
    <View style={styles.legs}>{route.steps.map((step, index) => <View key={step.id} style={styles.leg}>
      {index > 0 ? <Text style={styles.legArrow}>→</Text> : null}
      <Icon name={stepIcon(step)} size={17} color={step.mode === 'walk' ? palette.secondary : palette.rail}/>
      {step.mode === 'ride' ? <Text style={type.caption}>{legLabel(step)}</Text> : null}
    </View>)}</View>
    <Text style={type.body}>{rides} ride{rides === 1 ? '' : 's'} · {route.transfers === 0 ? 'no transfers' : route.transfers + ' transfer' + (route.transfers > 1 ? 's' : '')}</Text>
    <View style={styles.metrics}>
      <View style={styles.metric}><Text style={type.label}>{fare}</Text><Text style={type.caption}>total fare</Text></View>
      <View style={styles.metric}><Text style={type.label}>{time}</Text>
        <Text style={type.caption}>travel time</Text></View>
    </View>
    <Text style={type.caption}>{route.sourceLine ?? sourceLine}</Text>
    {allWarnings.map(warning => <View key={warning} style={styles.warning}>
      <Text style={[type.secondary, styles.warningText]}>⚠ {warning}</Text></View>)}
    <View style={styles.actions}>
      {onStartTrip ? <Button variant="secondary" icon="arrow" label="Start trip" onPress={onStartTrip}/> : null}
      {onSeeSteps ? <Button variant="secondary" label="See steps" onPress={onSeeSteps}/> : null}
      {onOptions ? <Button variant="text" label="Other options" onPress={onOptions}/> : null}
      {onMap ? <Button variant="text" icon="map" label="Map" onPress={onMap}/> : null}
      {onSave ? <Button variant="text" icon="save" label="Save" onPress={onSave}/> : null}
    </View>
  </View>;
}

// Split once at the spaces nearest the proportional boundaries so chunks end on words.
function splitChunks(text: string, count = 3): string[] {
  if (text.length < 48) return [text];
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i < count; i++) {
    const target = Math.round(text.length * i / count);
    let cut = text.indexOf(' ', target);
    if (cut === -1 || cut <= start) cut = text.lastIndexOf(' ', target);
    if (cut === -1 || cut <= start) cut = target;
    parts.push(text.slice(start, cut));
    start = cut + 1;
  }
  parts.push(text.slice(start));
  return parts.filter(part => part.trim().length > 0);
}

// Preview streams the canned answer in 2–3 chunks on a timer; Stop cancels and keeps the cards valid.
export function Explanation({ answer, initial = 'streaming' }: { answer: string; initial?: ExplanationKind }): React.JSX.Element {
  const parts = useMemo(() => splitChunks(answer), [answer]);
  const [status, setStatus] = useState<ExplanationKind>(initial);
  const [revealed, setRevealed] = useState(() => initial === 'streaming' ? 0 : initial === 'failed' ? Math.min(1, parts.length) : parts.length);
  useEffect(() => {
    if (status !== 'streaming') return;
    if (revealed >= parts.length) { setStatus('complete'); return; }
    const timer = setTimeout(() => setRevealed(value => value + 1), 600);
    return () => clearTimeout(timer);
  }, [status, revealed, parts.length]);
  const shown = parts.slice(0, revealed).join(' ');
  if (status === 'failed') return <View style={{ gap: 10 }}>
    {shown ? <Text style={type.body}>{shown}</Text> : null}
    <Text style={type.body}>I couldn’t finish the explanation.</Text>
    <Button variant="text" label="Retry" onPress={() => { setRevealed(0); setStatus('streaming'); }} style={styles.statusAction}/>
  </View>;
  return <View style={{ gap: 8 }}>
    {shown ? <Text style={type.body}>{shown}</Text> : null}
    {status === 'streaming' ? <View style={styles.streamRow}>
      <Text style={[type.caption, ui.flex]}>Pusang Gala is explaining…</Text>
      <Button variant="text" label="Stop" onPress={() => setStatus('stopped')} style={styles.statusAction}/>
    </View> : null}
    {status === 'stopped' ? <Text style={type.caption}>Stopped. Cards above are complete.</Text> : null}
  </View>;
}

export function ResponseCard({ answer, explanation = 'streaming', route, origin, destination, optionCount, warnings, unreportedLegs,
  onStartTrip, onSeeSteps, onOptions, onSave, onMap, onPrompt }: {
  answer: string; explanation?: ExplanationKind | undefined; route?: PreviewRoute | undefined;
  origin?: string; destination?: string; optionCount?: number; warnings?: readonly string[] | undefined; unreportedLegs?: number;
  onStartTrip?: (() => void) | undefined; onSeeSteps?: (() => void) | undefined; onOptions?: (() => void) | undefined;
  onSave?: (() => void) | undefined; onMap?: (() => void) | undefined; onPrompt?: ((query: string) => void) | undefined;
}): React.JSX.Element {
  return <View style={{ gap: 14 }}>
    {route ? <RouteSummaryCard route={route} origin={origin} destination={destination} optionCount={optionCount}
      warnings={warnings} unreportedLegs={unreportedLegs} onStartTrip={onStartTrip} onSeeSteps={onSeeSteps}
      onOptions={onOptions} onSave={onSave} onMap={onMap}/> : null}
    <View style={{ gap: 8 }}>
      <View style={styles.assistant}>
        <View style={styles.assistantAvatar}><Gaile pose="idle" height={34}/></View>
        <View style={ui.flex}><Text style={type.label}>Gaile</Text>
          <Text style={[type.caption, styles.overline]}>
            {explanation === 'unavailable' ? 'BASIC SUMMARY · AI UNAVAILABLE' : 'EXPLANATION · EXAMPLE'}</Text>
        </View>
      </View>
      <View style={styles.answer}><Explanation answer={answer} initial={explanation}/></View>
    </View>
    {route && onPrompt ? <View style={styles.chips}>
      {QUICK_REPLIES.map(chip => <Pressable key={chip.label} accessibilityRole="button" accessibilityLabel={chip.label}
        onPress={() => onPrompt(chip.query)} style={({ pressed }) => [styles.chip, pressed && ui.pressed]}>
        <Text style={[type.secondary, styles.chipText]}>{chip.label}</Text></Pressable>)}
      {onOptions ? <Pressable accessibilityRole="button" accessibilityLabel="Other options" onPress={onOptions}
        style={({ pressed }) => [styles.chip, pressed && ui.pressed]}>
        <Text style={[type.secondary, styles.chipText, styles.accent]}>Other options →</Text></Pressable> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 10, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 16 },
  overline: { fontWeight: '600', color: palette.secondary },
  tag: { alignSelf: 'flex-start', backgroundColor: palette.accentSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { color: palette.accent, fontWeight: '600' },
  legs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 2 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legArrow: { color: palette.secondary, fontSize: 14 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 8 },
  metric: { flexShrink: 1, minWidth: 0 },
  warning: { backgroundColor: palette.warningSoft, borderLeftWidth: 3, borderLeftColor: palette.warning, padding: 10, borderRadius: 8 },
  warningText: { color: palette.warning },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 4 },
  assistant: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  assistantAvatar: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 21, backgroundColor: palette.goldSoft },
  answer: { backgroundColor: palette.background, padding: 14, borderRadius: 16, borderTopLeftRadius: 5 },
  streamRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  statusAction: { minHeight: 44, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { maxWidth: '100%', minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, justifyContent: 'center', borderRadius: 16,
    backgroundColor: palette.background, borderWidth: 1, borderColor: palette.line },
  chipText: { color: palette.ink }, accent: { color: palette.accent, fontWeight: '600' },
});
