import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AnswerCat, Check, OrangeBus, BluePin, Send, Target } from '../ui/assets';
import { Action, Card, FactRow, StatusChip } from '../ui/components';
import { colors, typography } from '../ui/theme';
import type { Preference, PreviewRoute } from './previewJourney';
import { TripSummary } from './RouteScreens';
import { PreferenceChips } from './Preferences';

export function AskScreen({ route, question, message, preference, onExample, onOptions, onSteps, onLocation, onSave }: {
  route: PreviewRoute | null; question: string; message: string | null; preference: Preference;
  onExample: () => void; onOptions: (preference: Preference) => void;
  onSteps: () => void; onLocation: () => void; onSave: () => void;
}): React.JSX.Element {
  return <View style={styles.screen}>
    <StatusChip label="Offline UI preview · NCR" Icon={Check} tone="green" />
    <Text style={typography.title}>Saan tayo pupunta?</Text>
    <Text style={[typography.body, styles.muted]}>Ask in Taglish. Your commute stays local.</Text>
    {question ? <Card tone="blueSoft"><Text style={typography.body}>{question}</Text></Card> : null}
    {message ? <Card><Text accessibilityRole="alert" style={typography.body}>{message}</Text>
      <Action secondary label="Explore the example journey" onPress={onExample} /></Card> : null}
    {route ? <>
      <Pressable accessibilityRole="button" accessibilityLabel="See route steps" onPress={onSteps}>
        <Card>
          <FactRow Icon={BluePin} title="Start at LRT-1 Monumento" subtitle="Caloocan · reported boarding point" />
          <FactRow Icon={OrangeBus} title={route.title} subtitle={`${route.steps.filter(step => step.mode === 'ride').length} rides · ${route.transfers} transfers`} />
          <FactRow Icon={BluePin} title="Get off at One Ayala" subtitle="Makati · check the landmark before alighting" />
          <TripSummary route={route} />
          <Text style={typography.caption}>Walkthrough example · route pack not installed</Text>
        </Card>
      </Pressable>
      <View style={styles.answer}><AnswerCat /><View style={styles.answerText}>
        <Text style={typography.body}>Tara! Explore this example from Monumento to One Ayala.</Text>
        <Text style={typography.caption}>Basic summary · example cards above</Text>
      </View></View>
      <PreferenceChips preference={preference} onSelect={onOptions} />
      <View style={styles.chips}><Action secondary label="See steps →" onPress={onSteps} style={styles.flex} />
        <Action secondary label="☆ Save" onPress={onSave} style={styles.flex} /></View>
    </> : <Card tone="orangeSoft">
      <Text style={typography.heading}>Your next lakbay starts here.</Text>
      <Text style={typography.body}>Ask in Taglish or English. Try: Paano pumunta sa One Ayala galing Monumento?</Text>
      <Text style={typography.caption}>Route data is not installed in this preview. You can explore the example journey.</Text>
      <Action label="Explore Monumento → One Ayala" onPress={onExample} />
    </Card>}
    <Pressable accessibilityRole="button" onPress={onLocation} style={styles.location}>
      <Target /><Text style={typography.caption}>Use my location</Text>
    </Pressable>
  </View>;
}

export function AskComposer({ onSubmit }: { onSubmit: (query: string) => void }): React.JSX.Element {
  const [query, setQuery] = useState('');
  function submit(): void {
    if (!query.trim()) return;
    onSubmit(query.trim()); setQuery('');
  }
  return <View style={styles.composer}>
      <TextInput accessibilityLabel="Ask Pusang Gala" placeholder="Ask Pusang Gala anything…"
        placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} onSubmitEditing={submit}
        returnKeyType="send" style={[typography.body, styles.input]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Send question" accessibilityState={{ disabled: !query.trim() }}
        disabled={!query.trim()} onPress={submit} style={styles.send}><Send /></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  screen: { gap: 16, flexGrow: 1 }, muted: { color: colors.muted },
  chips: { flexDirection: 'row', gap: 8 },
  answer: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, answerText: { flex: 1, gap: 6 },
  flex: { flex: 1 }, location: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 24, minHeight: 48, paddingHorizontal: 14 },
  send: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
