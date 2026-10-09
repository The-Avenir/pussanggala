import { StyleSheet, Text, View } from 'react-native';
import { Gaile, Section, type, ui } from '../ui/travel';

// Walkthrough §12 "Help & tips": how to read cards and what "reported" means.
export function HelpScreen(): React.JSX.Element {
  return <View style={ui.screen}>
    <View style={styles.hero}><Gaile pose="binoculars" height={84}/>
      <View style={ui.flex}><Text accessibilityRole="header" style={type.title}>Help & tips</Text>
        <Text style={type.secondary}>How to read your route cards.</Text></View></View>
    <Section title="WHAT “REPORTED” MEANS">
      <Text style={type.body}>Fares, times and tips are dated community reports — shared by riders, not confirmed by Pusang Gala.</Text>
      <Text style={type.body}>“Not reported” means nobody has shared it yet — it’s never shown as ₱0 and never guessed. When reports disagree, both values appear with their dates.</Text>
      <Text style={type.body}>Reported time ranges can overlap, so a shorter reported range doesn’t guarantee a faster trip.</Text>
    </Section>
    <Section title="READING A ROUTE">
      <Text style={type.body}>The large signboard panel shows the text to look for on the vehicle. The stop diagram shows stop order only — it isn’t the road path and isn’t drawn to scale.</Text>
      <Text style={type.body}>Check the signboard and ask the driver or conductor before boarding.</Text>
    </Section>
    <Section title="ON YOUR TRIP">
      <Text style={type.body}>Steps advance only when you tap Next — keep the app open to see your position. Your trips and location stay on this phone.</Text>
    </Section>
  </View>;
}
const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
