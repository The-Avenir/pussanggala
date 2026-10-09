import { Text, View } from 'react-native';
import { Button, Notice, type, ui } from '../ui/travel';
import type { LocalAssistant } from '../inference/useLocalAssistant';

export function LocalAssistantResource({ assistant }: { assistant: LocalAssistant }): React.JSX.Element {
  const { model, phase } = assistant;
  const working = ['checking', 'selecting', 'importing', 'downloading', 'verifying'].includes(model.phase) || phase !== 'idle';
  const label = model.phase === 'installed' ? 'Installed' : model.phase === 'downloading'
    ? 'Downloading' : model.phase === 'verifying' ? 'Verifying' : model.phase === 'checking' ? 'Checking local files'
    : model.phase === 'selecting' ? 'Choose a local file' : model.phase === 'importing' ? 'Copying local model'
    : model.phase === 'unsupported' ? 'Requires Android or iOS' : model.phase === 'error' ? 'Installation unavailable' : 'Missing';
  return <View style={{ gap: 12, paddingVertical: 16 }}>
    <View style={[ui.between, { flexWrap: 'wrap', gap: 8 }]}><Text style={type.heading}>Local assistant</Text><Text style={type.secondary}>{label}</Text></View>
    <Text style={type.body}>Qwen 2.5 · 0.5B · Q4_K_M · 491 MB</Text>
    <Text style={type.secondary}>Import the GGUF from your phone or download it once. After setup, explanations run on your phone. Your questions stay on this device.</Text>
    {model.phase === 'selecting' || model.phase === 'importing' ? <Text style={type.body}>{label}</Text> : null}
    {model.phase === 'downloading' || model.phase === 'verifying' ? <View accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(model.progress * 100) }}>
      <Text style={type.body}>{label} · {Math.round(model.progress * 100)}%</Text></View> : null}
    {model.error ? <Notice>{model.error}</Notice> : null}
    {model.phase === 'unsupported' ? <Text style={type.secondary}>Use a native development or release build to install the assistant.</Text>
      : working ? <Button label="Cancel" variant="secondary" onPress={assistant.cancel}/>
      : model.phase !== 'installed' ? <View style={{ gap: 12 }}>
        <Button label="Import local GGUF" onPress={() => { void assistant.importModel(); }}/>
        <Button label="Download local assistant · 491 MB" variant="secondary" onPress={() => { void assistant.install(); }}/>
      </View>
      : <Text style={type.secondary}>Ready for on-device explanations. Route data and the basemap are separate resources.</Text>}
  </View>;
}
