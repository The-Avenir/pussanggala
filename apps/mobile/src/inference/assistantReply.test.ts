import { describe, expect, it } from 'vitest';
import { AiRuntimeError, buildGroundingContext, DEFAULT_BUDGETS, guardStream } from '@pusang-gala/ai';
import type { GroundingContext, SafeUnitHandler } from '@pusang-gala/ai';
import { assistantReply } from './assistantReply';
import { conversationContext } from './conversationContext';

function grounding(): GroundingContext {
  const result = buildGroundingContext({ cards: [{ cardId: 'c1', title: 'Synthetic ride', packRecordIds: ['lg_synthetic'] }],
    statements: [{ id: 'f1', role: 'step', stepOrder: 1, text: 'Sakay ng jeep mula Lantern papuntang Copper.', packRecordIds: ['lg_synthetic'] }] },
  { ...DEFAULT_BUDGETS, connectiveTextOnly: true });
  if (!result.ok) throw new Error(result.reason);
  return result.context;
}
const generate = async (context: GroundingContext, onUnit: SafeUnitHandler) => {
  async function* chunks() {
    yield JSON.stringify({ kind: 'step', inserts: ['f1'], text: 'Sige, simulan natin dito.' });
  }
  await guardStream(context, chunks(), onUnit);
};

