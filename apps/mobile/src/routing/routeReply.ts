import type { Pack, TripState } from '@pusang-gala/core';
import type { TurnResult } from '@pusang-gala/conversation';
import { isDurationQuestion } from './conversationQuery';
import { durationText, fareText, hoursText, isTaglish, isVisibleStep, stepText } from './routePresentation';

/** A human-readable recovery reply when local generation is unavailable. */
export function routeReply(result: TurnResult, query: string, trip?: TripState, pack?: Pack): string {
  const taglish = isTaglish(query);
  if (result.type === 'clarification') return taglish
    ? `May ilang lugar na “${result.clarification.text}”. Alin dito ang tinutukoy mo?`
    : `I found a few places matching “${result.clarification.text}”. Which one do you mean?`;
  if (result.type === 'needsTrip') {
    const origin = trip?.originPlaceId ? pack?.places.get(trip.originPlaceId)?.name : undefined;
    const destination = trip?.destinationPlaceId ? pack?.places.get(trip.destinationPlaceId)?.name : undefined;
    if (destination && !origin) return taglish ? `${destination}—got it! Saan ka manggagaling? Kahit station, mall, o landmark malapit sa iyo.`
      : `${destination}—got it! Where are you coming from? A station, mall, landmark, or nearby area is fine.`;
    if (origin && !destination) return taglish ? `Sa ${origin} ka manggagaling. Saan tayo pupunta?`
      : `Starting from ${origin}—got it. Where are we heading?`;
    return taglish ? 'Saan tayo pupunta? Sabihin mo ang destination, tapos tulungan kitang hanapin ang ruta.'
      : 'Where are we heading? Tell me your destination, and I’ll help you figure out how to get there.';
  }
  if (result.type === 'redirect') return taglish ? 'Tulungan kitang planuhin ang commute mo. Saan mo gustong pumunta?'
    : 'I can help you find your way around Metro Manila. Where would you like to go?';
  if (result.type === 'reset') return taglish ? 'Sige, bagong biyahe tayo. Saan tayo pupunta?' : 'Let’s start fresh. Where are we heading?';
  if (result.type === 'failure') {
    switch (result.reason) {
      case 'same_place': return 'You’re already starting at that destination. Did you mean a different place?';
      case 'outside_ncr': return 'That journey goes outside Metro Manila. I can help with the part within NCR—what landmark would you like to use?';
      case 'unsupported_place': return 'I couldn’t find that place yet. Is there a nearby mall, station, or landmark we can use?';
      case 'no_trip_context': return 'Let’s choose a destination first. Where are we heading?';
      case 'needs_replan': return 'The available routes have changed. Let’s check your starting point and destination again.';
      default: return 'I couldn’t find a complete route for that journey yet. Can we try a nearby landmark?';
    }
  }
  const cards = (result.type === 'plan' ? result.evidence.cards : result.cards).filter(isVisibleStep);
  const rides = cards.filter(card => card.kind === 'ride');
  if (result.type === 'followUp') {
    if (result.topic === 'ask_fare') return rides.map(card => fareText(card, taglish)).join('\n\n') || 'There’s no vehicle fare on this route.';
    if (result.topic === 'ask_hours') return result.hourStatements.map(hour => hoursText(hour, taglish)).join('\n\n') || 'I don’t have the operating hours yet.';
    if (isDurationQuestion(query)) return cards.map(card => durationText(card, taglish)).join('\n\n');
    if (result.topic === 'ask_boarding') return rides.map(card => stepText(card, taglish, true)).join('\n\n');
    if (/bababa|\bbaba\b|get off|alight/i.test(query)) return rides.map(card => stepText(card, taglish, false, true)).join('\n\n');
  }
  const lead = result.type === 'plan' ? taglish
    ? `Sige! Mula ${result.endpoints.origin.name} papuntang ${result.endpoints.destination.name}. Ganito ang biyahe natin:`
    : `Got it! We’re going from ${result.endpoints.origin.name} to ${result.endpoints.destination.name}. Here’s how to get there:`
    : taglish ? 'Tara, ganito ang biyahe natin:' : 'Let’s take it step by step:';
  return lead + '\n\n' + cards.map(card => stepText(card, taglish)).join('\n\n');
}
