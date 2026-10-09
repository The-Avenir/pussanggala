import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as Assets from '../ui/assets';
import { Action, Card, FeatureRow, SettingsRow, StatusChip } from '../ui/components';
import { colors, typography } from '../ui/theme';
import { ScaledArtwork } from '../ui/ScaledArtwork';
import { summarizeReadiness } from '../assets/readiness';
import type { SavedRouteRow, TripHistoryRow } from '../store/tripStore';
import { PreferenceChips } from './Preferences';
import type { Preference } from './previewJourney';

export type SettingsPage = 'settings' | 'offline' | 'privacy' | 'about';
export function SettingsScreen({ preference, onPreference, onOpen, onLocation }: {
  preference: Preference; onPreference: (value: Preference) => void;
  onOpen: (page: SettingsPage) => void; onLocation: () => void;
}): React.JSX.Element {
  return <View style={styles.screen}>
    <View style={styles.brand}><Assets.BrandCat /><View style={styles.brandText}>
      <Text style={typography.title}>Pusang Gala</Text><Text style={typography.caption}>Your offline commute buddy</Text>
    </View></View>
    <SettingsRow Icon={Assets.MapIcon} title="Offline data" subtitle="NCR · bundled files and readiness" onPress={() => onOpen('offline')} />
    <SettingsRow Icon={Assets.Storage} title="Storage & privacy" subtitle="Saved routes stay on your phone" onPress={() => onOpen('privacy')} />
    <SettingsRow Icon={Assets.Target} title="Location" subtitle="Foreground only · while the app is open" onPress={onLocation} />
    <SettingsRow Icon={Assets.Spark} title="AI assistant" subtitle="Not installed in this preview" onPress={() => onOpen('offline')} />
    <SettingsRow Icon={Assets.Info} title="About Pusang Gala" subtitle="Version 0.1 · offline UI preview" onPress={() => onOpen('about')} />
    <Text style={typography.label}>Default trip preference</Text>
    <PreferenceChips preference={preference} onSelect={onPreference} />
    <Text style={typography.caption}>Your location stays on your phone.</Text>
  </View>;
}

export function OfflineDataScreen({ checkedAt }: { checkedAt: string | null }): React.JSX.Element {
  const readiness = summarizeReadiness([]);
  return <View style={styles.screen}>
    <Text style={typography.title}>Ready before you roam.</Text>
    <Text style={[typography.body, styles.muted]}>Offline files ship with the app. No corridor downloads needed.</Text>
    <ScaledArtwork width={350} height={180}><Assets.BusIllustration /></ScaledArtwork>
    <Card><Text style={typography.heading}>Metro Manila · NCR</Text>
      <Text style={typography.caption}>Maps, stops, routes, and local landmarks</Text>
      <View style={styles.row}><Assets.PinkStorage /><Text style={typography.caption}>Installed size not measured</Text></View></Card>
    <StatusChip Icon={Assets.Info} label="Required files are not installed in this preview" />
    {[
      { name: 'Route pack', detail: 'Version, build date and source dates unavailable' },
      { name: 'AI model', detail: 'Device support not checked' },
      { name: 'Offline map', detail: 'NCR basemap not installed · schematic available' },
    ].map(item => <Card key={item.name}><View style={styles.between}>
      <Text style={typography.label}>{item.name}</Text><Text style={[typography.caption, styles.orange]}>Missing</Text></View>
      <Text style={typography.caption}>{item.detail}</Text></Card>)}
    <FeatureRow Icon={Assets.MapIcon} title="Works without mobile data" subtitle="The stop diagram remains available if map resources fail." />
    {checkedAt ? <Text accessibilityRole="alert" style={typography.caption}>Checked {checkedAt} · {readiness.state}. Native file validation is not connected in this preview.</Text> : null}
  </View>;
}

export function PrivacyScreen({ onDelete }: { onDelete: () => void }): React.JSX.Element {
  return <View style={styles.screen}><Text style={typography.title}>Your lakbay stays local.</Text>
    <Card><Text style={typography.heading}>What stays on this phone</Text>
      <Text style={typography.body}>Saved route IDs, trip history IDs, your preference, and manual trip progress.</Text>
      <Text style={typography.caption}>This preview keeps them in memory for this session. Persistent storage is not connected yet.</Text></Card>
    <Card tone="blueSoft"><Text style={typography.heading}>What we don’t store</Text>
      <Text style={typography.body}>Chat text and GPS coordinates. No cloud sync, uploads, or analytics.</Text></Card>
    <Action secondary label="Delete all my data" onPress={onDelete} />
  </View>;
}

