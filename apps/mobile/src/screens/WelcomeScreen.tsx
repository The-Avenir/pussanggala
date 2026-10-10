import { StyleSheet, Text, View } from 'react-native';
import { Button, Gaile, Icon, palette, type, ui } from '../ui/travel';

export function WelcomeScreen({ onContinue }: { onContinue: () => void }): React.JSX.Element {
  return <View style={[ui.screen, styles.screen]}>
    <Text style={[type.display, styles.center]}>Pusang Gala</Text>
    <View style={styles.hello}><View style={styles.sun}/><View style={styles.skyline}>{[64, 100, 78, 122, 60, 88].map((height, index) =>
      <View key={index} style={[styles.building, { height }]}/>)}</View><Gaile pose="wave" height={236}/></View>
    <View style={styles.copy}><Text accessibilityRole="header" style={[type.display, styles.center]}>Tara, gala tayo.</Text>
      <Text style={[type.body, styles.center]}>Ako si Gaile, ang kasama mo sa biyahe. Let’s explore Metro Manila, one step at a time.</Text></View>
    <View style={styles.features}>{[{ icon: 'bus', label: 'Offline routes' }, { icon: 'chat', label: 'Taglish chat' }, { icon: 'walk', label: 'At your pace' }].map(item =>
      <View key={item.label} style={styles.feature}><Icon name={item.icon as 'bus' | 'chat' | 'walk'} color={palette.accent} size={16}/><Text style={type.caption}>{item.label}</Text></View>)}</View>
    <Button label="Plan a journey" icon="arrow" onPress={onContinue}/>
    <Text style={[type.caption, styles.center]}>No account needed. Check Offline resources for route and assistant availability.</Text>
  </View>;
}
const styles = StyleSheet.create({
  screen: { gap: 16, paddingTop: 20, paddingBottom: 12 },
  hello: { minHeight: 260, alignItems: 'center', justifyContent: 'flex-end', paddingVertical: 8 },
  sun: { position: 'absolute', top: 12, right: 12, width: 72, height: 72, borderRadius: 36, backgroundColor: palette.goldSoft },
  skyline: { position: 'absolute', bottom: 18, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  building: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: palette.goldSoft, borderWidth: 1, borderColor: palette.line },
  copy: { gap: 8 }, center: { textAlign: 'center' },
  features: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
