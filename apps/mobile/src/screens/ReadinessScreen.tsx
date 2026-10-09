import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Gaile, Icon, Notice, palette, type, ui } from '../ui/travel';
import type { IconName } from '../ui/travel';
import { isFullyReady, summarizeReadiness } from '../assets/readiness';
import type { AssetState, LocatedAsset } from '../assets/readiness';

// Walkthrough §0 launch check. This design preview bundles no route pack,
// model or map, so each check is simulated: verifying, then reported missing
// after a short delay. There is no download — assets ship inside the app.
const CHECKS: readonly { id: string; name: string; kind: LocatedAsset['kind']; icon: IconName; fallback: string }[] = [
  { id: 'pack', name: 'Route pack', kind: 'pack', icon: 'bus',
    fallback: 'Route search is unavailable without it. In the release this means reinstalling the app.' },
  { id: 'model', name: 'AI model', kind: 'model', icon: 'chat',
    fallback: 'Route cards still work with a basic template summary.' },
  { id: 'map', name: 'Offline map', kind: 'map', icon: 'map',
    fallback: 'Route cards and the stop diagram still work.' },
];

function statusLabel(state: AssetState): string {
  return state === 'ready' ? 'Ready' : state === 'verifying' ? 'Verifying…' : state === 'missing' ? 'Missing' : 'Failed';
}

export function ReadinessScreen({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [states, setStates] = useState<Record<string, AssetState>>(() =>
    Object.fromEntries(CHECKS.map(item => [item.id, 'verifying'])));
  useEffect(() => {
    const timers = CHECKS.map((item, index) => setTimeout(
      () => setStates(current => ({ ...current, [item.id]: 'missing' })), 350 + index * 300));
    return () => { for (const timer of timers) clearTimeout(timer); };
  }, []);
  const assets: LocatedAsset[] = CHECKS.map(item => ({
    assetId: 'preview-' + item.id, kind: item.kind, bundleUri: 'bundled/' + item.id, filePath: '',
    version: 'preview', sha256: '', bytes: null, state: states[item.id] ?? 'verifying', license: '',
  }));
  const summary = summarizeReadiness(assets);
  const ready = isFullyReady(assets);
  // When every bundled asset verifies, the splash closes on its own (target <2s).
  useEffect(() => { if (ready) onDone(); }, [ready, onDone]);
  const settled = summary.verifying === 0;
  return <View style={[ui.screen, styles.screen]}>
    <View style={styles.hero}><Gaile pose="idle" height={140}/>
      <Text accessibilityRole="header" style={type.title}>Pusang Gala</Text>
      <Text style={type.secondary}>Checking the files bundled on this phone…</Text></View>
    <View style={styles.list}>{CHECKS.map(item => {
      const state = states[item.id] ?? 'verifying';
      return <View key={item.id} style={styles.row}>
        <Icon name={state === 'ready' ? 'check' : state === 'verifying' ? item.icon : 'close'} size={20}
          color={state === 'ready' ? palette.success : state === 'verifying' ? palette.secondary : palette.warning}/>
        <View style={ui.flex}>
          <View style={styles.rowTop}><Text style={[type.label, ui.flex]}>{item.name}</Text>
            <Text style={[type.caption, state === 'ready' ? styles.ok : state === 'verifying' ? styles.pending : styles.warn]}>
              {statusLabel(state)}</Text></View>
          {state === 'missing' || state === 'failed' ? <Text style={type.secondary}>{item.fallback}</Text> : null}
        </View>
      </View>;
    })}</View>
    {settled && !ready ? <>
      <Notice>UI design preview — the bundled route pack, AI model and map aren’t included yet. Example journeys and the stop
        diagram still work. There’s nothing to download: in the release these files ship inside the app.</Notice>
      <Button label="Continue" icon="arrow" onPress={onDone}/>
    </> : null}
    <Text style={type.caption}>This check runs entirely on this phone.</Text>
  </View>;
}
const styles = StyleSheet.create({
  screen: { paddingTop: 8 },
  hero: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  list: { gap: 4 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.line },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  ok: { color: palette.success, fontWeight: '600' },
  pending: { color: palette.secondary },
  warn: { color: palette.warning, fontWeight: '600' },
});
