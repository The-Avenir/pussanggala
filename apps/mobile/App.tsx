import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MobileShell } from './src/screens/MobileShell';
import { colors } from './src/ui/theme';

function App(): React.JSX.Element {
  const [loaded, error] = useFonts({
    NunitoBold: require('./assets/fonts/Nunito-Bold.ttf'),
    NunitoExtraBold: require('./assets/fonts/Nunito-ExtraBold.ttf'),
    DMSans: require('./assets/fonts/DMSans-Regular.ttf'),
    DMSansBold: require('./assets/fonts/DMSans-Bold.ttf'),
  });
  return <SafeAreaProvider>
    <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
    {loaded || error ? <MobileShell /> : <View style={styles.loading}>
      <ActivityIndicator color={colors.orange} /><Text style={styles.label}>Pusang Gala</Text>
    </View>}
  </SafeAreaProvider>;
}
const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 12 },
  label: { color: colors.ink, fontSize: 24, fontWeight: 'bold' },
});

registerRootComponent(App);
export default App;
