import { EVIDENCE_BOUNDS, type Card, type EvidenceBundle, type HourStatement, type NoteView } from "../contracts/cards";
import type { TripState } from "../contracts/intent";
import type { ComparisonStatement, Itinerary } from "../contracts/routing";
import type { Pack } from "../pack/types";
import { noteView } from "../cards/sources";

export interface ContextInput {
  trip: TripState;
  cards: Card[];
  itineraries: Itinerary[];
  comparisons: ComparisonStatement[];
  hourStatements: HourStatement[];
  now: Date;
}

export function buildContext(input: ContextInput, pack: Pack): EvidenceBundle {
  const cards = input.cards.slice(0, EVIDENCE_BOUNDS.maxCards);
  const selectedId = cards[0]?.cardId.split("#")[0];
  const alternatives = input.itineraries.filter((itinerary) => itinerary.id !== selectedId).slice(0, EVIDENCE_BOUNDS.maxAlternatives);
  const includedIds = new Set(alternatives.map((itinerary) => itinerary.id));
  if (selectedId !== undefined) includedIds.add(selectedId);
  const includedItineraries = input.itineraries.filter((itinerary) => includedIds.has(itinerary.id));
  const notes = new Map<string, NoteView>();
  const stops = new Set<string>();
  for (const card of cards) {
    if (card.kind !== "access") {
      for (const note of card.notes) {
        if (!notes.has(note.noteId)) notes.set(note.noteId, noteView(pack, note.noteId, input.now));
      }
    }
    const points = card.kind === "access" ? [card.stop] : card.kind === "ride" ? [card.board, card.alight] : [card.from, card.to];
    for (const point of points) {
      if (point.stopId !== undefined) stops.add(point.stopId);
    }
  }
  const extraIds = [...new Set([...stops].flatMap((stopId) => pack.noteIdsByStop.get(stopId) ?? []))].filter((id) => !notes.has(id));
  const priority = { warning: 0, conflict: 1, tip: 2 } as const;
  extraIds.sort((a, b) => priority[pack.notes.get(a)!.kind] - priority[pack.notes.get(b)!.kind] || (a < b ? -1 : a > b ? 1 : 0));
  for (const id of extraIds) notes.set(id, noteView(pack, id, input.now));
  const includedNotes = [...notes.values()].slice(0, EVIDENCE_BOUNDS.maxNotes);
  const allowedRecordIds = [...new Set([
    ...cards.flatMap((card) => card.recordIds),
    ...includedItineraries.flatMap((itinerary) => itinerary.recordIds),
    ...input.hourStatements.flatMap((statement) => [statement.routeId, ...statement.reports.map((report) => report.hoursId)]),
    ...includedNotes.map((note) => note.noteId),
  ])].sort();
  return {
    v: 1, packId: pack.manifest.pack_id, trip: input.trip, cards,
    alternatives: alternatives.map(({ id, rideCount, transferCount, fare, reportedRideMinutes }) => ({ id, rideCount, transferCount, fare, reportedRideMinutes })),
    comparisons: input.comparisons.filter((statement) => includedIds.has(statement.winnerId) && statement.comparedIds.every((id) => includedIds.has(id))),
    hourStatements: input.hourStatements, notes: includedNotes, allowedCardIds: cards.map((card) => card.cardId), allowedRecordIds,
  };
}
