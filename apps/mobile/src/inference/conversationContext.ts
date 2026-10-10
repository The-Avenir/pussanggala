import { DEFAULT_BUDGETS } from '@pusang-gala/ai';
import type { GroundingContext, TripContextPort } from '@pusang-gala/ai';

/** Conversation questions need no invented route records or synthetic citations. */
export function conversationContext(dialogueAct: NonNullable<TripContextPort['dialogueAct']>, question: string,
  recentMessages: NonNullable<TripContextPort['recentMessages']>,
  endpoints: Pick<TripContextPort, 'originLabel' | 'destinationLabel'> = {}): GroundingContext {
  return { cards: [], statements: [], trip: { question, dialogueAct, recentMessages, ...endpoints },
    budgets: { ...DEFAULT_BUDGETS, maxUnits: 1, connectiveTextOnly: true } };
}