export function AboutScreen(): React.JSX.Element {
  return <View style={styles.screen}><View style={styles.brand}><Assets.BrandCat /><View style={styles.brandText}>
    <Text style={typography.title}>Pusang Gala</Text><Text style={typography.caption}>Version 0.1 · offline UI preview</Text></View></View>
    <Card><Text style={typography.heading}>Community reports, explained simply.</Text>
      <Text style={typography.body}>Route information comes from community reports and may be outdated. Missing fares, times, and hours stay unknown.</Text></Card>
    <Card><Text style={typography.label}>Data and map attribution</Text>
      <Text style={typography.caption}>Route source: paraphrased community reports from r/HowToGetTherePH. This preview uses the app walkthrough example; an eligible route pack is not installed.</Text>
      <Text style={typography.caption}>Map artwork and mascot: supplied Pusang Gala Figma design. Artwork is illustrative, not an OpenStreetMap basemap.</Text>
      <Text style={typography.caption}>Nunito and DM Sans: Google Fonts, SIL Open Font License. Actual map and model licences ship with their installed files.</Text></Card>
    <Text style={typography.caption}>Your trips and location never leave this phone.</Text>
  </View>;
}

export function ProfileScreen({ savedCount, takenCount, onSaved, onSettings, onHelp }: {
  savedCount: number; takenCount: number; onSaved: () => void; onSettings: () => void; onHelp: () => void;
}): React.JSX.Element {
  return <View style={styles.screen}><View style={styles.profile}><Assets.BrandCat />
    <Text style={typography.title}>Commuter</Text><Text style={typography.caption}>Your offline commute buddy is ready to explore.</Text></View>
    <Card><Text style={typography.heading}>Your trips, on this phone</Text><View style={styles.row}>
      <View style={styles.flex}><Text style={typography.title}>{savedCount}</Text><Text style={typography.caption}>saved routes</Text></View>
      <View style={styles.flex}><Text style={typography.title}>{takenCount}</Text><Text style={typography.caption}>trips taken</Text></View>
    </View></Card>
    <SettingsRow Icon={Assets.MapIcon} title="Saved routes & history" subtitle="Find your previous journeys" onPress={onSaved} />
    <SettingsRow Icon={Assets.Gear} title="Settings" subtitle="Preferences, offline data, and privacy" onPress={onSettings} />
    <SettingsRow Icon={Assets.Info} title="Help & tips" subtitle="How to read community-reported cards" onPress={onHelp} />
    <Text style={typography.caption}>Your trips and location never leave this phone.</Text>
  </View>;
}

export function SavedScreen({ saved, history, onOpen, onDelete, onRename, onClearHistory, onDeleteHistory, onAsk }: {
  saved: readonly SavedRouteRow[]; history: readonly TripHistoryRow[];
  onOpen: (row: SavedRouteRow) => void; onDelete: (id: string) => void;
  onRename: (id: string, label: string) => void; onClearHistory: () => void;
  onDeleteHistory: (id: string) => void; onAsk: () => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  return <View style={styles.screen}><Text style={typography.title}>Your familiar daanan.</Text>
    <Text style={typography.caption}>Example journeys · saved for this session</Text>
    <Text style={typography.heading}>Saved routes</Text>
    {saved.length === 0 ? <Card><Text style={typography.body}>Save a route with ☆ to find it here.</Text>
      <Action secondary label="Ask about a trip →" onPress={onAsk} /></Card> : saved.map(row => <Card key={row.saved_id}>
      {editing === row.saved_id ? <><TextInput accessibilityLabel="Saved route name" value={label} onChangeText={setLabel}
        style={[typography.body, styles.input]} maxLength={80} />
        <Action secondary label="Save name" disabled={!label.trim()} onPress={() => { onRename(row.saved_id, label.trim()); setEditing(null); }} /></>
        : <><Text style={typography.heading}>{row.label}</Text><Text style={typography.caption}>Monumento → One Ayala · {row.preference.replaceAll('-', ' ')}</Text>
          <Action secondary label="View steps →" onPress={() => onOpen(row)} /></>}
      <Text style={typography.caption}>Saved {new Date(row.created_at).toLocaleDateString()}</Text>
      <View style={styles.row}><Action secondary label="Rename" onPress={() => { setEditing(row.saved_id); setLabel(row.label); }} style={styles.flex} />
        <Action secondary label="Delete" onPress={() => onDelete(row.saved_id)} style={styles.flex} /></View>
    </Card>)}
    <Text style={typography.heading}>History</Text>
    {history.length === 0 ? <Text style={typography.caption}>Your looked-up and taken journeys will appear here.</Text> : history.slice().reverse().map(row =>
      <Card key={row.history_id}><Text style={typography.label}>Monumento → One Ayala</Text>
        <Text style={typography.caption}>{row.kind === 'taken' ? 'Taken' : 'Looked up'} · {new Date(row.at).toLocaleDateString()}</Text>
        <Action secondary label="Delete entry" onPress={() => onDeleteHistory(row.history_id)} /></Card>)}
    {history.length > 0 ? <Action secondary label="Clear all history" onPress={onClearHistory} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 96 }, brandText: { flex: 1, gap: 4 },
  muted: { color: colors.muted }, orange: { color: colors.orange },
  profile: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 },
});
