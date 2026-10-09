import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Gaile, Icon, IconButton, palette, type, ui } from '../ui/travel';
import type { PreviewRoute } from './previewJourney';
import { ResponseCard } from './ResponseCard';
import type { ExplanationKind } from './ResponseCard';

// explanation drives the §5 answer state; undefined streams the canned text in chunks (preview).
export interface ConversationTurn {
  id: number; query: string; answer: string; route?: PreviewRoute; explanation?: ExplanationKind;
}

const SUGGESTIONS: readonly { label: string; query: string }[] = [
  { label: 'Monumento → One Ayala', query: 'Paano pumunta sa One Ayala galing Monumento?' },
  { label: 'Quiapo → Divisoria', query: 'Paano pumunta sa Divisoria galing Quiapo?' },
  { label: 'Pauwi from work', query: 'Pauwi from work' },
];
const PREFERENCE_LABELS: Record<string, string> = {
  any: 'Any', cheapest: 'Lowest fare', fastest: 'Shortest time', 'fewest-transfers': 'Fewest transfers',
};
const THINKING_MS = 600;

export function AskScreen({ turns, route, origin, destination, activeStep, onEdit, onOptions, onSteps, onMap, onPrompt, onExample,
  thinking, onStartTrip, onSave, warnings, optionCount = 3, unreportedLegs = 0 }: {
  turns: readonly ConversationTurn[]; route: PreviewRoute | null; origin: string; destination: string; activeStep: number | null;
  onEdit: () => void; onOptions: () => void; onSteps: (route: PreviewRoute) => void; onMap: (route: PreviewRoute) => void;
  onPrompt: (query: string) => void; onExample: () => void;
  thinking?: boolean | undefined; onStartTrip?: ((route: PreviewRoute) => void) | undefined;
  onSave?: ((route: PreviewRoute) => void) | undefined; warnings?: readonly string[] | undefined;
  optionCount?: number; unreportedLegs?: number;
}): React.JSX.Element {
  // §3 "Iniisip ko…": driven by the thinking prop, else simulated briefly after a new turn lands.
  const [simulatedThinking, setSimulatedThinking] = useState(false);
  const lastCount = useRef(turns.length);
  useEffect(() => {
    if (thinking !== undefined || turns.length <= lastCount.current) { lastCount.current = turns.length; return; }
    lastCount.current = turns.length;
    setSimulatedThinking(true);
    const timer = setTimeout(() => setSimulatedThinking(false), THINKING_MS);
    return () => clearTimeout(timer);
  }, [turns.length, thinking]);
  const showThinking = thinking ?? simulatedThinking;
  return <View style={ui.screen}>
    {(origin || destination) ? <Pressable accessibilityRole="button" accessibilityLabel="Edit journey context" onPress={onEdit} style={styles.context}>
      <Icon name="pin" size={18}/><Text style={[type.secondary, ui.flex]}>{origin || 'Choose origin'} → {destination || 'Choose destination'}
        {activeStep !== null ? ' · Step ' + (activeStep + 1) : ''}</Text><Text style={[type.label, styles.accent]}>Edit</Text>
    </Pressable> : null}
    {turns.length === 0 ? <View style={{ gap: 16 }}>
      <View style={styles.greeting}><View style={styles.greetingText}>
        <Text style={[type.caption, styles.accent]}>ASK PUSANG GALA</Text>
        <Text accessibilityRole="header" style={type.title}>Saan tayo{ '\n' }pupunta?</Text></View><Gaile pose="wave" height={110}/></View>
      <View style={styles.hint}><Icon name="info" size={17} color={palette.secondary}/>
        <Text style={[type.secondary, ui.flex]}>Ask in Taglish or English. Example: Paano pumunta sa One Ayala galing Monumento?</Text></View>
      <View style={styles.chips}>{SUGGESTIONS.map(item =>
        <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => onPrompt(item.query)}
          style={({ pressed }) => [styles.chip, pressed && ui.pressed]}>
          <Text style={[type.secondary, styles.chipText]}>{item.label}</Text></Pressable>)}</View>
      <Text style={type.secondary}>Your questions stay on this phone.</Text>
      <Button variant="secondary" label="Try the example question" onPress={onExample}/>
    </View> : turns.map(turn => <View key={turn.id} style={{ gap: 18 }}>
      <View style={styles.user}><Text style={type.body}>{turn.query}</Text></View>
      <ResponseCard answer={turn.answer} route={turn.route} explanation={turn.explanation}
        origin={origin} destination={destination} optionCount={optionCount} warnings={warnings} unreportedLegs={unreportedLegs}
        onStartTrip={turn.route ? () => (onStartTrip ?? onSteps)(turn.route!) : undefined}
        onSeeSteps={turn.route ? () => onSteps(turn.route!) : undefined}
        onOptions={turn.route ? onOptions : undefined}
        onMap={turn.route ? () => onMap(turn.route!) : undefined}
        onSave={turn.route && onSave ? () => onSave(turn.route!) : undefined}
        onPrompt={onPrompt}/>
    </View>)}
    {showThinking ? <View style={styles.thinking}>
      <View style={styles.thinkingAvatar}><Gaile pose="think" height={30}/></View>
      <Text style={type.secondary}>Iniisip ko…</Text>
    </View> : null}
  </View>;
}
function ContextChip({ label, marker, accessibilityLabel, onPress }: {
  label: string; marker?: string; accessibilityLabel: string; onPress?: (() => void) | undefined;
}): React.JSX.Element {
  const content = <Text style={[type.secondary, styles.chipText]} numberOfLines={1}>{label}{marker ? ' ' + marker : ''}</Text>;
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
        style={({ pressed }) => [styles.chip, styles.editableChip, pressed && ui.pressed]}>{content}</Pressable>
    : <View style={styles.chip}>{content}</View>;
}
export function AskComposer({ onSubmit, onLocation, origin = '', destination = '', preference, onEditEndpoint, onEditPreference, onEdit }: {
  onSubmit: (query: string) => void; onLocation?: (() => void) | undefined;
  origin?: string; destination?: string; preference?: string | undefined;
  onEditEndpoint?: ((slot: 'origin' | 'destination') => void) | undefined;
  onEditPreference?: (() => void) | undefined; onEdit?: (() => void) | undefined;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  function submit(): void { if (query.trim()) { onSubmit(query.trim()); setQuery(''); } }
  function handleWebKeyPress(event: unknown): void {
    const keyEvent = event as { key: string; shiftKey: boolean; preventDefault: () => void };
    if (keyEvent.key !== 'Enter' || keyEvent.shiftKey) return;
    keyEvent.preventDefault();
    submit();
  }
  const editOrigin = onEditEndpoint ? () => onEditEndpoint('origin') : onEdit;
  const editDestination = onEditEndpoint ? () => onEditEndpoint('destination') : onEdit;
  return <View style={styles.composerStack}>
    {origin || destination || preference ? <View style={styles.chips}>
      {origin ? <ContextChip label={'From: ' + origin} marker="✎" accessibilityLabel="Edit starting point" onPress={editOrigin}/> : null}
      {destination ? <ContextChip label={'To: ' + destination} marker="✎" accessibilityLabel="Edit destination" onPress={editDestination}/> : null}
      {preference ? <ContextChip label={'Preference: ' + (PREFERENCE_LABELS[preference] ?? preference)} marker="▾"
        accessibilityLabel="Change route preference" onPress={onEditPreference ?? onEdit}/> : null}
    </View> : null}
    <View style={styles.composer}>
      <TextInput accessibilityLabel="Ask Pusang Gala" placeholder="Ask Pusang Gala anything…" placeholderTextColor={palette.secondary}
        value={query} onChangeText={setQuery} returnKeyType="send" multiline blurOnSubmit={false}
        onKeyPress={Platform.OS === 'web' ? handleWebKeyPress : undefined}
        style={[type.body, styles.input]}/>
      {onLocation ? <IconButton name="location" label="Use my location" onPress={onLocation}/> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Send question" disabled={!query.trim()}
        accessibilityState={{ disabled: !query.trim() }} onPress={submit} style={[styles.send, !query.trim() && ui.disabled]}>
        <Icon name="send" color={palette.white} size={20}/></Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  greeting: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  greetingText: { flex: 1, minWidth: 170, gap: 6 },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: palette.goldSoft, borderRadius: 14, padding: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { maxWidth: '100%', minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, justifyContent: 'center', borderRadius: 16,
    backgroundColor: palette.background, borderWidth: 1, borderColor: palette.line },
  editableChip: { borderColor: palette.gold },
  chipText: { color: palette.ink },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thinkingAvatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 19, backgroundColor: palette.goldSoft },
  context: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  user: { alignSelf: 'flex-end', maxWidth: '90%', backgroundColor: palette.goldSoft, borderRadius: 18, borderBottomRightRadius: 5, padding: 14 },
  accent: { color: palette.accent },
  composerStack: { gap: 10 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, minWidth: 0, minHeight: 54, maxHeight: 120, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: palette.background, borderRadius: 18, borderWidth: 1, borderColor: palette.line, textAlignVertical: 'center' },
  send: { width: 50, flexShrink: 0, minHeight: 50, borderRadius: 17, backgroundColor: palette.accent, justifyContent: 'center', alignItems: 'center' },
});
