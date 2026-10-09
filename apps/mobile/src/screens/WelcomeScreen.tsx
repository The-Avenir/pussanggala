import { StyleSheet, Text, View } from 'react-native';
import { Button, Gaile, Icon, palette, type, ui } from '../ui/travel';

export function WelcomeScreen({ onContinue }: { onContinue: () => void }): React.JSX.Element {
  return <View style={[ui.screen, styles.screen]}>
    <View style={styles.hello}><Gaile pose="wave" height={190}/></View>
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={type.display}>Tara, gala tayo.</Text>
      <Text style={type.body}>Meet Gaile, your NCR commute companion. Find your way with a little more confidence.</Text></View>
    <View style={{ gap: 12 }}>
      <View style={styles.feature}><Icon name="bus" color={palette.accent}/><View style={ui.flex}><Text style={type.label}>Find your sakay</Text>
        <Text style={type.secondary}>Compare reported routes between NCR landmarks.</Text></View></View>
      <View style={styles.feature}><Icon name="chat" color={palette.accent}/><View style={ui.flex}><Text style={type.label}>Ask in your own words</Text>
        <Text style={type.secondary}>English or Taglish, from planning to transfers.</Text></View></View>
      <View style={styles.feature}><Icon name="walk" color={palette.accent}/><View style={ui.flex}><Text style={type.label}>Go at your own pace</Text>
        <Text style={type.secondary}>Mark each step when you get there.</Text></View></View>
    </View>
    <Button label="Plan a journey" icon="arrow" onPress={onContinue}/>
    <Text style={type.caption}>No account needed. Check Offline resources for route and assistant availability.</Text>
  </View>;
}
const styles = StyleSheet.create({
  screen: { gap: 20, paddingBottom: 12 },
  hello: { alignItems: 'center', paddingVertical: 16, marginHorizontal: -20, marginTop: -20,
    backgroundColor: palette.gold, borderBottomWidth: 3, borderBottomColor: palette.orange },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
