import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MobileShell } from './src/screens/MobileShell';
import { palette } from './src/ui/travel';

function App(): React.JSX.Element {
  // Keep the app usable immediately; bundled fonts replace the system fallback when ready.
  useFonts({
    DMSans: require('./assets/fonts/DMSans-Regular.ttf'),
    DMSansBold: require('./assets/fonts/DMSans-Bold.ttf'),
    NunitoBold: require('./assets/fonts/Nunito-Bold.ttf'),
    NunitoExtraBold: require('./assets/fonts/Nunito-ExtraBold.ttf'),
  });
  return <SafeAreaProvider>
    <StatusBar barStyle="dark-content" backgroundColor={palette.paper} />
    <MobileShell />
  </SafeAreaProvider>;
}
registerRootComponent(App);
export default App;
