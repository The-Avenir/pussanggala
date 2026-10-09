import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Gaile, Icon, ListRow, Notice, Section, palette, type, ui } from '../ui/travel';
import { LocalAssistantResource } from './LocalAssistantResource';
import type { LocalAssistant } from '../inference/useLocalAssistant';
import type { SavedRouteRow, TripHistoryRow } from '../store/tripStore';
import { PreferenceChips } from './Preferences';
import type { Preference } from './previewJourney';

export type SettingsPage = 'settings' | 'offline' | 'privacy' | 'about';
export function SettingsScreen({ preference, onPreference, onOpen, onLocation, assistantInstalled }: {
  preference: Preference; onPreference: (value: Preference) => void;
  onOpen: (page: SettingsPage) => void; onLocation: () => void;
  assistantInstalled: boolean;
}): React.JSX.Element {
  const [showPreference, setShowPreference] = useState(false);
  return <View style={ui.screen}>
    <Text accessibilityRole="header" style={type.title}>Settings</Text>
    <Section title="JOURNEY"><ListRow title="Default route sort" value={preference === 'cheapest' ? 'Fare' : preference === 'fastest' ? 'Time' : 'Transfers'}
      onPress={() => setShowPreference(value => !value)}/>
      {showPreference ? <PreferenceChips preference={preference} onSelect={onPreference}/> : null}
      <ListRow title="Location" value="Unavailable" icon="location" onPress={onLocation}/>
      <Text style={[type.secondary, { paddingTop: 8 }]}>Position is used only while the app is open. Steps advance when you mark them.</Text>
    </Section>
    <Section title="ON THIS PHONE"><ListRow title="Offline resources" icon="map" value={assistantInstalled ? '2 missing' : '3 missing'} onPress={() => onOpen('offline')}/>
      <ListRow title="Storage & privacy" icon="save" onPress={() => onOpen('privacy')}/></Section>
    <Section title="ABOUT"><ListRow title="Reading route reports" icon="info" onPress={() => onOpen('about')}/>
      <ListRow title="Licences & attribution" onPress={() => onOpen('about')}/></Section>
    <Text style={type.secondary}>Text follows your device’s accessibility settings.</Text>
  </View>;
}
export function OfflineDataScreen({ checkedAt, onCheck, assistant }: { checkedAt: string | null; onCheck: () => void; assistant: LocalAssistant }): React.JSX.Element {
  return <View style={ui.screen}>
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={type.title}>What works{ '\n' }offline</Text>
      <Text style={type.body}>Install the local assistant here. Route data and the basemap aren’t included in this preview.</Text></View>
    <LocalAssistantResource assistant={assistant}/>
    <View>{[
      { name: 'Route data', detail: 'New route searches unavailable. Version and source dates unknown.', icon: 'bus' as const },
      { name: 'NCR basemap', detail: 'Street map unavailable. Existing routes can use a stop diagram.', icon: 'map' as const },
    ].map(item => <View key={item.name} style={styles.resource}>
      <Icon name={item.icon} color={palette.secondary}/>
      <View style={ui.flex}><View style={ui.between}><Text style={[type.label, ui.flex]}>{item.name}</Text>
        <Text style={[type.secondary, { color: palette.warning }]}>Missing</Text></View>
        <Text style={type.secondary}>{item.detail}</Text></View>
    </View>)}</View>
    <ListRow title="Installed model size" value={assistant.model.phase === 'installed' ? '491 MB' : 'Not installed'}/>
    <Notice>Example journeys are available to explore the design. They aren’t installed route data.</Notice>
    <Button label="Recheck local files" variant="secondary" onPress={onCheck}
      disabled={assistant.model.phase === 'unsupported' || ['checking', 'selecting', 'importing', 'downloading', 'verifying'].includes(assistant.model.phase) || assistant.phase !== 'idle'}/>
    {checkedAt ? <Text accessibilityRole="alert" style={type.secondary}>Checked {checkedAt}. Local assistant: {assistant.model.phase}. Route data and basemap are missing.</Text> : null}
  </View>;
}
export function PrivacyScreen({ onDelete }: { onDelete: () => void }): React.JSX.Element {
  return <View style={ui.screen}><Text accessibilityRole="header" style={type.title}>Your data,{ '\n' }on your phone.</Text>
    <Section title="KEPT LOCALLY"><Text style={type.body}>Saved route IDs, labels, preferences, history and your manual trip step.</Text>
      <Text style={type.secondary}>This preview keeps these in memory for this session. Persistent storage isn’t connected.</Text></Section>
    <Section title="NOT SAVED"><Text style={type.body}>Raw conversation text and GPS coordinates. No uploads, analytics or cloud sync.</Text>
      <Text style={type.secondary}>Your conversation exists only in memory and clears when you start a new conversation or close the app.</Text></Section>
    <ListRow title="Delete all my data" detail="Saved routes, history, preferences and active trip" destructive onPress={onDelete}/>
  </View>;
}
export function AboutScreen(): React.JSX.Element {
  return <View style={ui.screen}><View style={ui.row}><Gaile pose="idle" height={40}/><Text accessibilityRole="header" style={type.title}>Pusang Gala</Text></View>
    <Text style={type.secondary}>Travel utility · UI design preview</Text>
    <Section title="READING ROUTE INFORMATION"><Text style={type.body}>Community reports are dated accounts, not field-verified or live information. Confirm your signboard and alighting point before boarding.</Text>
      <Text style={type.body}>Unknown fares and hours stay unknown. Conflicting reports remain separate. Dashed links and stop diagrams show order, not the road path.</Text></Section>
    <Section title="DATA & ATTRIBUTION"><Text style={type.secondary}>Production route facts: paraphrased community evidence from r/HowToGetTherePH, with source references. This preview uses synthetic walkthrough records, without source dates or links.</Text>
      <Text style={type.secondary}>Gaile mascot: supplied Pusang Gala assets. Interface icons and stop diagram: app vectors. Typography: bundled Nunito headings and DM Sans body text. Local assistant: Qwen2.5-0.5B-Instruct by Qwen, Apache 2.0; llama.cpp and llama.rn, MIT. Map licences must accompany their assets.</Text></Section>
  </View>;
}
export function SavedScreen({ saved, history, segment, onSegment, onOpen, onOpenHistory, onDelete, onRename, onClearHistory, onDeleteHistory, onPlan }: {
  saved: readonly SavedRouteRow[]; history: readonly TripHistoryRow[]; segment: 'saved' | 'history'; onSegment: (value: 'saved' | 'history') => void;
  onOpen: (row: SavedRouteRow) => void; onOpenHistory: (row: TripHistoryRow) => void; onDelete: (id: string) => void;
  onRename: (id: string, label: string) => void; onClearHistory: () => void; onDeleteHistory: (id: string) => void; onPlan: () => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [manage, setManage] = useState<string | null>(null);
  return <View style={ui.screen}>
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={type.title}>Your trips</Text>
      <Text style={type.secondary}>Familiar journeys, easier to find again.</Text></View>
    <View style={styles.segments}>{(['saved', 'history'] as const).map(value => <Pressable key={value} accessibilityRole="button"
      accessibilityLabel={value === 'saved' ? 'Saved routes' : 'Trip history'} accessibilityState={{ selected: segment === value }}
      onPress={() => onSegment(value)} style={[styles.segment, segment === value && styles.selected]}>
      <Text style={[type.label, segment === value && { color: palette.accent }]}>{value === 'saved' ? 'Saved' : 'History'}</Text></Pressable>)}</View>
    {segment === 'saved' ? saved.length === 0 ? <View style={{ gap: 12, paddingVertical: 16 }}><Gaile pose="binoculars" height={115}/>
      <Text style={type.heading}>A route worth keeping?</Text><Text style={type.body}>Save it from Directions. Your saved journeys will appear here.</Text>
      <Button variant="text" label="Plan a journey" icon="arrow" onPress={onPlan}/></View>
      : <View>{saved.map(row => <View key={row.saved_id} style={styles.savedRow}>
        {editing === row.saved_id ? <View style={{ gap: 8 }}><TextInput accessibilityLabel="Saved route name" value={label} onChangeText={setLabel}
          style={[type.body, ui.input]} maxLength={80} autoFocus/>
          <View style={ui.row}><Button label="Save name" disabled={!label.trim()} onPress={() => { onRename(row.saved_id, label.trim()); setEditing(null); }}/>
            <Button label="Cancel rename" variant="text" onPress={() => setEditing(null)}/></View></View>
          : <ListRow title={row.label} detail="Monumento → One Ayala" icon="save" onPress={() => onOpen(row)}/>}
        <View style={ui.between}><Text style={type.caption}>Saved {new Date(row.created_at).toLocaleDateString()}</Text>
          <Button variant="text" label="Manage route" onPress={() => setManage(manage === row.saved_id ? null : row.saved_id)}/></View>
        {manage === row.saved_id ? <View style={ui.row}><Button variant="text" label="Rename" onPress={() => { setEditing(row.saved_id); setLabel(row.label); }}/>
          <Button variant="text" label="Delete route" onPress={() => onDelete(row.saved_id)}/></View> : null}
      </View>)}</View>
      : <View>{history.length === 0 ? <Text style={type.body}>Journeys you look up or take will appear here.</Text>
        : history.slice().reverse().map(row => <View key={row.history_id} style={styles.savedRow}>
          <ListRow title="Monumento → One Ayala" detail={(row.kind === 'taken' ? 'Taken' : 'Looked up') + ' · ' + new Date(row.at).toLocaleDateString()}
            onPress={() => onOpenHistory(row)}/>
          <Button variant="text" label="Delete entry" onPress={() => onDeleteHistory(row.history_id)}/></View>)}
        {history.length > 0 ? <Button variant="text" label="Clear history" onPress={onClearHistory}/> : null}</View>}
    <Text style={type.caption}>Example journeys stay in memory for this session.</Text>
  </View>;
}
const styles = StyleSheet.create({
  resource: { flexDirection: 'row', gap: 14, paddingVertical: 20, borderBottomWidth: 1, borderColor: palette.line },
  segments: { flexDirection: 'row', padding: 3, gap: 3, borderRadius: 10, backgroundColor: palette.background },
  segment: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 8 },
  selected: { backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line },
  savedRow: { paddingBottom: 12, borderBottomWidth: 1, borderColor: palette.line },
});
