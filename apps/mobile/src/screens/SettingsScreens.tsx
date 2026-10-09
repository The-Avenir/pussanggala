import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Gaile, Icon, ListRow, Notice, Section, palette, type, ui } from '../ui/travel';
import type { IconName } from '../ui/travel';
import { summarizeReadiness } from '../assets/readiness';
import type { SavedRouteRow, TripHistoryRow, TripPreference } from '../store/tripStore';
import { PreferenceChips } from './Preferences';
import type { Preference } from './previewJourney';

export type SettingsPage = 'settings' | 'offline' | 'privacy' | 'about';
export type ReplyLanguage = 'taglish' | 'english';
export type TextSize = 'default' | 'large';

// Walkthrough §6 ranking vocabulary; saved/history rows store the wider TripPreference union.
const PREFERENCE_LABELS: Record<TripPreference, string> = {
  cheapest: 'Cheapest', fastest: 'Fastest', 'fewest-transfers': 'Fewest transfers',
  'least-walk': 'Least walking', balanced: 'Balanced',
};

// Optional-controlled prop: the shell's value wins when wired, else a preview default holds state.
function useSetting<T>(controlled: T | undefined, fallback: T, onChange?: (value: T) => void): [T, (next: T) => void] {
  const [local, setLocal] = useState(fallback);
  return [controlled === undefined ? local : controlled, (next: T) => { setLocal(next); onChange?.(next); }];
}

export function SettingsScreen({ preference, onPreference, onOpen, onLocation,
  walkingUnits, onWalkingUnits, replyLanguage, onReplyLanguage, persona, onPersona,
  textSize, onTextSize, onAccount }: {
  preference: Preference; onPreference: (value: Preference) => void;
  onOpen: (page: SettingsPage) => void; onLocation: () => void;
  walkingUnits?: boolean; onWalkingUnits?: (value: boolean) => void;
  replyLanguage?: ReplyLanguage; onReplyLanguage?: (value: ReplyLanguage) => void;
  persona?: boolean; onPersona?: (value: boolean) => void;
  textSize?: TextSize; onTextSize?: (value: TextSize) => void;
  onAccount?: () => void;
}): React.JSX.Element {
  const [showPreference, setShowPreference] = useState(false);
  const [units, setUnits] = useSetting(walkingUnits, true, onWalkingUnits);
  const [language, setLanguage] = useSetting(replyLanguage, 'taglish', onReplyLanguage);
  const [catPersona, setCatPersona] = useSetting(persona, true, onPersona);
  const [size, setSize] = useSetting(textSize, 'default', onTextSize);
  return <View style={ui.screen}>
    <Text accessibilityRole="header" style={type.title}>Settings</Text>
    <Section title="TRIP PREFERENCES">
      <ListRow title="Default preference" value={PREFERENCE_LABELS[preference]}
        onPress={() => setShowPreference(value => !value)}/>
      {showPreference ? <PreferenceChips preference={preference} onSelect={onPreference}/> : null}
      <ListRow title="Walking distance" detail="Show distance in m/min" icon="walk"
        value={units ? 'On' : 'Off'} onPress={() => setUnits(!units)}/>
    </Section>
    <Section title="LANGUAGE & ASSISTANT">
      <ListRow title="Reply language" detail="How Gaile phrases explanations" icon="chat"
        value={language === 'taglish' ? 'Taglish' : 'English'}
        onPress={() => setLanguage(language === 'taglish' ? 'english' : 'taglish')}/>
      <ListRow title="Gaile's personality" detail="Plain mode gives short factual answers"
        value={catPersona ? 'On' : 'Off'} onPress={() => setCatPersona(!catPersona)}/>
      <ListRow title="Text size" detail="Also follows your device's font settings"
        value={size === 'large' ? 'Large' : 'Default'} onPress={() => setSize(size === 'default' ? 'large' : 'default')}/>
    </Section>
    <Section title="LOCATION">
      <ListRow title="Permission" icon="location" value="Not granted"
        detail="Location is off. Type or pick your starting point." onPress={onLocation}/>
      <Text style={[type.secondary, { paddingTop: 8 }]}>Use location only while the app is open.</Text>
    </Section>
    <Section title="ON THIS PHONE"><ListRow title="Offline resources" icon="map" value="3 missing" onPress={() => onOpen('offline')}/>
      <ListRow title="Storage & privacy" icon="save" onPress={() => onOpen('privacy')}/></Section>
    <Section title="ACCOUNT">
      {onAccount
        ? <ListRow title="Sign in with Google" detail="Needs internet · accounts are coming later" onPress={onAccount}/>
        : <ListRow title="Sign in with Google" detail="Needs internet · accounts are coming later"/>}
    </Section>
    <Section title="ABOUT"><ListRow title="Reading route reports" icon="info" onPress={() => onOpen('about')}/>
      <ListRow title="Licences & attribution" onPress={() => onOpen('about')}/></Section>
  </View>;
}

