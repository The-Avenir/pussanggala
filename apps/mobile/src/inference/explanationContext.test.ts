import { describe, expect, it } from 'vitest';
import { buildGroundingContext, guardStream } from '@pusang-gala/ai';
import { explanationGrammar } from './explanationGrammar';
import { renderGroundedRouteUnit } from './explanationContext';
import { conversationContext } from './conversationContext';

function context() {
  const result = buildGroundingContext({ cards: [{ cardId: 'c1', title: 'Synthetic ride', packRecordIds: ['lg_synthetic'] }],
    statements: [{ id: 'f1', role: 'step', stepOrder: 1, text: 'Sakay ng jeep mula Lantern papuntang Copper.', packRecordIds: ['lg_synthetic'] }] });
  if (!result.ok) throw new Error(result.reason);
  return result.context;
}

describe('conversational grounded explanations', () => {
  it('lets the model choose prose instead of forcing one sentence in the grammar', () => {
    const grammar = explanationGrammar(context());
    expect(grammar).not.toContain('Here are the reported details.');
    expect(grammar).toContain('text-char');
    expect(grammar).toContain('f1');
  });
  it('requires the retrieved steps in the first route unit while leaving prose free', () => {
    const grounding = context();
    grounding.budgets.connectiveTextOnly = true;
    const grammar = explanationGrammar(grounding);
    expect(grammar).toContain('root ::= route-unit');
    expect(grammar).toContain('route-unit ::=');
    expect(grammar).toContain(JSON.stringify('["f1"]'));
    expect(grammar).toContain('text-char');
    expect(grammar).not.toContain('Sige, simulan natin dito.');
  });
  it('displays validated conversational wording alongside the cited direction', async () => {
    const grounding = context();
    async function* output() {
      yield JSON.stringify({ kind: 'step', inserts: ['f1'], text: 'Sige, simulan natin dito.' });
    }
    const displayed: string[] = [];
    await guardStream(grounding, output(), unit => displayed.push(renderGroundedRouteUnit(unit, grounding)));
    expect(displayed).toEqual(['Sige, simulan natin dito. Sakay ng jeep mula Lantern papuntang Copper.']);
  });
  it('supports a natural greeting without inventing canonical route facts', async () => {
    const grounding = conversationContext('greeting', 'Hello!', []);
    const grammar = explanationGrammar(grounding);
    expect(grammar).not.toContain('ref ::=');
    expect(grammar).not.toContain('"step"');
    async function* output() { yield JSON.stringify({ kind: 'summary', inserts: [], text: 'Hi, traveler! Where are we heading today?' }); }
    const shown: string[] = [];
    await guardStream(grounding, output(), unit => shown.push(renderGroundedRouteUnit(unit, grounding)));
    expect(shown).toEqual(['Hi, traveler! Where are we heading today?']);
  });
});
