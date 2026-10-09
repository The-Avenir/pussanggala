import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { AiRuntimeError, CancellationTokenSource, explain } from '@pusang-gala/ai';
import type { GroundingContext, SafeUnitHandler } from '@pusang-gala/ai';
import { LlamaRuntime } from '../adapters/llamaRuntime';
import { ModelInstaller } from './modelInstaller';
import { QWEN_MODEL } from './qwen';
import type { ModelStatus } from './qwen';

export type AssistantPhase = 'idle' | 'loading' | 'generating';

export function useLocalAssistant() {
  const [model, setModel] = useState<ModelStatus>({
    phase: Platform.OS === 'web' ? 'unsupported' : 'checking', progress: 0, error: null,
  });
  const [phase, setPhase] = useState<AssistantPhase>('idle');
  const [runtime] = useState(() => new LlamaRuntime());
  const installer = useRef<ModelInstaller | null>(null);
  const operation = useRef<CancellationTokenSource | null>(null);
  const mounted = useRef(false);
  const loaded = useRef(false);
  const pickingFile = useRef(false);

  useEffect(() => {
    mounted.current = true;
    if (Platform.OS === 'web') return () => { mounted.current = false; };
    const source = new CancellationTokenSource();
    operation.current = source;
    void import('./expoModelFiles').then(async ({ createModelFiles }) => {
      source.token.throwIfCancelled();
      const instance = new ModelInstaller(createModelFiles());
      installer.current = instance;
      await instance.run(false, source.token, status => { if (mounted.current) setModel(status); });
    }).catch(error => {
      if (mounted.current && !source.token.isCancelled) setModel({ phase: 'error', progress: 0, error: String(error) });
    }).finally(() => { if (operation.current === source) operation.current = null; });
    const subscription = AppState.addEventListener('change', state => {
      // The system file picker backgrounds the app while the user chooses a file.
      if (state !== 'active' && !pickingFile.current) operation.current?.cancel();
    });
    return () => {
      mounted.current = false;
      source.cancel();
      operation.current?.cancel();
      subscription.remove();
      void runtime.dispose().catch(() => {});
    };
  }, [runtime]);

  async function install(download: boolean): Promise<void> {
    const instance = installer.current;
    if (!instance || operation.current) return;
    const source = new CancellationTokenSource();
    operation.current = source;
    try {
      await runtime.dispose();
      loaded.current = false;
      await instance.run(download, source.token, status => { if (mounted.current) setModel(status); });
    } catch (error) {
      if (mounted.current) setModel({ phase: 'error', progress: 0, error: String(error) });
    } finally { if (operation.current === source) operation.current = null; }
  }

  async function explainContext(context: GroundingContext, onUnit: SafeUnitHandler): Promise<void> {
    const instance = installer.current;
    if (model.phase !== 'installed' || !instance) throw new AiRuntimeError('asset-unavailable', 'Download or import the local assistant in Offline resources first.');
    if (operation.current) throw new AiRuntimeError('busy', 'The local assistant is busy. Please retry shortly.');
    const source = new CancellationTokenSource();
    operation.current = source;
    try {
      if (!loaded.current) {
        setPhase('loading');
        await runtime.load({ modelPath: instance.files.modelUri, sha256: QWEN_MODEL.sha256, budget: QWEN_MODEL.budget }, source.token);
        loaded.current = true;
      }
      source.token.throwIfCancelled();
      if (mounted.current) setPhase('generating');
      const report = await explain(context, runtime, unit => {
        if (mounted.current && !source.token.isCancelled) onUnit(unit);
      }, { token: source.token });
      if (source.token.isCancelled || report.status === 'cancelled') throw new AiRuntimeError('cancelled', 'Explanation stopped.');
      if (report.status !== 'completed' || report.emittedUnits === 0) {
        throw new AiRuntimeError('invalid-stream', 'The assistant could not produce a validated explanation.');
      }
    } catch (error) {
      // Also drains a cancelled native load before another operation can acquire it.
      loaded.current = false;
      await runtime.dispose();
      throw error;
    } finally {
      if (operation.current === source) operation.current = null;
      if (mounted.current) setPhase('idle');
    }
  }

  async function importModel(): Promise<void> {
    const instance = installer.current;
    if (!instance || operation.current) return;
    const source = new CancellationTokenSource();
    operation.current = source;
    pickingFile.current = true;
    setModel({ phase: 'selecting', progress: 0, error: null });
    try {
      const { pickModelFile } = await import('./expoModelFiles');
      source.token.throwIfCancelled();
      const uri = await pickModelFile();
      pickingFile.current = false;
      source.token.throwIfCancelled();
      if (!uri) { if (mounted.current) setModel(model); return; }
      await runtime.dispose();
      loaded.current = false;
      await instance.run(true, source.token, status => { if (mounted.current) setModel(status); }, uri);
    } catch (error) {
      if (mounted.current) setModel(source.token.isCancelled ? model : { phase: 'error', progress: 0, error: String(error) });
    } finally {
      pickingFile.current = false;
      if (operation.current === source) operation.current = null;
    }
  }

  return { model, phase, install: () => install(true), importModel, recheck: () => install(false), explainContext,
    cancel: () => operation.current?.cancel() };
}

export type LocalAssistant = ReturnType<typeof useLocalAssistant>;
