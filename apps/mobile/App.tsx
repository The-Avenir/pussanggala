import { registerRootComponent } from 'expo';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MobileShell } from './src/screens/MobileShell';
import { palette } from './src/ui/travel';

function App(): React.JSX.Element {
  return <SafeAreaProvider>
    <StatusBar barStyle="dark-content" backgroundColor={palette.paper} />
    <MobileShell />
  </SafeAreaProvider>;
}
registerRootComponent(App);
export default App;
