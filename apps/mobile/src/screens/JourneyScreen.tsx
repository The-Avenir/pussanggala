/**
 * T45 ugly wiring — SYNTHETIC offline journey screen (cards-first).
 *
 * SYNTHETIC fixtures only. Every fake string is marked SYNTHETIC, never real
 * pack data, never dataset import, never network. Ugly-first, no polish.
 *
 * SYNTHETIC flow: text input -> SYNTHETIC cards list (cards-first) ->
 * SYNTHETIC dashed schematic (not-to-scale) -> SYNTHETIC map box placeholder
 * -> SYNTHETIC GPS text (manual) -> SYNTHETIC save button (ID-only store).
 *
 * SYNTHETIC failure states (each distinct message + SYNTHETIC retry):
 * outside-NCR, ambiguous, no-route, missing-asset. All reachable via
 * SYNTHETIC query keywords or SYNTHETIC demo buttons below.
 */
import { useMemo, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { Schematic } from '../components/Schematic';
import type { SchematicLeg } from '../components/Schematic';
import { runValidationPipeline, syntheticPinnedAssets, syntheticSnapshotsPresent } from '../assets/loader';
import { summarizeReadiness } from '../assets/readiness';
import { describeFix } from '../location/gps';
import { createTripStore } from '../store/tripStore';
import type { RouteIds } from '../store/tripStore';

type FailureKind = 'outside-NCR' | 'ambiguous' | 'no-route' | 'missing-asset';

interface SyntheticCard {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly legs: readonly SchematicLeg[];
  readonly route: RouteIds;
}

const SYNTHETIC_CARDS: readonly SyntheticCard[] = [
  {
    id: 'SYNTHETIC-card-1',
    title: 'SYNTHETIC route card 1 — SYNTHETIC walk + ride (SYNTHETIC)',
    body: 'SYNTHETIC legs SYNTHETIC-leg-1A via SYNTHETIC-stop-A to SYNTHETIC-stop-B — not real pack data (SYNTHETIC)',
    legs: [
      { id: 'SYNTHETIC-leg-1A', label: 'SYNTHETIC walk SYNTHETIC-stop-A (SYNTHETIC)' },
      { id: 'SYNTHETIC-leg-1B', label: 'SYNTHETIC ride SYNTHETIC-stop-A to SYNTHETIC-stop-B (SYNTHETIC)' },
    ],
    route: {
      leg_ids: ['SYNTHETIC-leg-1A', 'SYNTHETIC-leg-1B'],
      stop_ids: ['SYNTHETIC-stop-A', 'SYNTHETIC-stop-B'],
      place_ids: ['SYNTHETIC-place-A', 'SYNTHETIC-place-B'],
      note_ids: ['SYNTHETIC-note-1'],
    },
  },
  {
    id: 'SYNTHETIC-card-2',
    title: 'SYNTHETIC route card 2 — SYNTHETIC fewest transfers (SYNTHETIC)',
    body: 'SYNTHETIC legs SYNTHETIC-leg-2A direct via SYNTHETIC-stop-C — not real pack data (SYNTHETIC)',
    legs: [{ id: 'SYNTHETIC-leg-2A', label: 'SYNTHETIC direct SYNTHETIC-stop-C (SYNTHETIC)' }],
    route: {
      leg_ids: ['SYNTHETIC-leg-2A'],
      stop_ids: ['SYNTHETIC-stop-C'],
      place_ids: ['SYNTHETIC-place-A', 'SYNTHETIC-place-C'],
      note_ids: ['SYNTHETIC-note-2'],
    },
  },
  {
    id: 'SYNTHETIC-card-3',
    title: 'SYNTHETIC route card 3 — SYNTHETIC balanced (SYNTHETIC)',
    body: 'SYNTHETIC legs SYNTHETIC-leg-3A + SYNTHETIC-leg-3B via SYNTHETIC-stop-D — not real pack data (SYNTHETIC)',
    legs: [
      { id: 'SYNTHETIC-leg-3A', label: 'SYNTHETIC first SYNTHETIC-stop-D (SYNTHETIC)' },
      { id: 'SYNTHETIC-leg-3B', label: 'SYNTHETIC second SYNTHETIC-stop-E (SYNTHETIC)' },
    ],
    route: {
      leg_ids: ['SYNTHETIC-leg-3A', 'SYNTHETIC-leg-3B'],
      stop_ids: ['SYNTHETIC-stop-D', 'SYNTHETIC-stop-E'],
      place_ids: ['SYNTHETIC-place-D', 'SYNTHETIC-place-E'],
      note_ids: ['SYNTHETIC-note-3'],
    },
  },
];

const SYNTHETIC_FAILURE_TEXT: Record<FailureKind, string> = {
  'outside-NCR':
    'SYNTHETIC failure [outside-NCR]: SYNTHETIC place outside NCR pack — offline NCR only, no SYNTHETIC route (SYNTHETIC detail)',
  ambiguous:
    'SYNTHETIC failure [ambiguous]: SYNTHETIC query matched multiple SYNTHETIC places — confirm one SYNTHETIC pick (SYNTHETIC detail)',
  'no-route':
    'SYNTHETIC failure [no-route]: no SYNTHETIC offline route for this SYNTHETIC query — try another SYNTHETIC query (SYNTHETIC detail)',
  'missing-asset':
    'SYNTHETIC failure [missing-asset]: SYNTHETIC pack asset missing — restore offline pack, no network fallback (SYNTHETIC detail)',
};

function classifySyntheticQuery(origin: string, destination: string): FailureKind | null {
  const q = `${origin} ${destination}`.toLowerCase();
  if (q.includes('outside')) {
    return 'outside-NCR';
  }
  if (q.includes('ambiguous')) {
    return 'ambiguous';
  }
  if (q.includes('noroute') || q.includes('nowhere')) {
    return 'no-route';
  }
  return null;
}

export function JourneyScreen(): React.JSX.Element {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [failure, setFailure] = useState<FailureKind | null>(null);
  const [simulateMissing, setSimulateMissing] = useState(false);
  const [savedText, setSavedText] = useState<string | null>(null);
  const [gpsNote, setGpsNote] = useState('');

  const store = useMemo(() => createTripStore(), []);

  const assetLine = useMemo(() => {
    const pinned = syntheticPinnedAssets('synthetic-t45.0');
    const snaps = syntheticSnapshotsPresent();
    const files = simulateMissing ? snaps.slice(1) : snaps;
    const located = runValidationPipeline({ baseDir: 'SYNTHETIC-base', files, pinned });
    const summary = summarizeReadiness(located);
    return `SYNTHETIC assets (offline stub): ${summary.state} ready=${summary.ready} missing=${summary.missing} failed=${summary.failed} (SYNTHETIC)`;
  }, [simulateMissing]);

  const assetNotReady = useMemo(() => {
    const pinned = syntheticPinnedAssets('synthetic-t45.0');
    const snaps = syntheticSnapshotsPresent();
    const files = simulateMissing ? snaps.slice(1) : snaps;
    const located = runValidationPipeline({ baseDir: 'SYNTHETIC-base', files, pinned });
    return !summarizeReadiness(located).state.includes('ready') || simulateMissing;
  }, [simulateMissing]);

  const gpsLine = useMemo(() => describeFix(null, Date.now()), []);

  function handleSearch(): void {
    setSavedText(null);
    if (simulateMissing || assetNotReady) {
      setFailure('missing-asset');
      return;
    }
    setFailure(classifySyntheticQuery(origin, destination));
  }

  function handleRetry(): void {
    setFailure(null);
  }

  function handleDemo(kind: FailureKind): void {
    setSavedText(null);
    if (kind === 'missing-asset') {
      setSimulateMissing(true);
    }
    setFailure(kind);
  }

  function handleClear(): void {
    setFailure(null);
    setSimulateMissing(false);
    setSavedText(null);
  }

  function handleSave(): void {
    const first = SYNTHETIC_CARDS[0];
    if (first === undefined) {
      setSavedText('SYNTHETIC saved: no SYNTHETIC card to save (SYNTHETIC)');
      return;
    }
    const row = store.saveRoute({
      pack_id: 'SYNTHETIC-pack-t45',
      origin_place_id: 'SYNTHETIC-place-origin-A',
      destination_place_id: 'SYNTHETIC-place-dest-B',
      preference: 'balanced',
      route: first.route,
      label: `SYNTHETIC saved ${first.id} (SYNTHETIC)`,
    });
    setSavedText(`SYNTHETIC saved (ID-only, no query/coords): ${row.saved_id} for ${first.id} (SYNTHETIC)`);
  }

  const schematicLegs: readonly SchematicLeg[] = failure !== null ? [] : (SYNTHETIC_CARDS[0]?.legs ?? []);

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>SYNTHETIC Journey (T45 ugly wiring, offline) — SYNTHETIC only</Text>
      <Text style={styles.sub}>SYNTHETIC flow: input -&gt; cards -&gt; schematic -&gt; map -&gt; GPS -&gt; save (SYNTHETIC)</Text>

      <Text style={styles.label}>SYNTHETIC origin input (SYNTHETIC demo)</Text>
      <TextInput
        style={styles.input}
        value={origin}
        onChangeText={setOrigin}
        placeholder="SYNTHETIC origin e.g. SYNTHETIC-place-A (SYNTHETIC)"
      />
      <Text style={styles.label}>SYNTHETIC destination input (SYNTHETIC demo)</Text>
      <TextInput
        style={styles.input}
        value={destination}
        onChangeText={setDestination}
        placeholder="SYNTHETIC destination e.g. SYNTHETIC-place-B (SYNTHETIC)"
      />
      <Button title="SYNTHETIC Search (offline, SYNTHETIC)" onPress={handleSearch} />
      <Text style={styles.echo}>
        SYNTHETIC query echo (not stored): {origin} / {destination} (SYNTHETIC)
      </Text>

      <Text style={styles.label}>SYNTHETIC failure demos (all reachable, SYNTHETIC):</Text>
      <View style={styles.demoRow}>
        <Button title="SYNTHETIC demo outside-NCR" onPress={() => handleDemo('outside-NCR')} />
        <Button title="SYNTHETIC demo ambiguous" onPress={() => handleDemo('ambiguous')} />
        <Button title="SYNTHETIC demo no-route" onPress={() => handleDemo('no-route')} />
        <Button title="SYNTHETIC demo missing-asset" onPress={() => handleDemo('missing-asset')} />
        <Button title="SYNTHETIC clear failure" onPress={handleClear} />
      </View>
      <Text style={styles.asset}>SYNTHETIC toggle missing-asset simulation: {simulateMissing ? 'SYNTHETIC ON' : 'SYNTHETIC OFF'}</Text>
      <Text style={styles.asset}>{assetLine}</Text>

      {failure !== null ? (
        <View style={styles.failureBox}>
          <Text style={styles.failureText}>{SYNTHETIC_FAILURE_TEXT[failure]}</Text>
          <Button title={`SYNTHETIC Retry ${failure} (SYNTHETIC)`} onPress={handleRetry} />
        </View>
      ) : (
        <View>
          <Text style={styles.section}>SYNTHETIC cards-first list (SYNTHETIC only, not pack data)</Text>
          {SYNTHETIC_CARDS.map((card) => (
            <View key={card.id} style={styles.card}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardBody}>{card.body}</Text>
            </View>
          ))}
          <Text style={styles.section}>SYNTHETIC schematic section (not-to-scale, SYNTHETIC)</Text>
          <Schematic legs={schematicLegs} />
        </View>
      )}

      <Text style={styles.section}>SYNTHETIC map section (SYNTHETIC placeholder)</Text>
      <View style={styles.mapBox}>
        <Text style={styles.mapText}>SYNTHETIC map box placeholder — offline, no tiles (SYNTHETIC)</Text>
        <Text style={styles.mapSub}>SYNTHETIC basemap lands later, SYNTHETIC only</Text>
      </View>

      <Text style={styles.section}>SYNTHETIC GPS section (manual only, SYNTHETIC)</Text>
      <Text style={styles.gps}>
        SYNTHETIC GPS (manual, no live fix): {gpsLine} (SYNTHETIC)
      </Text>
      <Text style={styles.label}>SYNTHETIC manual GPS note (SYNTHETIC, never stored as fix)</Text>
      <TextInput
        style={styles.input}
        value={gpsNote}
        onChangeText={setGpsNote}
        placeholder="SYNTHETIC manual note e.g. SYNTHETIC-near-stop-A (SYNTHETIC)"
      />

      <Text style={styles.section}>SYNTHETIC save section (ID-only, SYNTHETIC)</Text>
      <Button title="SYNTHETIC Save (ID-only store, SYNTHETIC)" onPress={handleSave} />
      <Text style={styles.saveHint}>SYNTHETIC save hint: Save stores SYNTHETIC IDs only (SYNTHETIC)</Text>
      {savedText !== null ? <Text style={styles.saved}>{savedText}</Text> : null}

      <Text style={styles.footer}>SYNTHETIC ugly wiring: no network, no dataset, SYNTHETIC only</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sub: {
    fontSize: 12,
    color: '#666666',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#999999',
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
  },
  echo: {
    fontSize: 12,
    color: '#666666',
  },
  demoRow: {
    gap: 6,
  },
  asset: {
    fontSize: 12,
    color: '#666666',
  },
  failureBox: {
    borderWidth: 2,
    borderColor: '#990000',
    borderRadius: 4,
    padding: 12,
    gap: 8,
  },
  failureText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  section: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#999999',
    borderRadius: 4,
    padding: 10,
    marginTop: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardBody: {
    fontSize: 13,
    marginTop: 2,
  },
  mapBox: {
    height: 140,
    backgroundColor: '#dddddd',
    borderWidth: 2,
    borderColor: '#666666',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  mapText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  mapSub: {
    fontSize: 12,
    marginTop: 4,
  },
  gps: {
    fontSize: 13,
  },
  saveHint: {
    fontSize: 12,
    color: '#666666',
  },
  saved: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  footer: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
});