// Walkthrough §13a per-asset detail fields. The preview ships no assets, so every
// measured field shows "—" and status stays Missing; there is no download affordance (F8).
interface OfflineAsset {
  readonly name: string;
  readonly icon: IconName;
  readonly status: 'Ready' | 'Missing' | 'Failed';
  readonly fields: readonly string[];
  readonly note: string;
}
const OFFLINE_ASSETS: readonly OfflineAsset[] = [
  { name: 'Route pack', icon: 'bus', status: 'Missing',
    fields: ['Version —', 'Build date —', 'Size —', 'Reports posted —'],
    note: 'New route searches unavailable. Saved routes and history still open.' },
  { name: 'AI model', icon: 'chat', status: 'Missing',
    fields: ['Model —', 'Size —', 'Supported on this phone —'],
    note: 'Smart explanations unavailable. Route cards still open with a basic summary.' },
  { name: 'Offline map', icon: 'map', status: 'Missing',
    fields: ['Coverage NCR', 'Size —'],
    note: 'Map unavailable. Routes can still show a stop diagram.' },
];

export function OfflineDataScreen({ checkedAt, onCheck }: { checkedAt: string | null; onCheck: () => void }): React.JSX.Element {
  const readiness = summarizeReadiness([]);
  return <View style={ui.screen}>
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={type.title}>What works{ '\n' }offline</Text>
      <Text style={type.body}>Resources ship inside the Android app — nothing is downloaded. This preview doesn't include them.</Text></View>
    <View>{OFFLINE_ASSETS.map(item => <View key={item.name} style={styles.resource}>
      <Icon name={item.icon} color={palette.secondary}/>
      <View style={ui.flex}><View style={ui.between}><Text style={[type.label, ui.flex]}>{item.name}</Text>
        <Text style={[type.secondary, { color: item.status === 'Ready' ? palette.success : palette.warning }]}>{item.status}</Text></View>
        <Text style={type.secondary}>{item.fields.join(' · ')}</Text>
        <Text style={type.caption}>{item.note}</Text></View>
    </View>)}</View>
    <ListRow title="Installed size" value="Not measured"/>
    <Notice>Example journeys are available to explore the design. They aren't installed route data.</Notice>
    <Button label="Re-check files" variant="secondary" onPress={onCheck}/>
    {checkedAt ? <Text accessibilityRole="alert" style={type.secondary}>Checked {checkedAt}. Status: {readiness.state}. File validation isn't connected; no resource was downloaded.</Text> : null}
    <Text style={type.caption}>If files stay missing after re-checking, reinstall the app — there is no in-app update.</Text>
  </View>;
}
export function PrivacyScreen({ onDelete }: { onDelete: () => void }): React.JSX.Element {
  return <View style={ui.screen}><Text accessibilityRole="header" style={type.title}>Your data,{ '\n' }on your phone.</Text>
    <Section title="STORED ON THIS PHONE"><Text style={type.body}>Saved routes (record IDs and your labels), trip history, settings and your active-trip step.</Text>
      <Text style={type.secondary}>This preview keeps these in memory for this session. Persistent storage isn't connected.</Text></Section>
    <Section title="NOT STORED"><Text style={type.body}>Chat text and GPS coordinates. Nothing is uploaded — no analytics or cloud sync.</Text>
      <Text style={type.secondary}>Your conversation exists only in memory and clears when you start a new conversation or close the app.</Text></Section>
    <ListRow title="Delete all my data" detail="Saved routes, history, preferences and active trip" destructive onPress={onDelete}/>
  </View>;
}
export function AboutScreen(): React.JSX.Element {
  return <View style={ui.screen}><View style={ui.row}><Gaile pose="idle" height={40}/><Text accessibilityRole="header" style={type.title}>Pusang Gala</Text></View>
    <Text style={type.secondary}>Kahit saan ang lakbay, handang pumatnubay.</Text>
    <ListRow title="App version" value="0.1.0 · design preview"/>
    <Section title="READING ROUTE INFORMATION"><Text style={type.body}>Community reports are dated accounts, not field-verified or live information. Confirm your signboard and alighting point before boarding.</Text>
      <Text style={type.body}>Unknown fares and hours stay unknown. Conflicting reports remain separate. Dashed links and stop diagrams show order, not the road path.</Text>
      <Text style={type.body}>Information is community-reported and may be outdated.</Text></Section>
    <Section title="DATA & ATTRIBUTION"><Text style={type.secondary}>Data source: community reports from r/HowToGetTherePH, paraphrased, with source references. This preview uses synthetic walkthrough records, without source dates or links.</Text>
      <Text style={type.secondary}>Map data © OpenStreetMap contributors; bundled tiles and licence notices ship with the map assets. The AI model's licence and attribution ship with the bundled model file.</Text>
      <Text style={type.secondary}>Gaile mascot: supplied Pusang Gala assets. Interface icons and stop diagram: app vectors. Typography: bundled Nunito headings and DM Sans body text.</Text></Section>
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
      <Text style={type.heading}>A route worth keeping?</Text><Text style={type.body}>Save a route with ☆ to find it here.</Text>
      <Button variant="text" label="Plan a journey" icon="arrow" onPress={onPlan}/></View>
      : <View>{saved.map(row => <View key={row.saved_id} style={styles.savedRow}>
        {editing === row.saved_id ? <View style={{ gap: 8 }}><TextInput accessibilityLabel="Saved route name" value={label} onChangeText={setLabel}
          style={[type.body, ui.input]} maxLength={80} autoFocus/>
          <View style={ui.row}><Button label="Save name" disabled={!label.trim()} onPress={() => { onRename(row.saved_id, label.trim()); setEditing(null); }}/>
            <Button label="Cancel rename" variant="text" onPress={() => setEditing(null)}/></View></View>
          : <ListRow title={row.label} detail="Monumento → One Ayala" icon="save" onPress={() => onOpen(row)}/>}
        <View style={ui.between}><Text style={type.caption}>{'Preference: ' + PREFERENCE_LABELS[row.preference] + ' · Saved ' + new Date(row.created_at).toLocaleDateString()}</Text>
          <Button variant="text" label="Manage route" onPress={() => setManage(manage === row.saved_id ? null : row.saved_id)}/></View>
        {manage === row.saved_id ? <View style={ui.row}><Button variant="text" label="Rename" onPress={() => { setEditing(row.saved_id); setLabel(row.label); }}/>
          <Button variant="text" label="Delete route" onPress={() => onDelete(row.saved_id)}/></View> : null}
      </View>)}</View>
      : <View>{history.length === 0 ? <Text style={type.body}>Journeys you look up or take will appear here.</Text>
        : history.slice().reverse().map(row => <View key={row.history_id} style={styles.savedRow}>
          <ListRow title="Monumento → One Ayala" detail={(row.kind === 'taken' ? 'Taken' : 'Looked up') + ' · ' + new Date(row.at).toLocaleDateString() + ' · ' + PREFERENCE_LABELS[row.preference]}
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
