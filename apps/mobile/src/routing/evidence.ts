import { answerHours, buildContext, compose, newTrip, resolve, route, selectItinerary, validateRestoration } from '@pusang-gala/core';
import type { Pack, PlaceCandidate, TripState } from '@pusang-gala/core';
import { TripConversationManager } from '@pusang-gala/conversation';
import type { PlanOutcome, TripEvidencePort } from '@pusang-gala/conversation';
import { parseConversationQuery } from './conversationQuery';

export function createEvidencePort(pack: Pack, now: () => Date = () => new Date()): TripEvidencePort {
  function endpoint(id: string): PlaceCandidate {
    const row = pack.places.get(id)!;
    return { placeId: id, name: row.name, area: row.area, kind: row.kind };
  }
  function plan(trip: TripState): PlanOutcome {
    if (!trip.originPlaceId || !trip.destinationPlaceId) return { kind: 'failed', reason: 'no_trip_context' };
    const result = route(trip.originPlaceId, trip.destinationPlaceId, trip.preference, pack);
    if (result.status !== 'ok') return { kind: 'failed', reason: result.reason };
    const chosen = result.itineraries[0];
    if (!chosen) return { kind: 'failed', reason: 'no_route' };
    const selected = selectItinerary(trip, chosen);
    const date = now();
    return { kind: 'planned', trip: selected,
      endpoints: { origin: endpoint(chosen.originPlaceId), destination: endpoint(chosen.destinationPlaceId) },
      evidence: buildContext({ trip: selected, cards: compose(chosen, pack, date), itineraries: result.itineraries,
        comparisons: result.comparisons, hourStatements: [], now: date }, pack) };
  }
  return {
    async resolveSlots({ intent, trip }) {
      return { ...(intent.origin ? { origin: resolve(intent.origin, pack, trip) } : {}),
        ...(intent.destination ? { destination: resolve(intent.destination, pack, trip) } : {}) };
    },
    async plan(trip) { return plan(trip); },
    async followUp({ topic, trip }) {
      if (topic === 'alternatives') {
        const result = plan(trip);
        return result.kind === 'planned' ? { ...result, kind: 'replanned' } : result;
      }
      if (!trip.selected || !trip.originPlaceId || !trip.destinationPlaceId) return { kind: 'failed', reason: 'no_trip_context' };
      const restored = validateRestoration({ packId: trip.packId, schemaVersion: trip.schemaVersion,
        originPlaceId: trip.originPlaceId, destinationPlaceId: trip.destinationPlaceId, preference: trip.preference,
        routeJson: JSON.stringify(trip.selected), currentStep: trip.currentStep }, pack);
      if (restored.status !== 'valid') return { kind: 'failed', reason: 'needs_replan' };
      const date = now();
      const cards = compose(restored.itinerary, pack, date);
      return { kind: 'answer', topic, cards,
        hourStatements: topic === 'ask_hours' ? answerHours(restored.itinerary.routeIds, pack, date) : [] };
    },
  };
}

export function createRouteConversation(pack: Pack): TripConversationManager {
  return new TripConversationManager({ trip: newTrip(pack), evidence: createEvidencePort(pack),
    parser: { async parse(utterance, trip) { return parseConversationQuery(utterance, trip, pack); } } });
}
