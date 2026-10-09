import { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Assets from '../ui/assets';
import { Action } from '../ui/components';
import { colors, typography } from '../ui/theme';
import { createTripStore } from '../store/tripStore';
import type { SavedRouteRow, TripPreference } from '../store/tripStore';
import { WelcomeScreen } from './WelcomeScreen';
import { AskComposer, AskScreen } from './AskScreen';
import { ActiveTripScreen, RouteMapScreen, RouteOptionsScreen, RouteStepsScreen, TripCompleteScreen } from './RouteScreens';
import { AboutScreen, OfflineDataScreen, PrivacyScreen, ProfileScreen, SavedScreen, SettingsScreen } from './SettingsScreens';
import { EXAMPLE_ROUTE, PREVIEW_ROUTES, rankedPreviewRoutes } from './previewJourney';
import type { Preference, PreviewRoute } from './previewJourney';

type Screen = 'welcome' | 'ask' | 'options' | 'steps' | 'map' | 'active' | 'complete'
  | 'saved' | 'profile' | 'settings' | 'offline' | 'privacy' | 'about';
type Tab = 'ask' | 'map' | 'saved' | 'profile';
interface Sheet { title: string; body: string; action: string; onConfirm: () => void; }

const SCREEN_TITLES: Record<Screen, string> = {
  welcome: 'Pusang Gala', ask: 'Pusang Gala', options: 'Route options', steps: 'Route steps',
  map: 'Route map', active: 'Active trip', complete: 'Trip complete', saved: 'Saved & history',
  profile: 'Profile', settings: 'Settings', offline: 'Offline data', privacy: 'Privacy & data', about: 'About Pusang Gala',
};
const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'ask', label: 'Ask' }, { id: 'map', label: 'Map' },
  { id: 'saved', label: 'Saved' }, { id: 'profile', label: 'Profile' },
];

