import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { Pack } from '@pusang-gala/core';
import type { TripConversationManager } from '@pusang-gala/conversation';
import { createRouteConversation } from './evidence';

export function useRoutePack() {
  const [state, setState] = useState<{ phase: 'checking' | 'ready' | 'error' | 'unsupported'; pack?: Pack; error?: string }>(
    { phase: Platform.OS === 'web' ? 'unsupported' : 'checking' });
  const conversation = useRef<TripConversationManager | null>(null);
  const operation = useRef(0);
  async function recheck() {
    if (Platform.OS === 'web') return;
    const version = ++operation.current;
    conversation.current = null;
    setState({ phase: 'checking' });
    try {
      const { loadBundledPack } = await import('./loadBundledPack');
      const pack = await loadBundledPack();
      if (operation.current !== version) return;
      conversation.current = createRouteConversation(pack);
      setState({ phase: 'ready', pack });
    } catch (error) {
      if (operation.current === version) setState({ phase: 'error', error: error instanceof Error ? error.message : 'Unable to open route pack.' });
    }
  }
  useEffect(() => { void recheck(); return () => { operation.current += 1; }; }, []);
  return { ...state, conversation, recheck };
}
export type RoutePackResource = ReturnType<typeof useRoutePack>;
