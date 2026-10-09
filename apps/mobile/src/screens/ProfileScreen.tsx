import { StyleSheet, Text, View } from 'react-native';
import { Gaile, ListRow, Section, palette, type, ui } from '../ui/travel';

// Walkthrough §12. Accounts are deferred (LOG G07): the Google row is
// informational only, and every feature works without signing in.
export function ProfileScreen({ savedCount, takenCount, onSignIn, onSaved, onHistory, onSettings, onHelp }: {
  savedCount: number; takenCount: number; onSignIn: () => void;
  onSaved: () => void; onHistory: () => void; onSettings: () => void; onHelp: () => void;
}): React.JSX.Element {
  return <View style={ui.screen}>
    <View style={styles.identity}>
      <View style={styles.avatar}><Gaile pose="idle" height={56}/></View>
      <View style={ui.flex}><Text accessibilityRole="header" style={type.title}>Commuter</Text>
        <Text style={type.secondary}>Not signed in</Text></View>
    </View>
    <ListRow title="Sign in with Google" detail="Needs internet · accounts are coming later" icon="info" onPress={onSignIn}/>
    <Section title="YOUR TRIPS, ON THIS PHONE">
      <ListRow title="Saved routes" value={String(savedCount)} icon="save"/>
      <ListRow title="Trips taken" value={String(takenCount)} icon="check"/>
    </Section>
    <Section title="SHORTCUTS">
      <ListRow title="Saved routes" icon="save" onPress={onSaved}/>
      <ListRow title="History" icon="trips" onPress={onHistory}/>
      <ListRow title="Settings" icon="settings" onPress={onSettings}/>
      <ListRow title="Help & tips" icon="info" onPress={onHelp}/>
    </Section>
    <Text style={type.caption}>Your trips and location never leave this phone.</Text>
  </View>;
}
const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: palette.goldSoft,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: palette.gold },
});
