import { parse, resolve } from '@pusang-gala/core';
import type { Intent, Pack, TripState } from '@pusang-gala/core';

export const isDurationQuestion = (query: string): boolean => /how long|travel time|walk time|walking time|ride time|gaano katagal|tagal ng|ilang minuto/i.test(query);

/** Recognize short answers to Gaile's endpoint questions against installed places. */
export function parseConversationQuery(query: string, trip: TripState, pack: Pack): Intent {
  const intent = parse(query, trip);
  if (intent.kind !== 'unrelated') return intent;
  if (trip.pendingClarification) {
    const text = query.trim().replace(/^(?:yung|ung|the)\s+/i, '').replace(/(?:\s+(?:po|please|pls))?[.!?]*$/i, '').trim();
    if (!text) return intent;
    const match = resolve({ kind: 'text', text, span: [query.indexOf(text), query.indexOf(text) + text.length] }, pack, trip);
    // An alias is a selection only when it resolves uniquely to a displayed choice.
    if (match.status === 'resolved') {
      const choiceIndex = trip.pendingClarification.candidates.findIndex(candidate => candidate.placeId === match.placeId);
      if (choiceIndex >= 0) return { kind: 'clarify_answer', choiceIndex, source: 'rules' };
    }
    return intent;
  }
  if (isDurationQuestion(query) || /^(?:tell me (?:this|the) route|explain (?:this|the) route|walk me through (?:it|the route))\s*[.!?]*$/i.test(query.trim())) {
    return { kind: 'ask_transfer', source: 'rules' };
  }
  const text = query.trim().replace(/^(?:i['’]?m (?:at|in|near)|i am (?:at|in|near)|nasa|nandito (?:ako )?sa|heading to|i want to go to)\s+/i, '')
    .replace(/(?:\s+(?:please|po|pls))?[.!?]*$/i, '').trim();
  if (!text) return intent;
  const mention = { kind: 'text' as const, text, span: [query.indexOf(text), query.indexOf(text) + text.length] as [number, number] };
  const match = resolve(mention, pack, trip);
  if (match.status === 'unsupported') return intent;
  if (/^(?:i['’]?m (?:at|in|near)|i am (?:at|in|near)|nasa|nandito (?:ako )?sa)\s+/i.test(query.trim())) {
    return { kind: 'change_origin', origin: mention, source: 'rules' };
  }
  if (trip.destinationPlaceId && !trip.originPlaceId) return { kind: 'change_origin', origin: mention, source: 'rules' };
  if (trip.originPlaceId || trip.destinationPlaceId) return { kind: 'change_destination', destination: mention, source: 'rules' };
  return { kind: 'new_trip', destination: mention, source: 'rules' };
}
