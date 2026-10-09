import { StyleSheet, Text, View } from 'react-native';
import { Button, Gaile, ListRow, type, ui } from '../ui/travel';

export function WelcomeScreen({ onContinue }: { onContinue: () => void }): React.JSX.Element {
  return <View style={[ui.screen, styles.screen]}>
    <Gaile pose="map" height={112}/>
    <Text accessibilityRole="header" style={type.display}>Your commute,{ '\n' }a little clearer.</Text>
    <Text style={type.body}>Tara. Find your route, understand each transfer, and take it one step at a time.</Text>
    <View><ListRow title="Choose supported NCR landmarks" icon="pin"/>
      <ListRow title="Compare community-reported routes" icon="bus"/>
      <ListRow title="Mark each step when you get there" icon="check"/></View>
    <Button label="Plan a journey" icon="arrow" onPress={onContinue}/>
    <Text style={type.secondary}>No account needed. Your trips stay on this phone.</Text>
  </View>;
}
const styles = StyleSheet.create({ screen: { paddingVertical: 24 } });
