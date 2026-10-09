import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Text, TextInput, View } from 'react-native';
import { validateRestoration, type Pack } from '../core';
import { TripPersistenceError, type HistoryEntry, type RestoreResult, type RouteSelection, type SavedEntry, type SqliteTripStore } from './sqliteTripStore';

type ValidTrip = Extract<RestoreResult, { status: 'valid' }>;
export interface TripPersistenceControlsProps {
  store: SqliteTripStore;
  pack: Pack;
  /** Only a currently selected, core-validated itinerary. No query/chat/fix. */
  selection?: RouteSelection;
  onResume(restored: ValidTrip): void;
  /** T45 reroutes endpoints through core; old instructions never resume. */
  onNeedsReplan(result: Extract<RestoreResult, { status: 'needs_replan' }>): void;
  /** T45 clears the conversation window and stops foreground GPS. */
  onTripCleared(): void;
}

const reasons = {
  schema_changed: 'This route needs replanning after a data-format change.',
  invalid_route_json: 'Saved route details are unreadable. Replan this trip.',
  invalid_saved_data: 'Saved trip details are unreadable. Replan or delete this item.',
  record_missing: 'A saved connection is absent from the installed data. Replan this trip.',
  record_ineligible: 'A saved connection is no longer eligible. Replan this trip.',
  service_suspended: 'A saved service is suspended or retired. Replan this trip.',
  continuity_broken: 'These saved connections no longer form a complete journey. Replan this trip.',
  endpoint_mismatch: 'Saved boarding or arrival access has changed. Replan this trip.',
  step_out_of_bounds: 'The saved manual step is invalid. Replan this trip.',
} as const;

function routeName(restored: RestoreResult, pack: Pack): string {
  if (restored.status !== 'valid') return 'Saved journey';
  const trip = restored.trip;
  return `${pack.places.get(trip.originPlaceId!)!.name} → ${pack.places.get(trip.destinationPlaceId!)!.name}`;
}

