import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Gaile, Icon, palette, type, ui } from '../ui/travel';
import type { PreviewRoute } from './previewJourney';

export interface ConversationTurn { id: number; query: string; answer: string; route?: PreviewRoute; }
export function AskScreen({ turns, route, origin, destination, activeStep, onEdit, onOptions, onSteps, onMap, onPrompt, onExample }: {
  turns: readonly ConversationTurn[]; route: PreviewRoute | null; origin: string; destination: string; activeStep: number | null;
  onEdit: () => void; onOptions: () => void; onSteps: (route: PreviewRoute) => void; onMap: (route: PreviewRoute) => void; onPrompt: (query: string) => void; onExample: () => void;
}): React.JSX.Element {
  return <View style={ui.screen}>
    {(origin || destination) ? <Pressable accessibilityRole="button" accessibilityLabel="Edit journey context" onPress={onEdit} style={styles.context}>
      <Icon name="pin" size={18}/><Text style={[type.secondary, ui.flex]}>{origin || 'Choose origin'} → {destination || 'Choose destination'}
        {activeStep !== null ? ' · Step ' + (activeStep + 1) : ''}</Text><Text style={[type.label, styles.accent]}>Edit</Text>
    </Pressable> : null}
    {turns.length === 0 ? <View style={{ gap: 16 }}>
      <View style={styles.greeting}><View style={styles.greetingText}>
        <Text style={[type.caption, styles.accent]}>ASK GAILE</Text>
        <Text accessibilityRole="header" style={type.title}>Let’s figure out{ '\n' }your commute.</Text></View><Gaile pose="think" height={110}/></View>
      <Text style={type.body}>Ask how to get somewhere, compare your options, or understand a transfer.</Text>
      <Text style={type.secondary}>The local assistant isn’t connected in this preview. Example questions show the conversation layout.</Text>
      <Button variant="secondary" label="Try the example question" onPress={onExample}/>
    </View> : turns.map(turn => <View key={turn.id} style={{ gap: 18 }}>
      <View style={styles.user}><Text style={type.body}>{turn.query}</Text></View>
      {turn.route ? <View style={styles.route}>
        <Text style={[type.caption, styles.overline]}>ROUTE INFORMATION · EXAMPLE</Text>
        <Text style={type.heading}>{turn.route.title}</Text>
        <Text style={type.body}>{turn.route.time} · {turn.route.fare}</Text>
        <Text style={type.secondary}>{turn.route.transfers === 0 ? 'No transfers' : turn.route.transfers + ' transfer'} · illustrative reported values</Text>
        <View style={ui.row}><Button variant="text" label="Directions" icon="arrow" onPress={() => onSteps(turn.route!)}/>
          <Button variant="text" label="Map" onPress={() => onMap(turn.route!)}/></View>
      </View> : null}
      <View style={{ gap: 6 }}><View style={styles.assistant}><Gaile pose="think" height={36}/>
        <View style={ui.flex}><Text style={type.label}>Gaile</Text><Text style={[type.caption, styles.overline]}>BASIC SUMMARY · AI UNAVAILABLE</Text></View></View>
        <Text style={type.body}>{turn.answer}</Text></View>
    </View>)}
    {route && turns.length > 0 ? <View style={styles.followups}>
      <Button variant="secondary" label="Other options" onPress={onOptions}/>
      <Button variant="secondary" label="Where do I get off?" onPress={() => onPrompt('Saan ako bababa?')}/>
      <Button variant="text" label="Reported operating hours" onPress={() => onPrompt('Anong oras last trip?')}/>
    </View> : null}
  </View>;
}
export function AskComposer({ onSubmit }: { onSubmit: (query: string) => void }): React.JSX.Element {
  const [query, setQuery] = useState('');
  function submit(): void { if (query.trim()) { onSubmit(query.trim()); setQuery(''); } }
  return <View style={styles.composer}>
    <TextInput accessibilityLabel="Ask Pusang Gala" placeholder="Ask about your commute…" placeholderTextColor={palette.secondary}
      value={query} onChangeText={setQuery} onSubmitEditing={submit} returnKeyType="send"
      style={[type.body, styles.input]}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Send question" disabled={!query.trim()}
      accessibilityState={{ disabled: !query.trim() }} onPress={submit} style={[styles.send, !query.trim() && ui.disabled]}>
      <Icon name="send" color={palette.white} size={20}/></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  greeting: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  greetingText: { flex: 1, minWidth: 170, gap: 6 },
  assistant: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  context: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  user: { alignSelf: 'flex-end', maxWidth: '90%', backgroundColor: palette.goldSoft, borderRadius: 14, padding: 14 },
  route: { gap: 8, borderLeftWidth: 3, borderLeftColor: palette.accent, paddingLeft: 16 },
  overline: { fontWeight: '600', color: palette.secondary }, accent: { color: palette.accent },
  followups: { gap: 10, alignItems: 'flex-start', paddingTop: 8 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: palette.background, borderRadius: 12, borderWidth: 1, borderColor: palette.line },
  send: { width: 50, flexShrink: 0, minHeight: 50, borderRadius: 12, backgroundColor: palette.accent, justifyContent: 'center', alignItems: 'center' },
});
