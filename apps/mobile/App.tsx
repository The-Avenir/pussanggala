/**
 * T40 minimal Expo harness — ugly-first offline placeholder.
 *
 * Renders synthetic integration controls. Native modules are registered by
 * the scaffold; actual pack/model/map readiness requires the owning adapters.
 * Never imports `howtogetthereph_dataset/` (INV-4).
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { JourneyScreen } from './src/screens/JourneyScreen';
import { SUPPORTED_PACK_SCHEMA_VERSION } from './src/core';
import { CORE_UNIT_TEXT_MAX } from '@pusang-gala/ai';
import { DEFAULT_MAX_EXCHANGES } from '@pusang-gala/conversation';

interface PlaceholderCard {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

const PLACEHOLDER_CARDS: readonly PlaceholderCard[] = [
  {
    id: 'placeholder-card-1',
    title: 'Route card (placeholder)',
    body: 'Real route cards land in T45. Synthetic text only — not pack data.',
  },
  {
    id: 'placeholder-card-2',
    title: 'Offline pack status (placeholder)',
    body: 'Pack loader + readiness states land in T41. No assets bundled yet.',
  },
  {
    id: 'placeholder-card-3',
    title: 'GPS status (placeholder)',
    body: 'Foreground GPS fix display lands in T43. No location read yet.',
  },
];

function OfflineBanner(): React.JSX.Element {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>OFFLINE MODE — placeholder harness (T40)</Text>
    </View>
  );
}

function PlaceholderCardView({ card }: { readonly card: PlaceholderCard }): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.cardBody}>{card.body}</Text>
    </View>
  );
}

function OfflineMapBox(): React.JSX.Element {
  return (
    <View style={styles.mapBox}>
      <Text style={styles.mapBoxText}>Offline map box (placeholder)</Text>
      <Text style={styles.mapBoxSub}>MapLibre basemap lands in T42 / S2</Text>
    </View>
  );
}

function App(): React.JSX.Element {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Pusang Gala</Text>
      <Text>Technical harness: core schema {SUPPORTED_PACK_SCHEMA_VERSION}. Real pack, model and map readiness is unmeasured.</Text>
      <Text>Linked AI unit limit: {CORE_UNIT_TEXT_MAX}; conversation window: {DEFAULT_MAX_EXCHANGES}.</Text>
      <OfflineBanner />
      <JourneyScreen />
      {PLACEHOLDER_CARDS.map((card) => (
        <PlaceholderCardView key={card.id} card={card} />
      ))}
      <OfflineMapBox />
      <Text style={styles.footer}>
        Ugly-first harness. No network, no analytics, no dataset import.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  banner: {
    backgroundColor: '#222222',
    padding: 10,
    borderRadius: 4,
  },
  bannerText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  card: {
    borderWidth: 1,
    borderColor: '#999999',
    borderRadius: 4,
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 14,
  },
  mapBox: {
    height: 220,
    backgroundColor: '#dddddd',
    borderWidth: 2,
    borderColor: '#666666',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  mapBoxText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  mapBoxSub: {
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
});

export default App;
