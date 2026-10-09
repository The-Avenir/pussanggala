import { StyleSheet, Text, View } from 'react-native';
import { Bus, MapIcon, Spark, WelcomeCat } from '../ui/assets';
import { Action, FeatureRow } from '../ui/components';
import { colors, typography } from '../ui/theme';

export function WelcomeScreen({ onContinue }: { onContinue: () => void }): React.JSX.Element {
  return <View style={styles.screen}>
    <View style={styles.content}>
      <View style={styles.hero}><WelcomeCat /></View>
      <Text style={[typography.display, styles.center]}>Pusang Gala</Text>
      <Text style={[typography.label, styles.center]}>Your offline commute buddy</Text>
      <Text style={[typography.caption, styles.center]}>Kahit saan ang lakbay, handang pumatnubay.</Text>
      <FeatureRow Icon={MapIcon} title="Offline maps" subtitle="NCR maps travel with you, without mobile data." />
      <FeatureRow Icon={Bus} title="Community-reported routes" subtitle="Signboards, landmarks, and dated fare reports." />
      <FeatureRow Icon={Spark} title="Ask in Taglish" subtitle="Ask like you would ask a friend." />
    </View>
    <View style={styles.footer}><Action label="Continue without an account →" onPress={onContinue} /></View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 20, gap: 12 },
  hero: { height: 235, backgroundColor: colors.orangeSoft, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  center: { textAlign: 'center' }, footer: { padding: 20, paddingTop: 8, marginTop: 'auto' },
});
