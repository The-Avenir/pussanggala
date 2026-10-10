import type { GroundingContext, SafeUnitHandler } from '@pusang-gala/ai';
import { AiRuntimeError } from '@pusang-gala/ai';
import { renderGroundedRouteUnit } from './explanationContext';

/** A grammatical question can still ask for the endpoint already supplied. */
function asksForEndpoint(text: string, act: 'ask_origin' | 'ask_destination'): boolean {
  const questions = text.split('?').slice(0, -1);
  const origin = /\b(?:coming|starting|travelling|traveling|departing)\s+from\b|\bwhere\b[^?]*\b(?:from|located|starting|start)\b|\b(?:your|the)\s+(?:starting (?:point|location|landmark|station)|origin|current (?:location|area))\b|\bsaan\b[^?]*\b(?:galing|manggagaling|nanggagaling|nasa|ka ngayon)\b/i;
  const destination = /\bwhere\b[^?]*\b(?:heading|headed|going|go|destination)\b|\b(?:your|the)\s+destination\b|\bsaan\b[^?]*\b(?:pupunta|papunta|punta)\b/i;
  const wanted = act === 'ask_origin' ? origin : destination;
  const other = act === 'ask_origin' ? destination : origin;
  return questions.some(question => wanted.test(question)) && !questions.some(question => other.test(question));
}

/** Use generated conversation first and recover with a grounded, readable reply. */
export async function assistantReply(options: {
  context: GroundingContext | null;
  fallback: string;
  opening?: string;
  generate?: (context: GroundingContext, onUnit: SafeUnitHandler) => Promise<void>;
  onText: (text: string) => void;
  isCurrent: () => boolean;
}): Promise<{ localAi: boolean; aiNotice?: string }> {
  const { context, fallback, generate, onText, isCurrent } = options;
  if (!context || !generate) {
    if (isCurrent()) onText(fallback);
    return { localAi: false, ...(context?.statements.length ? { aiNotice: 'The local assistant is unavailable. Here are the directions.' } : {}) };
  }
  let emitted = 0;
  const cited = new Set<string>();
  try {
    await generate(context, unit => {
      if (!isCurrent()) return;
      const act = context.trip?.dialogueAct;
      if ((act === 'ask_origin' || act === 'ask_destination') && !asksForEndpoint(unit.text, act)) return;
      const text = renderGroundedRouteUnit(unit, context);
      if (!text) return;
      for (const id of unit.inserts ?? []) cited.add(id);
      onText((emitted ? '\n\n' : options.opening ? options.opening + ' ' : '') + text);
      emitted += 1;
    });
    if (!emitted || context.statements.some(statement => statement.role === 'step' && !cited.has(statement.id))) {
      throw new Error('The explanation did not cover the route steps.');
    }
    return { localAi: true };
  } catch (error) {
    const stopped = error instanceof AiRuntimeError && error.kind === 'cancelled';
    if (isCurrent() && !stopped) onText((emitted ? '\n\n' : '') + fallback);
    return { localAi: emitted > 0,
      ...(stopped ? { aiNotice: 'Reply stopped.' } : context.statements.length ? { aiNotice: 'I couldn’t finish the explanation. Here are the directions.' } : {}) };
  }
}