/** Functional controls for T45 composition. Mount inside the app's ScrollView. */
export function TripPersistenceControls(props: TripPersistenceControlsProps) {
  const { store, pack } = props;
  const [label, setLabel] = useState('');
  const [saved, setSaved] = useState<SavedEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [active, setActive] = useState<RestoreResult>({ status: 'empty' });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);

  async function refresh() {
    const version = ++generation.current;
    const current = await store.restoreActiveTrip(pack);
    const routes = await store.listSavedRoutes(pack);
    const visits = await store.listHistory(pack);
    if (version !== generation.current) return;
    setActive(current); setSaved(routes); setHistory(visits);
  }

  useEffect(() => {
    setSaved([]); setHistory([]); setActive({ status: 'empty' }); setNotice('');
    void refresh().catch(() => setNotice('Could not read local trips. Try again.'));
    return () => { generation.current++; };
  }, [store, pack]);

  async function action(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice('');
    try { await task(); await refresh(); }
    catch (error) {
      setNotice(error instanceof TripPersistenceError && error.reason === 'needs_replan'
        ? 'This selection is no longer usable. Plan a new route.'
        : 'Could not update local trips. Try again.');
    } finally { lock.current = false; setBusy(false); }
  }

  function open(restored: RestoreResult) {
    if (restored.status === 'valid') {
      // Recheck at the action boundary; a list is not permission to reuse
      // instructions after the installed pack changed.
      const trip = restored.trip;
      const checked = validateRestoration({
        packId: trip.packId, schemaVersion: trip.schemaVersion,
        originPlaceId: trip.originPlaceId!, destinationPlaceId: trip.destinationPlaceId!,
        preference: trip.preference, routeJson: JSON.stringify(restored.itinerary.ref), currentStep: trip.currentStep,
      }, pack);
      if (checked.status === 'needs_replan') props.onNeedsReplan({ ...checked,
        replan: { originPlaceId: trip.originPlaceId!, destinationPlaceId: trip.destinationPlaceId!, preference: trip.preference } });
      else props.onResume({ status: 'valid', trip: { ...trip, packId: pack.manifest.pack_id }, itinerary: checked.itinerary });
    }
    else if (restored.status === 'needs_replan') props.onNeedsReplan(restored);
  }

  function resultNotice(restored: RestoreResult) {
    return restored.status === 'needs_replan' ? <Text>{reasons[restored.reason]}</Text> : null;
  }

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header">Local trips</Text>
    <Text>Saved routes use the installed offline data. Steps advance manually.</Text>
    {notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
    <Button title="Refresh local trips" disabled={busy} onPress={() => { void action(async () => {}); }} />

    {props.selection ? <View style={{ gap: 8 }}>
      <Text>Route name (optional, 80 characters)</Text>
      <TextInput accessibilityLabel="Saved route name" value={label} onChangeText={setLabel} maxLength={80} />
      <Button title="Save selected route" disabled={busy} onPress={() => {
        const selection = props.selection!;
        void action(async () => { await store.saveRoute(selection, pack, label.trim() || null); setLabel(''); setNotice('Route saved on this device.'); });
      }} />
      <Button title="Start selected trip" disabled={busy} onPress={() => {
        const selection = props.selection!;
        void action(async () => { open(await store.startTrip(selection, pack)); });
      }} />
    </View> : null}

    {active.status !== 'empty' ? <View style={{ gap: 8 }}>
      <Text accessibilityRole="header">Active trip</Text>
      {active.status === 'valid' ? <Text>{routeName(active, pack)} · Step {active.trip.currentStep + 1} of {active.itinerary.ref.steps.length}</Text> : null}
      {resultNotice(active)}
      <Button title={active.status === 'valid' ? 'Resume trip' : 'Replan trip'} disabled={busy} onPress={() => open(active)} />
      {active.status === 'valid' ? <>
        <Button title="Next manual step" disabled={busy || active.trip.currentStep >= active.itinerary.ref.steps.length - 1} onPress={() => {
          void action(async () => { open(await store.advanceStep(pack)); });
        }} />
        <Button title="End trip and record as taken" disabled={busy} onPress={() => {
          void action(async () => {
            const result = await store.endTrip(pack, true);
            if (result.status === 'needs_replan') open(result); else props.onTripCleared();
          });
        }} />
      </> : null}
      <Button title="Clear active trip" disabled={busy} onPress={() => {
        void action(async () => { await store.clearActiveTrip(); props.onTripCleared(); });
      }} />
    </View> : null}

    <Text accessibilityRole="header">Saved routes</Text>
    {saved.length === 0 ? <Text>No saved routes.</Text> : null}
    {saved.map((entry) => <View key={entry.savedId} style={{ gap: 8 }}>
      <Text>{entry.label || routeName(entry.restoration, pack)}</Text>
      <Text>Saved on device: {entry.createdAt}</Text>
      {resultNotice(entry.restoration)}
      <Button title={entry.restoration.status === 'valid' ? 'Open saved route' : 'Replan saved route'} disabled={busy} onPress={() => open(entry.restoration)} />
      <Button title="Delete saved route" disabled={busy} onPress={() => { void action(async () => { await store.deleteSavedRoute(entry.savedId); }); }} />
    </View>)}

    <Text accessibilityRole="header">Trip history</Text>
    {history.length === 0 ? <Text>No trip history.</Text> : null}
    {history.map((entry) => <View key={entry.historyId} style={{ gap: 8 }}>
      <Text>{routeName(entry.restoration, pack)} · {entry.kind === 'taken' ? 'Taken' : 'Looked up'}</Text>
      <Text>Recorded on device: {entry.at}</Text>
      {resultNotice(entry.restoration)}
      <Button title={entry.restoration.status === 'valid' ? 'Open history route' : 'Replan history route'} disabled={busy} onPress={() => open(entry.restoration)} />
      <Button title="Delete history item" disabled={busy} onPress={() => { void action(async () => { await store.deleteHistoryRow(entry.historyId); }); }} />
    </View>)}
    <Button title="Clear all history" disabled={busy || history.length === 0} onPress={() => {
      Alert.alert('Clear trip history?', 'This removes the trip history stored on this device.', [
        { text: 'Keep history', style: 'cancel' },
        { text: 'Clear history', style: 'destructive', onPress: () => { void action(async () => { await store.clearHistory(); }); } },
      ]);
    }} />
  </View>;
}
