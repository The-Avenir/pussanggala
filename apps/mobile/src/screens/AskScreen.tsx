import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Gaile, GaileMessage, Icon, palette, type, ui } from '../ui/travel';
import type { PreviewRoute } from './previewJourney';
import type { AssistantPhase } from '../inference/useLocalAssistant';
import type { Card, HourStatement, PlaceCandidate } from '@pusang-gala/core';
import { RouteDetails } from './RouteEvidence';

export interface ConversationTurn { id: number; query: string; answer: string; route?: PreviewRoute; localAi?: boolean; aiNotice?: string; showDirections?: boolean;
  packId?: string; cards?: readonly Card[]; hours?: readonly HourStatement[]; candidates?: readonly PlaceCandidate[]; streaming?: boolean; }
export function AskScreen({ turns, route, origin, destination, activeStep, onEdit, onOptions, onSteps, onMap, onPrompt, onPickPlace, onExample,
  assistantPhase, assistantInstalled, packReady, isStreaming, onCancel, onResources }: {
  turns: readonly ConversationTurn[]; route: PreviewRoute | null; origin: string; destination: string; activeStep: number | null;
  onEdit: () => void; onOptions: () => void; onSteps: (route: PreviewRoute) => void; onMap: (route: PreviewRoute) => void; onPrompt: (query: string) => void; onExample: () => void;
  onPickPlace: (candidate: PlaceCandidate) => void;
  assistantPhase: AssistantPhase; assistantInstalled: boolean; onCancel: () => void; onResources: () => void;
  packReady: boolean;
  isStreaming: boolean;
}): React.JSX.Element {
  return <View style={ui.screen}>
    {(origin || destination) ? <Pressable accessibilityRole="button" accessibilityLabel="Edit journey context" onPress={onEdit} style={styles.context}>
      <Icon name="pin" size={18}/><Text style={[type.secondary, ui.flex]}>{origin || 'Choose origin'} → {destination || 'Choose destination'}
        {activeStep !== null ? ' · Step ' + (activeStep + 1) : ''}</Text><Text style={[type.label, styles.accent]}>Edit</Text>
    </Pressable> : null}
    {turns.length === 0 ? <View style={{ gap: 16 }}>
      <View style={styles.greeting}><Gaile pose="think" height={144}/></View>
      <GaileMessage pose="wave"><Text style={type.body}>Hi, traveler! Where are we heading today? Tell me the place, and I’ll help you figure out how to get there.</Text></GaileMessage>
      {!packReady ? <Text style={type.secondary}>Your offline routes are unavailable. You can check them in Offline resources.</Text> : null}
      {!assistantInstalled ? <Button variant="text" label="Set up local assistant" onPress={onResources}/> : null}
      <Button variant="secondary" label="Try the example question" disabled={isStreaming || assistantPhase !== 'idle'} onPress={onExample}/>
    </View> : turns.map(turn => <View key={turn.id} style={{ gap: 12 }}>
      <View style={styles.user}><Text style={[type.body, styles.userText]}>{turn.query}</Text></View>
      <GaileMessage><Text testID={`reply-${turn.id}`} style={type.body}>{turn.answer || (turn.streaming ? 'Gaile is typing…' : '')}{turn.streaming && turn.answer ? ' ▍' : ''}</Text>
        {turn.aiNotice ? <Text style={type.caption}>{turn.aiNotice}</Text> : null}</GaileMessage>
      {turn.route ? <View style={styles.route}>
        <Text style={[type.caption, styles.overline]}>ROUTE INFORMATION · EXAMPLE</Text>
        <View style={ui.row}><Icon name={turn.route.title.includes('MRT') ? 'train' : 'bus'} color={palette.rail}/><Text style={[type.heading, ui.flex]}>{turn.route.title}</Text></View>
        <View style={styles.routeMetrics}><Text style={type.label}>{turn.route.time}</Text><Text style={type.label}>{turn.route.fare}</Text></View>
        <Text style={type.secondary}>{turn.route.transfers === 0 ? 'No transfers' : turn.route.transfers + ' transfer'} · example estimates</Text>
        <View style={ui.row}><Button variant="text" label="Directions" icon="arrow" onPress={() => onSteps(turn.route!)}/>
          <Button variant="text" label="Map" onPress={() => onMap(turn.route!)}/></View>
      </View> : null}
      {turn.cards?.length && turn.showDirections !== false ? <RouteDetails cards={turn.cards} hours={turn.hours ?? []}/> : null}
      {turn.candidates && turn.id === turns.at(-1)?.id ? turn.candidates.map((candidate, index) =>
        <Button key={candidate.placeId} variant="secondary" disabled={isStreaming || assistantPhase !== 'idle'} label={`${index + 1}. ${candidate.name} · ${candidate.area}`} onPress={() => onPickPlace(candidate)}/>) : null}
    </View>)}
    {assistantPhase !== 'idle' || isStreaming ? <View style={{ gap: 8 }}><Text style={type.secondary}>{assistantPhase === 'loading' ? 'Loading the local assistant…' : 'Writing a reply…'}</Text>
      <Button label="Stop reply" variant="secondary" onPress={onCancel}/></View> : null}
    {(route || turns.at(-1)?.cards?.length) && turns.length > 0 ? <View style={styles.followups}>
      <Button variant="secondary" label="Other options" disabled={isStreaming || assistantPhase !== 'idle'} onPress={route ? onOptions : () => onPrompt('Other routes')}/>
      <Button variant="secondary" label="Where do I get off?" disabled={isStreaming || assistantPhase !== 'idle'} onPress={() => onPrompt('Saan ako bababa?')}/>
      <Button variant="text" label="How much is the fare?" disabled={isStreaming || assistantPhase !== 'idle'} onPress={() => onPrompt('How much is the fare?')}/>
      <Button variant="text" label="How long is the journey?" disabled={isStreaming || assistantPhase !== 'idle'} onPress={() => onPrompt('How long is the journey?')}/>
      <Button variant="text" label="Operating hours" disabled={isStreaming || assistantPhase !== 'idle'} onPress={() => onPrompt('Anong oras last trip?')}/>
    </View> : null}
  </View>;
}
export function AskComposer({ onSubmit, disabled = false }: { onSubmit: (query: string) => void; disabled?: boolean }): React.JSX.Element {
  const [query, setQuery] = useState('');
  function submit(): void { if (!disabled && query.trim()) { onSubmit(query.trim()); setQuery(''); } }
  function handleWebKeyPress(event: unknown): void {
    const keyEvent = event as { key: string; shiftKey: boolean; preventDefault: () => void };
    if (keyEvent.key !== 'Enter' || keyEvent.shiftKey) return;
    keyEvent.preventDefault();
    submit();
  }
  return <View style={styles.composer}>
    <Icon name="chat" size={18} color={palette.accent}/>
    <TextInput accessibilityLabel="Ask Pusang Gala" placeholder="Message Gaile…" placeholderTextColor={palette.secondary}
      value={query} onChangeText={setQuery} returnKeyType="send" multiline blurOnSubmit={false}
      onKeyPress={Platform.OS === 'web' ? handleWebKeyPress : undefined}
      style={[type.body, styles.input]}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Send question" disabled={disabled || !query.trim()}
      accessibilityState={{ disabled: disabled || !query.trim() }} onPress={submit} style={[styles.send, (disabled || !query.trim()) && ui.disabled]}>
      <Icon name="send" color={palette.white} size={20}/></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  greeting: { alignItems: 'center', paddingVertical: 8 },
  context: { padding: 12, borderWidth: 1, borderColor: palette.line, borderRadius: 14, backgroundColor: palette.background, flexDirection: 'row', alignItems: 'center', gap: 8 },
  user: { alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: palette.accent, borderRadius: 14, borderBottomRightRadius: 3, paddingHorizontal: 14, paddingVertical: 10 },
  userText: { color: palette.white },
  route: { marginLeft: 40, gap: 8, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, borderRadius: 14, padding: 12 },
  routeMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 8, borderTopWidth: 1, borderColor: palette.line },
  overline: { fontWeight: '600', color: palette.secondary }, accent: { color: palette.accent },
  followups: { gap: 8, flexDirection: 'row', flexWrap: 'wrap', paddingTop: 8 },
  composer: { flexDirection: 'row', gap: 4, alignItems: 'center', borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, borderRadius: 28, padding: 5, paddingLeft: 12 },
  input: { flex: 1, minWidth: 0, minHeight: 46, maxHeight: 120, paddingVertical: 10, paddingHorizontal: 10, textAlignVertical: 'center' },
  send: { width: 46, flexShrink: 0, minHeight: 46, borderRadius: 23, backgroundColor: palette.accent, justifyContent: 'center', alignItems: 'center' },
});