export function MobileShell(): React.JSX.Element {
  const [stack, setStack] = useState<Screen[]>(['welcome']);
  const [tab, setTab] = useState<Tab>('ask');
  const [store] = useState(createTripStore);
  const [, refresh] = useState(0);
  const [route, setRoute] = useState<PreviewRoute | null>(null);
  const [preference, setPreference] = useState<Preference>('cheapest');
  const [question, setQuestion] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [detailStep, setDetailStep] = useState(0);
  const [activeRoute, setActiveRoute] = useState<PreviewRoute | null>(null);
  const [schematic, setSchematic] = useState(true);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const screen = stack[stack.length - 1]!;
  const active = store.loadActiveTrip();
  const activeStep = active?.current_step ?? 0;
  const selected = route ?? EXAMPLE_ROUTE;

  function navigate(next: Screen): void { setStack(current => [...current, next]); }
  function openTab(next: Tab): void { setTab(next); setStack([next]); }
  function back(): void { setStack(current => current.length > 1 ? current.slice(0, -1) : ['ask']); }
  function updateStore(): void { refresh(value => value + 1); }
  function notice(title: string, body: string): void {
    setSheet({ title, body, action: 'Got it', onConfirm: () => setSheet(null) });
  }

  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [screen, detailStep, activeStep]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) { setSheet(null); return true; }
      if (stack.length > 1 || !['welcome', 'ask'].includes(screen)) { back(); return true; }
      return false;
    });
    return () => listener.remove();
  }, [screen, sheet, stack.length]);

  function history(kind: 'looked_up' | 'taken', itinerary: PreviewRoute, chosenPreference: TripPreference = preference): void {
    store.appendHistory({ pack_id: 'SYNTHETIC-walkthrough', origin_place_id: 'SYNTHETIC-monumento',
      destination_place_id: 'SYNTHETIC-one-ayala', preference: chosenPreference,
      route: itinerary.ids, kind }); updateStore();
  }
  function showExample(): void {
    setRoute(rankedPreviewRoutes(preference)[0]!); setDetailStep(0); setMessage(null);
    setQuestion('Paano pumunta sa One Ayala galing Monumento?'); history('looked_up', rankedPreviewRoutes(preference)[0]!);
  }
  function submit(query: string): void {
    setQuestion(query); setMessage(null);
    const normalized = query.toLowerCase();
    // UI fixture entry only. Actual intent inference and resolver remain T32/T45.
    if (/masinag|antipolo/.test(normalized)) {
      setRoute(null); setMessage('Masinag and Antipolo are outside Metro Manila. Pusang Gala covers NCR only. Try a supported NCR landmark.');
    } else if (normalized.replace(/\s+/g, ' ').replace(/\?$/, '') === 'paano pumunta sa one ayala galing monumento') {
      setRoute(rankedPreviewRoutes(preference)[0]!); setDetailStep(0);
      history('looked_up', rankedPreviewRoutes(preference)[0]!);
    } else {
      setRoute(null); setMessage('Route data and the conversation assistant are not installed in this preview. Explore the example journey or edit your question.');
    }
  }
  function choosePreference(value: Preference): void {
    setPreference(value); if (route) { setRoute(rankedPreviewRoutes(value)[0]!); setDetailStep(0); }
  }
  function options(value: Preference): void { choosePreference(value); navigate('options'); }
  function startTrip(): void {
    if (activeRoute) {
      setSheet({ title: 'Replace your active trip?', body: 'Your current manual progress will end. The new example journey starts at step 1.', action: 'Start new trip',
        onConfirm: () => { setSheet(null); beginTrip(); } });
    } else beginTrip();
  }
  function beginTrip(): void {
    store.upsertActiveTrip({ pack_id: 'SYNTHETIC-walkthrough', schema_version: 1,
      origin_place_id: 'SYNTHETIC-monumento', destination_place_id: 'SYNTHETIC-one-ayala',
      preference, route: selected.ids,
      current_step: 0, started_at: new Date().toISOString() });
    setActiveRoute(selected); updateStore(); navigate('active');
  }
  function nextStep(): void {
    if (!activeRoute || !active) return;
    if (activeStep === activeRoute.steps.length - 1) {
      history('taken', activeRoute, active.preference); setRoute(activeRoute); store.clearActiveTrip(); setActiveRoute(null);
      updateStore(); setStack(['ask', 'complete']);
    } else { store.advanceStep(); updateStore(); }
  }
  function previousStep(): void {
    if (active && activeStep > 0) { store.upsertActiveTrip({ ...active, current_step: activeStep - 1 }); updateStore(); }
  }
  function endTrip(): void {
    setSheet({ title: 'Stop this trip?', body: 'This ends your manual progress. It won’t be marked as taken.', action: 'Stop trip',
      onConfirm: () => { store.clearActiveTrip(); setActiveRoute(null); updateStore(); setSheet(null); openTab('ask'); } });
  }
  function save(itinerary: PreviewRoute = selected): void {
    const existing = store.listSavedRoutes().some(row => row.route.leg_ids.join('|') === itinerary.ids.leg_ids.join('|'));
    if (!existing) store.saveRoute({ pack_id: 'SYNTHETIC-walkthrough', origin_place_id: 'SYNTHETIC-monumento',
      destination_place_id: 'SYNTHETIC-one-ayala', preference,
      route: itinerary.ids, label: itinerary.title });
    updateStore(); notice(existing ? 'Already saved' : 'Route saved', 'Find the example journey in Saved. Only route IDs, a label, preference and date are kept for this session.');
  }
  function openSaved(row: SavedRouteRow): void {
    const found = PREVIEW_ROUTES.find(item => item.ids.leg_ids.join('|') === row.route.leg_ids.join('|'));
    if (row.pack_id !== 'SYNTHETIC-walkthrough' || !found) {
      notice('This route needs re-planning', 'The saved route no longer matches this preview’s records. Ask for a new trip.'); return;
    }
    setRoute(found); setDetailStep(0);
    if (row.preference === 'cheapest' || row.preference === 'fastest' || row.preference === 'fewest-transfers') setPreference(row.preference);
    navigate('steps');
  }
  function location(): void {
    setSheet({ title: 'Your location stays on your phone.',
      body: 'Pusang Gala uses location only while the app is open, to suggest a starting point and show your position. Location is not connected in this preview; type a starting landmark instead.',
      action: 'Use manual input', onConfirm: () => { setSheet(null); openTab('ask'); } });
  }
  function deleteData(): void {
    setSheet({ title: 'Delete all your data?', body: 'This clears saved routes, history, preferences and your active trip on this phone.', action: 'Delete all data',
      onConfirm: () => {
        store.listSavedRoutes().forEach(row => store.deleteSavedRoute(row.saved_id)); store.clearHistory(); store.clearActiveTrip();
        setActiveRoute(null); setRoute(null); setQuestion(''); setMessage(null); setPreference('cheapest'); updateStore(); setSheet(null);
      } });
  }

  function content(): React.JSX.Element {
    switch (screen) {
      case 'welcome': return <WelcomeScreen onContinue={() => openTab('ask')} />;
      case 'ask': return <AskScreen route={route} question={question} message={message} preference={preference}
        onExample={showExample} onOptions={options} onSteps={() => navigate('steps')} onLocation={location} onSave={() => save()} />;
      case 'options': return <RouteOptionsScreen selected={selected} preference={preference} onSelect={item => { setRoute(item); setDetailStep(0); }}
        onPreference={choosePreference} />;
      case 'steps': return <RouteStepsScreen route={selected} stepIndex={detailStep} onStep={setDetailStep}
        onMap={() => { setSchematic(true); navigate('map'); }} onSave={() => save()} />;
      case 'map': return <RouteMapScreen route={route} schematic={schematic} onMode={setSchematic} onLocation={location} />;
      case 'active': return activeRoute ? <ActiveTripScreen route={activeRoute} stepIndex={activeStep}
        onEnd={endTrip} onAsk={() => openTab('ask')} onSteps={() => { setRoute(activeRoute); setDetailStep(activeStep); navigate('steps'); }} />
        : <Text style={typography.body}>No active trip. Choose a route in Ask.</Text>;
      case 'complete': return <TripCompleteScreen onSave={() => save()} onReturn={() => {
        // A reverse search must retrieve directed evidence; never reverse forward legs.
        setRoute(null); setQuestion('Pauwi naman? One Ayala → Monumento');
        setMessage('A return trip needs a separate directed route search. Reverse route data is not installed in this preview.'); openTab('ask');
      }} onDone={() => { setRoute(null); setQuestion(''); setMessage(null); openTab('ask'); }} />;
      case 'settings': return <SettingsScreen preference={preference} onPreference={choosePreference}
        onOpen={navigate} onLocation={location} />;
      case 'offline': return <OfflineDataScreen checkedAt={checkedAt} />;
      case 'privacy': return <PrivacyScreen onDelete={deleteData} />;
      case 'about': return <AboutScreen />;
      case 'profile': return <ProfileScreen savedCount={store.listSavedRoutes().length} takenCount={store.listHistory().filter(row => row.kind === 'taken').length}
        onSaved={() => openTab('saved')} onSettings={() => navigate('settings')} onHelp={() => navigate('about')} />;
      case 'saved': return <SavedScreen saved={store.listSavedRoutes()} history={store.listHistory()} onOpen={openSaved}
        onDelete={id => { store.deleteSavedRoute(id); updateStore(); }} onRename={(id, label) => { store.renameSavedRoute(id, label); updateStore(); }}
        onDeleteHistory={id => { store.deleteHistoryRow(id); updateStore(); }} onAsk={() => openTab('ask')}
        onClearHistory={() => setSheet({ title: 'Clear all history?', body: 'This removes looked-up and taken trips for this session. Saved routes are kept.', action: 'Clear history',
          onConfirm: () => { store.clearHistory(); updateStore(); setSheet(null); } })} />;
    }
  }

  const title = screen === 'steps' ? `Step ${detailStep + 1} of ${selected.steps.length}` : SCREEN_TITLES[screen];
  function footer(): React.JSX.Element | null {
    if (screen === 'ask') return <AskComposer onSubmit={submit} />;
    if (screen === 'options') return <Action label="See directions →" onPress={() => navigate('steps')} />;
    if (screen === 'steps') return <View style={styles.footerRow}>
      <Action secondary label="← Previous" disabled={detailStep === 0} onPress={() => setDetailStep(detailStep - 1)} style={styles.flex} />
      <Action label="Start trip →" onPress={startTrip} style={styles.flex} /></View>;
    if (screen === 'map' && route) return <Action label={schematic ? 'See route steps →' : 'Back to trip →'}
      onPress={() => navigate(!schematic && activeRoute ? 'active' : 'steps')} />;
    if (screen === 'active' && activeRoute) return <View style={styles.footerRow}>
      <Action secondary label="← Back" disabled={activeStep === 0} onPress={previousStep} />
      <Action label={activeStep === activeRoute.steps.length - 1 ? 'I’m here — finish trip →' : 'I’m here — next step →'}
        onPress={nextStep} style={styles.flex} /></View>;
    if (screen === 'settings') return <Action secondary label="Back to commute →" onPress={() => openTab('ask')} />;
    if (screen === 'offline') return <Action label="Re-check files" onPress={() => setCheckedAt(new Date().toLocaleTimeString())} />;
    return null;
  }
  const bottomAction = footer();
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {screen !== 'welcome' ? <View style={styles.header}>
        {screen === 'ask' ? <Assets.HeaderCat /> : <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={back} style={styles.iconButton}><Assets.Back /></Pressable>}
        <Text style={[typography.heading, styles.flex]}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => { if (screen !== 'settings') navigate('settings'); }} style={styles.iconButton}><Assets.Gear /></Pressable>
      </View> : null}
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" style={styles.scroll}
        contentContainerStyle={screen === 'welcome' ? styles.welcomeContent : styles.content}>
        {content()}
      </ScrollView>
      {bottomAction ? <View style={styles.footer}>{bottomAction}</View> : null}
      {screen !== 'welcome' ? <>
        {activeRoute && screen !== 'active' ? <Pressable accessibilityRole="button" onPress={() => navigate('active')} style={styles.activeBanner}>
          <Text style={[typography.caption, styles.green]}>On the way to One Ayala · Step {activeStep + 1} of {activeRoute.steps.length} →</Text>
        </Pressable> : null}
        <View style={styles.tabs}>{TABS.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label}
          accessibilityState={{ selected: tab === item.id }} aria-selected={tab === item.id} onPress={() => openTab(item.id)} style={[styles.tab, tab === item.id && styles.selectedTab]}>
          {item.id === 'ask' ? <Assets.Spark /> : item.id === 'map' ? <Assets.MapIcon /> : item.id === 'saved' ? <Text style={styles.star}>☆</Text> : <Assets.HeaderCat />}
          <Text style={[typography.caption, tab === item.id && styles.orange]}>{item.label}</Text>
        </Pressable>)}</View>
      </> : null}
      {sheet ? <Modal transparent visible animationType="fade" onRequestClose={() => setSheet(null)}>
        <View style={styles.scrim}><View accessibilityViewIsModal style={styles.sheet}>
          <Text accessibilityRole="header" style={typography.title}>{sheet.title}</Text>
          <Text style={typography.body}>{sheet.body}</Text>
          <Action label={sheet.action} onPress={sheet.onConfirm} />
          {sheet.action !== 'Got it' ? <Action secondary label="Cancel" onPress={() => setSheet(null)} /> : null}
        </View></View>
      </Modal> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface }, page: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: colors.surface },
  flex: { flex: 1 }, header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 6 },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 }, content: { padding: 20, paddingTop: 16, flexGrow: 1 }, welcomeContent: { flexGrow: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, backgroundColor: colors.surface },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 16 },
  selectedTab: { backgroundColor: colors.orangeSoft }, orange: { color: colors.orange }, green: { color: colors.green },
  star: { fontSize: 25, height: 31, color: colors.ink },
  activeBanner: { backgroundColor: colors.greenSoft, paddingVertical: 12, paddingHorizontal: 20, minHeight: 44 },
  scrim: { flex: 1, backgroundColor: 'rgba(46,28,20,0.35)', justifyContent: 'flex-end', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 390, borderRadius: 24, backgroundColor: colors.surface, padding: 24, gap: 16 },
});
