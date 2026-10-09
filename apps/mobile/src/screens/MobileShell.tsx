import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Gaile, Icon, IconButton, Notice, palette, type, ui } from '../ui/travel';
import type { IconName } from '../ui/travel';
import { createTripStore } from '../store/tripStore';
import type { SavedRouteRow, TripHistoryRow, TripPreference } from '../store/tripStore';
import { WelcomeScreen } from './WelcomeScreen';
import { PlanScreen } from './PlanScreen';
import { AskComposer, AskScreen } from './AskScreen';
import type { ConversationTurn } from './AskScreen';
import { ActiveTripScreen, RouteMapScreen, RouteOptionsScreen, RouteStepsScreen, TripCompleteScreen } from './RouteScreens';
import { AboutScreen, OfflineDataScreen, PrivacyScreen, SavedScreen, SettingsScreen } from './SettingsScreens';
import { EXAMPLE_ROUTE, PREVIEW_ROUTES } from './previewJourney';
import type { Preference, PreviewRoute } from './previewJourney';

type Screen = 'plan' | 'welcome' | 'ask' | 'options' | 'steps' | 'map' | 'active' | 'complete'
  | 'trips' | 'settings' | 'offline' | 'privacy' | 'about';
type Tab = 'plan' | 'map' | 'trips';
type Endpoint = 'origin' | 'destination';
interface Sheet { title: string; body: string; action: string; destructive?: boolean; onConfirm: () => void; }
const TITLES: Record<Screen, string> = {
  plan: 'Pusang Gala', welcome: 'Welcome', ask: 'Ask Pusang Gala', options: 'Route options', steps: 'Directions',
  map: 'Map', active: 'To One Ayala', complete: 'Trip complete', trips: 'Trips', settings: 'Settings',
  offline: 'Offline resources', privacy: 'Storage & privacy', about: 'About',
};
const TABS: readonly { id: Tab; label: string; icon: IconName }[] = [
  { id: 'plan', label: 'Plan', icon: 'pin' }, { id: 'map', label: 'Map', icon: 'map' }, { id: 'trips', label: 'Trips', icon: 'trips' },
];
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const exampleQuestion = 'Paano pumunta sa One Ayala galing Monumento?';