describe('real route chat generation', () => {
  it('uses local AI for a retrieved route without first displaying the fixed reply', async () => {
    const shown: string[] = [];
    const result = await assistantReply({ context: grounding(), fallback: 'Fixed reply', generate,
      onText: text => shown.push(text), isCurrent: () => true });
    expect(result.localAi).toBe(true);
    expect(shown).toEqual(['Sige, simulan natin dito. Sakay ng jeep mula Lantern papuntang Copper.']);
    expect(shown.join('')).not.toContain('Fixed reply');
    expect(shown.join('')).not.toContain('"inserts"');
  });
  it('shows an explained report fallback when the local model is unavailable', async () => {
    const shown: string[] = [];
    const result = await assistantReply({ context: grounding(), fallback: 'Route reports',
      onText: text => shown.push(text), isCurrent: () => true });
    expect(shown).toEqual(['Route reports']);
    expect(result.aiNotice).toContain('unavailable');
  });
  it('rejects invented instructions even with a valid citation and recovers with reports', async () => {
    const shown: string[] = [];
    const result = await assistantReply({ context: grounding(), fallback: 'Route reports',
      generate: async (context, onUnit) => {
        async function* chunks() {
          yield JSON.stringify({ kind: 'step', inserts: ['f1'], text: 'Board a bus at Imaginary Terminal.' });
        }
        await guardStream(context, chunks(), onUnit);
      }, onText: text => shown.push(text), isCurrent: () => true });
    expect(result.localAi).toBe(false);
    expect(shown).toEqual(['Route reports']);
  });
  it('does not let a generic greeting hide omitted route directions', async () => {
    const shown: string[] = [];
    await assistantReply({ context: grounding(), fallback: 'Route reports',
      generate: async (context, onUnit) => {
        async function* chunks() { yield JSON.stringify({ kind: 'summary', inserts: [], text: 'Hello!' }); }
        await guardStream(context, chunks(), onUnit);
      }, onText: text => shown.push(text), isCurrent: () => true });
    expect(shown.join('')).toContain('Route reports');
  });
  it('drops late output after a new conversation or unmount', async () => {
    const shown: string[] = [];
    await assistantReply({ context: grounding(), fallback: 'Route reports', generate,
      onText: text => shown.push(text), isCurrent: () => false });
    expect(shown).toEqual([]);
  });
  it('stopping generation does not insert a canned answer', async () => {
    const shown: string[] = [];
    const result = await assistantReply({ context: grounding(), fallback: 'Route reports',
      generate: async () => { throw new AiRuntimeError('cancelled', 'Stopped'); },
      onText: text => shown.push(text), isCurrent: () => true });
    expect(shown).toEqual([]);
    expect(result.aiNotice).toContain('stopped');
  });
  it('acknowledges the destination and asks for the missing origin with generated wording', async () => {
    const shown: string[] = [];
    const result = await assistantReply({ context: conversationContext('ask_origin', 'SM North EDSA', []),
      opening: 'SM North EDSA—got it!', fallback: 'Where are you coming from?',
      generate: async (context, onUnit) => {
        async function* output() { yield JSON.stringify({ kind: 'clarify', inserts: [], text: 'Where are you coming from? A nearby landmark is fine.' }); }
        await guardStream(context, output(), onUnit);
      }, onText: text => shown.push(text), isCurrent: () => true });
    expect(result.localAi).toBe(true);
    expect(shown).toEqual(['SM North EDSA—got it! Where are you coming from? A nearby landmark is fine.']);
  });
  it('falls back when a conversational reply fails to ask for the missing endpoint', async () => {
    const shown: string[] = [];
    await assistantReply({ context: conversationContext('ask_origin', 'SM North EDSA', []), fallback: 'Where are you coming from?',
      generate: async (context, onUnit) => {
        async function* output() { yield JSON.stringify({ kind: 'summary', inserts: [], text: 'Great, let’s go!' }); }
        await guardStream(context, output(), onUnit);
      }, onText: text => shown.push(text), isCurrent: () => true });
    expect(shown).toEqual(['Where are you coming from?']);
  });
  it.each(['Paano pumunta sa One Ayala?', 'Where do you want to go?', 'Saan tayo pupunta?'])
    ('rejects a wrong-endpoint question when origin is missing: %s', async text => {
      const shown: string[] = [];
      const result = await assistantReply({ context: conversationContext('ask_origin', 'Paano pumunta sa One Ayala?', [],
        { destinationLabel: 'One Ayala transport hub' }), fallback: 'Saan ka manggagaling?',
        generate: async (context, onUnit) => {
          async function* output() { yield JSON.stringify({ kind: 'clarify', inserts: [], text }); }
          await guardStream(context, output(), onUnit);
        }, onText: value => shown.push(value), isCurrent: () => true });
      expect(shown).toEqual(['Saan ka manggagaling?']);
      expect(result.localAi).toBe(false);
    });
  it.each([
    ['ask_origin', 'Saan ka manggagaling?'],
    ['ask_origin', 'Saan ka ngayon?'],
    ['ask_origin', 'What is your starting point?'],
    ['ask_origin', 'Where are you starting from?'],
    ['ask_destination', 'Saan tayo pupunta?'],
    ['ask_destination', 'Where are we heading?'],
    ['ask_destination', 'What is your destination?'],
  ] as const)('accepts natural wording for %s: %s', async (act, text) => {
    const shown: string[] = [];
    const result = await assistantReply({ context: conversationContext(act, 'Cubao', []), fallback: 'Fallback',
      generate: async (context, onUnit) => {
        async function* output() { yield JSON.stringify({ kind: 'clarify', inserts: [], text }); }
        await guardStream(context, output(), onUnit);
      }, onText: value => shown.push(value), isCurrent: () => true });
    expect(shown).toEqual([text]);
    expect(result.localAi).toBe(true);
  });
  it.each([
    ['ask_destination', 'Where are you coming from?'],
    ['ask_destination', 'Saan ka manggagaling?'],
    ['ask_origin', 'Where are you coming from? Where are we heading?'],
  ] as const)('rejects the wrong or both endpoints for %s: %s', async (act, text) => {
    const shown: string[] = [];
    await assistantReply({ context: conversationContext(act, 'Cubao', []), fallback: 'Correct missing-endpoint question',
      generate: async (context, onUnit) => {
        async function* output() { yield JSON.stringify({ kind: 'clarify', inserts: [], text }); }
        await guardStream(context, output(), onUnit);
      }, onText: value => shown.push(value), isCurrent: () => true });
    expect(shown).toEqual(['Correct missing-endpoint question']);
  });
  it('allows asking for a station or mall as a starting-point description', async () => {
    const shown: string[] = [];
    await assistantReply({ context: conversationContext('ask_origin', 'SM North EDSA', []), fallback: 'Fallback',
      generate: async (context, onUnit) => {
        async function* output() { yield JSON.stringify({ kind: 'clarify', inserts: [], text: 'Where are you coming from? You can tell me a station, a mall, or a landmark.' }); }
        await guardStream(context, output(), onUnit);
      }, onText: text => shown.push(text), isCurrent: () => true });
    expect(shown).toEqual(['Where are you coming from? You can tell me a station, a mall, or a landmark.']);
  });
  it('allows conversational walk-through phrasing while still rejecting invented walking directions', async () => {
    const shown: string[] = [];
    await assistantReply({ context: grounding(), fallback: 'Fallback',
      generate: async (context, onUnit) => {
        async function* output() {
          yield JSON.stringify({ kind: 'step', inserts: ['f1'], text: 'Let me walk you through it.' }) + '\n';
          yield JSON.stringify({ kind: 'summary', inserts: ['f1'], text: 'Walk you through the plan: walk to Imaginary Station.' }) + '\n';
        }
        await guardStream(context, output(), onUnit);
      }, onText: text => shown.push(text), isCurrent: () => true });
    expect(shown.join('')).toContain('Let me walk you through it.');
    expect(shown.join('')).not.toContain('Imaginary');
  });
});