export function MobileShell(): React.JSX.Element {
  // Until native settings persistence is wired, onboarding appears once per app session.
  const [stacks, setStacks] = useState<Record<Tab, Screen[]>>({ plan: ['welcome'], map: ['map'], trips: ['trips'] });
  const [tab, setTab] = useState<Tab>('plan');
  const [store] = useState(createTripStore);
  const [, refresh] = useState(0);
  const [route, setRoute] = useState<PreviewRoute | null>(null);
  const [preference, setPreference] = useState<Preference>('cheapest');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [landmarksOpen, setLandmarksOpen] = useState(false);
  const [exampleMode, setExampleMode] = useState(false);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [tripConversation, setTripConversation] = useState(false);
  const [error, setError] = useState<{ message: string; recovery: Endpoint | 'resources' } | null>(null);
  const [detailStep, setDetailStep] = useState(0);
  const [activeRoute, setActiveRoute] = useState<PreviewRoute | null>(null);
  const [completedRoute, setCompletedRoute] = useState<PreviewRoute | null>(null);
  const [schematic, setSchematic] = useState(true);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [editing, setEditing] = useState<Endpoint | null>(null);
  const [endpointText, setEndpointText] = useState('');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [tripSegment, setTripSegment] = useState<'saved' | 'history'>('saved');
  const scrollRef = useRef<ScrollView>(null);
  const returnFocus = useRef<View>(null);
  const sheetHeading = useRef<Text>(null);
  const wasModalOpen = useRef(false);
  const screen = stacks[tab].at(-1)!;
  const active = store.loadActiveTrip();
  const activeStep = active?.current_step ?? 0;
  const chatRoute = tripConversation && activeRoute ? activeRoute : route;
  const mapRoute = route ?? activeRoute;
  const selected = route ?? EXAMPLE_ROUTE;
  const modalOpen = sheet !== null || editing !== null;

  function navigate(next: Screen): void {
    setError(null);
    setStacks(current => ({ ...current, [tab]: [...current[tab], next] }));
  }
  function openTab(next: Tab): void { setTab(next); setError(null); }
  function back(): void {
    setError(null);
    setStacks(current => ({ ...current, [tab]: current[tab].length > 1 ? current[tab].slice(0, -1) : current[tab] }));
  }
  function updateStore(): void { refresh(value => value + 1); }
  function notice(title: string, body: string): void {
    setSheet({ title, body, action: 'Got it', onConfirm: () => setSheet(null) });
  }
  function openAsk(forTrip = false): void { setTripConversation(forTrip); navigate('ask'); }
  function openMap(): void { setTab('map'); setSchematic(true); setStacks(current => ({ ...current, map: ['map'] })); }
  function openDirections(item: PreviewRoute, step = 0): void {
    setRoute(item); setExampleMode(true); setOrigin('LRT-1 Monumento'); setDestination('One Ayala'); setDetailStep(step); navigate('steps');
  }
  function editEndpoint(slot: Endpoint): void {
    setEndpointText(slot === 'origin' ? origin : destination); setEditing(slot);
  }
  function commitEndpoint(): void {
    if (!editing || !endpointText.trim()) return;
    if (editing === 'origin') setOrigin(endpointText.trim()); else setDestination(endpointText.trim());
    setRoute(null); setError(null); setEditing(null); setExampleMode(false);
  }
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [screen, detailStep, activeStep]);
  useEffect(() => { if (screen === 'ask' && turns.length) scrollRef.current?.scrollToEnd({ animated: false }); }, [screen, turns.length]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (modalOpen) { setSheet(null); setEditing(null); return true; }
      if (stacks[tab].length > 1) { back(); return true; }
      if (tab !== 'plan') { openTab('plan'); return true; }
      return false;
    });
    return () => listener.remove();
  }, [modalOpen, stacks, tab]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const focusable = sheetHeading.current as unknown as HTMLElement | null;
    if (modalOpen) focusable?.focus?.();
    else if (wasModalOpen.current) (returnFocus.current as unknown as HTMLElement | null)?.focus?.();
    wasModalOpen.current = modalOpen;
  }, [modalOpen]);
  // Native screen readers announce changes; focus behavior needs device validation.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(screen === 'active' && activeRoute
      ? 'Step ' + (activeStep + 1) + ' of ' + activeRoute.steps.length + '. ' + activeRoute.steps[activeStep]?.title : TITLES[screen]);
  }, [screen, activeRoute, activeStep]);

  function history(kind: 'looked_up' | 'taken', itinerary: PreviewRoute, chosenPreference: TripPreference = preference): void {
    store.appendHistory({ pack_id: 'SYNTHETIC-walkthrough', origin_place_id: 'SYNTHETIC-monumento',
      destination_place_id: 'SYNTHETIC-one-ayala', preference: chosenPreference, route: itinerary.ids, kind });
    updateStore();
  }
  function chooseExample(): void {
    setExampleMode(true); setOrigin('LRT-1 Monumento'); setDestination('One Ayala'); setRoute(EXAMPLE_ROUTE); setDetailStep(0);
    history('looked_up', EXAMPLE_ROUTE); navigate('options');
  }
  function appendTurn(query: string, answer: string, itinerary?: PreviewRoute): void {
    setTurns(current => [...current.slice(-11), { id: Date.now() + current.length, query, answer, ...(itinerary ? { route: itinerary } : {}) }]);
  }
  function askExample(): void {
    setExampleMode(true); setOrigin('LRT-1 Monumento'); setDestination('One Ayala'); setRoute(EXAMPLE_ROUTE); setTripConversation(false);
    appendTurn(exampleQuestion, 'Tara. This example uses Carousel, a walking transfer, then MRT-3. Open Directions for each boarding and alighting point.', EXAMPLE_ROUTE);
    history('looked_up', EXAMPLE_ROUTE);
  }
  function submit(query: string, fromHome = false): void {
    const normalized = normalize(query);
    const currentChatRoute = fromHome ? route : chatRoute;
    if (/masinag|antipolo/.test(normalized)) {
      appendTurn(query, 'Masinag and Antipolo are outside Metro Manila. This release covers NCR only. Edit your destination to a supported NCR landmark.'); return;
    }
    if (/pauwi|reverse|return|from one ayala|galing one ayala/.test(normalized)) {
      appendTurn(query, 'A return trip needs its own directed route search. Reverse route data isn’t installed; the forward steps can’t be reused.'); return;
    }
    if (currentChatRoute && /bababa|get off|alight/.test(normalized)) {
      const step = !fromHome && tripConversation ? activeRoute?.steps[activeStep] : currentChatRoute.steps.slice().reverse().find(item => item.mode === 'ride');
      appendTurn(query, step?.mode === 'ride' ? 'In the example, get off at ' + step.stop + '. ' + step.instruction
        : 'Your current example step is a walk. ' + (step?.instruction ?? 'Open Directions for the boarding and alighting points.')); return;
    }
    if (currentChatRoute && /last trip|oras|hours|schedule/.test(normalized)) {
      appendTurn(query, 'Operating hours aren’t reported in this example. I can’t confirm a last departure or whether the service is running now.'); return;
    }
    if (currentChatRoute && /cheapest|mura|cheaper|transfers|sakay|fastest/.test(normalized)) {
      appendTurn(query, 'Compare the example fare, reported time and transfers in Other options. Time ranges overlap; none is guaranteed fastest.', currentChatRoute); return;
    }
    if (exampleMode && normalized.includes('monumento') && normalized.includes('one ayala')) {
      appendTurn(query, 'These are example route facts, not installed data. Open Directions to see the supported layout and transfer sequence.', selected); return;
    }
    appendTurn(query, 'The route pack and local assistant aren’t installed in this preview. I can’t answer this journey yet. Use the example question to explore the design.');
  }
  function submitFromHome(query: string): void {
    setTripConversation(false);
    navigate('ask');
    submit(query, true);
  }
  function findRoutes(): void {
    if (!origin || !destination) { editEndpoint(!origin ? 'origin' : 'destination'); return; }
    if (/masinag|antipolo/.test(normalize(origin + ' ' + destination))) {
      setRoute(null); setError({ message: 'This place is outside NCR. Choose a supported Metro Manila landmark.',
        recovery: /masinag|antipolo/.test(normalize(origin)) ? 'origin' : 'destination' }); return;
    }
    if (normalize(origin) === normalize(destination)) { setRoute(null); setError({ message: 'Choose a different destination from your starting point.', recovery: 'destination' }); return; }
    if (exampleMode && normalize(origin).includes('monumento') && normalize(destination) === 'one ayala') {
      history('looked_up', selected); navigate('options'); return;
    }
    setRoute(null); setError({ message: 'Route data isn’t installed. Your endpoints are kept; check Offline resources or try the example journey.', recovery: 'resources' });
  }
  function choosePreference(value: Preference): void { setPreference(value); }
  function resumeTrip(): void {
    setTab('trips'); setStacks(current => ({ ...current, trips: ['trips', 'active'] }));
  }
  function beginTrip(): void {
    if (!route) return;
    store.upsertActiveTrip({ pack_id: 'SYNTHETIC-walkthrough', schema_version: 1, origin_place_id: 'SYNTHETIC-monumento',
      destination_place_id: 'SYNTHETIC-one-ayala', preference, route: selected.ids, current_step: 0, started_at: new Date().toISOString() });
    setActiveRoute(selected); setCompletedRoute(null); updateStore(); resumeTrip();
  }
  function startTrip(): void {
    if (!route) return;
    setSheet({ title: activeRoute ? 'Replace your active trip?' : 'Start this example trip?',
      body: activeRoute ? 'Your current progress will end. The new example starts at its first step.'
        : 'This is a design walkthrough, not travel guidance. GPS is unavailable. Mark each step yourself; progress lasts for this session.',
      action: activeRoute ? 'Replace trip' : 'Start example trip', onConfirm: () => { setSheet(null); beginTrip(); } });
  }
  function nextStep(): void {
    if (!activeRoute || !active) return;
    if (activeStep === activeRoute.steps.length - 1) {
      history('taken', activeRoute, active.preference); setRoute(activeRoute); setCompletedRoute(activeRoute); store.clearActiveTrip(); setActiveRoute(null);
      updateStore(); setStacks(current => ({ ...current, trips: ['trips', 'complete'] }));
    } else { store.advanceStep(); updateStore(); }
  }
  function previousStep(): void {
    if (active && activeStep > 0) { store.upsertActiveTrip({ ...active, current_step: activeStep - 1 }); updateStore(); }
  }
  function endTrip(): void {
    setSheet({ title: 'End this trip?', body: 'Your manual progress will end. This trip won’t be marked as taken.', action: 'End trip', destructive: true,
      onConfirm: () => { store.clearActiveTrip(); setActiveRoute(null); updateStore(); setSheet(null); setTab('trips'); setStacks(current => ({ ...current, trips: ['trips'] })); } });
  }
  function save(itinerary: PreviewRoute | null = route): void {
    if (!itinerary) return;
    const existing = store.listSavedRoutes().some(row => row.route.leg_ids.join('|') === itinerary.ids.leg_ids.join('|'));
    if (!existing) store.saveRoute({ pack_id: 'SYNTHETIC-walkthrough', origin_place_id: 'SYNTHETIC-monumento',
      destination_place_id: 'SYNTHETIC-one-ayala', preference, route: itinerary.ids, label: itinerary.title });
    updateStore(); notice(existing ? 'Already saved' : 'Route saved', 'Find this example in Trips. Only record IDs, label, preference and date are kept for this session.');
  }
  function openStored(row: SavedRouteRow | TripHistoryRow): void {
    const found = PREVIEW_ROUTES.find(item => item.ids.leg_ids.join('|') === row.route.leg_ids.join('|'));
    if (row.pack_id !== 'SYNTHETIC-walkthrough' || !found) {
      notice('This route needs re-planning', 'The saved IDs no longer match this preview. Start a new route search.'); return;
    }
    if (row.preference === 'cheapest' || row.preference === 'fastest' || row.preference === 'fewest-transfers') setPreference(row.preference);
    openDirections(found);
  }
  function location(): void {
    notice('Choose your starting point', 'GPS isn’t connected in this preview. Enter a landmark manually. In the release, nearby supported origins require your confirmation; accuracy and fix age stay visible.');
  }
  function deleteData(): void {
    setSheet({ title: 'Delete all your data?', body: 'This clears saved routes, history, preferences, conversation and active-trip progress.', action: 'Delete all data', destructive: true,
      onConfirm: () => {
        store.listSavedRoutes().forEach(row => store.deleteSavedRoute(row.saved_id)); store.clearHistory(); store.clearActiveTrip();
        setActiveRoute(null); setCompletedRoute(null); setRoute(null); setTurns([]); setPreference('cheapest'); setOrigin(''); setDestination('');
        setExampleMode(false); setTripConversation(false); updateStore(); setSheet(null);
      } });
  }
  function newConversation(): void {
    setSheet({ title: 'Start a new conversation?', body: 'This clears the current questions and planning context. Your active trip and saved routes are kept.',
      action: 'New conversation', onConfirm: () => {
        setTurns([]); setRoute(null); setOrigin(''); setDestination(''); setExampleMode(false); setTripConversation(false); setSheet(null);
      } });
  }
  function sources(): void {
    notice('Example records, no source dates', 'These walkthrough values aren’t extracted pack records and have no eligible source links. Production cards must show dated community reports, separate conflicts and unknowns. They must not claim field verification.');
  }

  function content(): React.JSX.Element {
    switch (screen) {
      case 'welcome': return <WelcomeScreen onContinue={() => {
        if (stacks[tab].length > 1) back();
        else setStacks(current => ({ ...current, plan: ['plan'] }));
      }}/>;
      case 'plan': return <PlanScreen origin={origin} destination={destination} landmarksOpen={landmarksOpen} onLandmarksOpen={setLandmarksOpen}
        onSuggestion={submitFromHome} onEdit={editEndpoint}
        onSwap={() => { setOrigin(destination); setDestination(origin); setRoute(null); setExampleMode(false); }}
        onFind={findRoutes} onExample={chooseExample} onResources={() => navigate('offline')} onLocation={location} onIntro={() => navigate('welcome')}/>;
      case 'ask': return <AskScreen turns={turns} route={chatRoute} origin={tripConversation && activeRoute ? 'LRT-1 Monumento' : origin}
        destination={tripConversation && activeRoute ? 'One Ayala' : destination} activeStep={tripConversation && activeRoute ? activeStep : null}
        onEdit={() => { setTripConversation(false); editEndpoint('destination'); }} onOptions={() => { if (chatRoute) setRoute(chatRoute); navigate('options'); }}
        onSteps={item => openDirections(item)} onMap={item => { setRoute(item); openMap(); }} onPrompt={submit} onExample={askExample}/>;
      case 'options': return route ? <RouteOptionsScreen selected={selected} preference={preference}
        onSelect={item => { setRoute(item); setDetailStep(0); }} onPreference={choosePreference}/>
        : <Notice action="Choose an example journey" onAction={chooseExample}>Your planning context was cleared. No route is selected.</Notice>;
      case 'steps': return route ? <RouteStepsScreen route={selected} stepIndex={detailStep} onStep={setDetailStep} onMap={openMap}
        onSave={() => save()} onAsk={() => openAsk()} onSources={sources}/>
        : <Notice action="Choose an example journey" onAction={chooseExample}>No route is selected. Start a new search or choose the labelled example.</Notice>;
      case 'map': return <RouteMapScreen route={mapRoute} schematic={schematic} onMode={setSchematic} onLocation={location}
        onSteps={() => { if (mapRoute) openDirections(mapRoute); }} onResources={() => navigate('offline')}
        onStep={index => { if (mapRoute) openDirections(mapRoute, index); }}/>;
      case 'active': return activeRoute ? <ActiveTripScreen route={activeRoute} stepIndex={activeStep} onEnd={endTrip}
        onAsk={() => openAsk(true)} onSteps={() => openDirections(activeRoute, activeStep)}/>
        : <Notice action="Plan a journey" onAction={() => openTab('plan')}>No active trip. Choose a route first.</Notice>;
      case 'complete': return completedRoute ? <TripCompleteScreen onSave={() => save(completedRoute)} onReturn={() => {
        setRoute(null); setExampleMode(false); setOrigin('One Ayala'); setDestination('LRT-1 Monumento'); setTripConversation(false);
        appendTurn('Pauwi naman?', 'A return journey needs a new directed search. Reverse data isn’t installed. Forward steps haven’t been reused.');
        setTab('plan'); setStacks(current => ({ ...current, plan: ['plan', 'ask'] }));
      }} onDone={() => { setRoute(null); setCompletedRoute(null); setExampleMode(false); setTurns([]); setOrigin(''); setDestination(''); setTripConversation(false);
        setTab('plan'); setStacks(current => ({ ...current, plan: ['plan'], trips: ['trips'] })); }}/>
        : <Text style={type.body}>No completed trip. Find your saved journeys and history in Trips.</Text>;
      case 'settings': return <SettingsScreen preference={preference} onPreference={choosePreference} onOpen={navigate} onLocation={location}/>;
      case 'offline': return <OfflineDataScreen checkedAt={checkedAt} onCheck={() => setCheckedAt(new Date().toLocaleTimeString())}/>;
      case 'privacy': return <PrivacyScreen onDelete={deleteData}/>;
      case 'about': return <AboutScreen/>;
      case 'trips': return <SavedScreen saved={store.listSavedRoutes()} history={store.listHistory()} segment={tripSegment} onSegment={setTripSegment}
        onOpen={openStored} onOpenHistory={openStored}
        onDelete={id => setSheet({ title: 'Delete this saved route?', body: 'Trip history is kept.', action: 'Delete route', destructive: true,
          onConfirm: () => { store.deleteSavedRoute(id); updateStore(); setSheet(null); } })}
        onRename={(id, label) => { store.renameSavedRoute(id, label); updateStore(); }}
        onDeleteHistory={id => setSheet({ title: 'Delete this history entry?', body: 'Saved routes are kept.', action: 'Delete entry', destructive: true,
          onConfirm: () => { store.deleteHistoryRow(id); updateStore(); setSheet(null); } })}
        onPlan={() => openTab('plan')}
        onClearHistory={() => setSheet({ title: 'Clear history?', body: 'This removes looked-up and taken journeys. Saved routes are kept.', action: 'Clear history', destructive: true,
          onConfirm: () => { store.clearHistory(); updateStore(); setSheet(null); } })}/>;
    }
  }
  function footer(): React.JSX.Element | null {
    if (screen === 'ask') return <AskComposer onSubmit={submit}/>;
    if (screen === 'plan') return <AskComposer onSubmit={submitFromHome}/>;
    if (screen === 'options' && route) return <Button label="See directions" icon="arrow" onPress={() => navigate('steps')}/>;
    if (screen === 'steps' && route) return <Button label="Start example trip" icon="arrow" onPress={startTrip}/>;
    if (screen === 'active' && activeRoute) return <View style={ui.row}>
      <IconButton name="back" label="Back a step" disabled={activeStep === 0} onPress={previousStep}/>
      <Button label={activeStep === activeRoute.steps.length - 1 ? 'I’m here · Finish trip' : 'I’m here · Next step'} onPress={nextStep} style={ui.flex}/>
    </View>;
    return null;
  }
  const bottomAction = footer();
  const isRoot = stacks[tab].length === 1;
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      accessibilityElementsHidden={modalOpen} importantForAccessibility={modalOpen ? 'no-hide-descendants' : 'auto'}
      {...(Platform.OS === 'web' ? { inert: modalOpen ? true : undefined } : {})}>
      <View style={styles.header} ref={returnFocus} tabIndex={-1}>
        {isRoot ? screen === 'plan' || screen === 'welcome' ? <Gaile pose="idle" height={30}/> : <Icon name={tab === 'map' ? 'map' : 'trips'} color={palette.accent}/> : <IconButton name="back" label="Go back" onPress={back}/>}
        <Text style={[type.label, ui.flex]}>{screen === 'welcome' ? 'Pusang Gala' : TITLES[screen]}</Text>
        {screen === 'welcome' ? null : screen === 'ask' ? <Button label="New" variant="text" onPress={newConversation}/> : <IconButton name="settings" label="Open settings" onPress={() => { if (screen !== 'settings') navigate('settings'); }}/>}
      </View>
      {exampleMode || activeRoute ? <View style={styles.preview}><Text style={[type.caption, ui.flex]}>Example mode · not travel guidance</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Leave example mode" onPress={() => {
          if (activeRoute) notice('Example trip in progress', 'End the example trip first. Your current manual progress has been kept.');
          else { setExampleMode(false); setRoute(null); setTurns([]); setOrigin(''); setDestination('');
            setTab('plan'); setStacks({ plan: ['plan'], map: ['map'], trips: ['trips'] }); }
        }} style={styles.leave}><Text style={[type.caption, { color: palette.accent }]}>Exit</Text></Pressable></View> : null}
      <ScrollView testID="main-scroll" ref={scrollRef} keyboardShouldPersistTaps="handled" style={ui.flex} contentContainerStyle={styles.content}>
        {error ? <Notice title="Route unavailable" action={error.recovery === 'resources' ? 'Check offline resources' : error.recovery === 'origin' ? 'Edit starting point' : 'Edit destination'}
          onAction={() => { if (error.recovery === 'resources') navigate('offline'); else editEndpoint(error.recovery); }}>{error.message}</Notice> : null}
        {content()}
      </ScrollView>
      {bottomAction ? <View style={[styles.footer, screen === 'plan' && styles.homeFooter]}>{bottomAction}</View> : null}
      {activeRoute && screen !== 'active' ? <Pressable accessibilityRole="button" accessibilityLabel="Resume active trip" onPress={resumeTrip} style={styles.resume}>
        <Icon name="arrow" size={19} color={palette.accent}/><View style={ui.flex}><Text style={type.label}>Continue to One Ayala</Text>
          <Text style={type.caption}>{'Step ' + (activeStep + 1) + ' of ' + activeRoute.steps.length + ' · manual progress'}</Text></View>
      </Pressable> : null}
      {screen !== 'welcome' ? <View style={styles.tabs}>{TABS.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label}
        accessibilityState={{ selected: tab === item.id }} aria-selected={tab === item.id} onPress={() => openTab(item.id)} style={styles.tab}>
        <Icon name={item.icon} color={tab === item.id ? palette.accent : palette.secondary}/>
        <Text style={[type.caption, tab === item.id && styles.activeTab]}>{item.label}</Text>
        {tab === item.id ? <View style={styles.tabIndicator}/> : null}
      </Pressable>)}</View> : null}
    </KeyboardAvoidingView>
    {modalOpen ? <Modal transparent visible animationType="none" onRequestClose={() => { setSheet(null); setEditing(null); }}>
      <KeyboardAvoidingView style={styles.scrim} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View accessibilityViewIsModal role="dialog" aria-modal accessibilityLabel={editing ? 'Edit ' + editing : sheet?.title}
          {...(Platform.OS === 'web' ? { onKeyDown: (event: { key: string; preventDefault: () => void }) => {
            if (event.key === 'Escape') { event.preventDefault(); setSheet(null); setEditing(null); }
            if (event.key === 'Tab') {
              const dialog = (sheetHeading.current as unknown as HTMLElement | null)?.closest('[role="dialog"]');
              const nodes = dialog?.querySelectorAll<HTMLElement>('button, input, [role="button"][tabindex="0"]');
              if (!nodes?.length) return;
              const first = nodes[0], last = nodes[nodes.length - 1];
              const keyEvent = event as unknown as { shiftKey: boolean };
              if (keyEvent.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
              else if (!keyEvent.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
          } } : {})} style={styles.sheet}>
          <View style={ui.between}><Text ref={sheetHeading} {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})} accessibilityRole="header" style={[type.heading, ui.flex]}>
            {editing ? editing === 'origin' ? 'Starting landmark' : 'Destination' : sheet?.title}</Text>
            <IconButton name="close" label="Close sheet" onPress={() => { setSheet(null); setEditing(null); }}/></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
            {editing ? <><Text style={type.secondary}>Use a supported NCR landmark. Editing keeps your active trip, but starts a new route search.</Text>
              <TextInput accessibilityLabel="Landmark name" value={endpointText} onChangeText={setEndpointText}
                style={[type.body, ui.input]} placeholder="Type a landmark" placeholderTextColor={palette.secondary} autoFocus
                returnKeyType="done" onSubmitEditing={commitEndpoint}/>
              <Text style={type.caption}>The route pack is unavailable. This field keeps your input without guessing a place or walking connection.</Text>
              <Button label="Use this landmark" disabled={!endpointText.trim()} onPress={commitEndpoint}/>
            </> : sheet ? <><Text style={type.body}>{sheet.body}</Text>
              <Button label={sheet.action} variant={sheet.destructive ? 'danger' : 'primary'} onPress={sheet.onConfirm}/>
              {sheet.action !== 'Got it' ? <Button variant="text" label="Cancel" onPress={() => setSheet(null)}/> : null}</> : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal> : null}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  page: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: palette.paper },
  header: { minHeight: 64, paddingHorizontal: 16, gap: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: palette.line,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}) },
  preview: { minHeight: 44, paddingLeft: 20, paddingRight: 10, backgroundColor: palette.background, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  leave: { minWidth: 48, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 24, paddingBottom: 32, gap: 20 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: palette.paper, borderTopWidth: 1, borderColor: palette.line },
  homeFooter: { backgroundColor: palette.goldSoft, borderTopColor: palette.gold },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderColor: palette.line, paddingHorizontal: 20, paddingTop: 7, paddingBottom: 5, backgroundColor: palette.paper },
  tab: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  activeTab: { color: palette.accent, fontWeight: '600' }, tabIndicator: { position: 'absolute', top: -8, width: 30, height: 2, backgroundColor: palette.accent },
  resume: { minHeight: 68, paddingVertical: 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.accentSoft },
  scrim: { flex: 1, backgroundColor: 'rgba(20,30,25,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '85%', backgroundColor: palette.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 32, gap: 16 },
});
