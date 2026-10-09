/**
 * Minimal core-shaped fixtures for the conversation tests.
 *
 * These stand in for what the T21–T24 pipeline produces. They are deliberately
 * tiny: the manager only relays cards, so the tests care about identity
 * (card/record IDs) rather than content.
 */
import { unknown } from "@pusang-gala/core";
import type {
  Card,
  EvidenceBundle,
  ItineraryRef,
  PlaceCandidate,
  PointView,
  Preference,
  ResolveResult,
  ResolvedSlots,
  TripState,
} from "@pusang-gala/core";
import type { TripEndpoints } from "../../src/types";

export const PACK_ID = "pack_ncr_test";
export const SCHEMA_VERSION = 1;

export function baseTrip(preference: Preference = "balanced"): TripState {
  return { packId: PACK_ID, schemaVersion: SCHEMA_VERSION, preference, currentStep: 0 };
}

export function place(placeId: string, name: string, area: string): PlaceCandidate {
  return { placeId, name, area, kind: "landmark" };
}

export const CUBAO = place("plc_qc_cubao", "Araneta Center-Cubao", "Quezon City");
export const BUENDIA = place("plc_mak_buendia", "Buendia", "Makati");
export const ORTIGAS = place("plc_psg_ortigas", "Ortigas Center", "Pasig");
export const QUIAPO = place("plc_mnl_quiapo", "Quiapo", "Manila");
export const FARMERS = place("plc_qc_farmers", "Cubao Farmers Plaza", "Quezon City");
export const ALI = place("plc_qc_ali", "Ali Mall", "Quezon City");

export function endpoints(origin: PlaceCandidate, destination: PlaceCandidate): TripEndpoints {
  return { origin, destination };
}

export function resolvedSlot(candidate: PlaceCandidate): ResolveResult {
  return { status: "resolved", placeId: candidate.placeId, match: "exact" };
}

export function ambiguousSlot(candidates: readonly PlaceCandidate[]): ResolveResult {
  return { status: "needs_clarification", candidates: [...candidates] };
}

export function slots(origin?: ResolveResult, destination?: ResolveResult): ResolvedSlots {
  return {
    ...(origin ? { origin } : {}),
    ...(destination ? { destination } : {}),
  };
}

function point(name: string): PointView {
  return { name, mapped: true };
}

export function rideCard(id: string): Card {
  return {
    cardId: `card_${id}`,
    kind: "ride",
    routeId: `rte_${id}`,
    mode: "jeepney",
    directionLabel: "southbound",
    board: point("Cubao terminal"),
    alight: point("Buendia corner"),
    rideMinutes: unknown<number>(),
    fares: [],
    hours: [],
    notes: [],
    recordIds: [`rte_${id}`],
    warnings: [],
    sources: [],
  };
}

function itineraryRef(id: string): ItineraryRef {
  return { v: 1, steps: [{ kind: "leg", id: `lg_${id}` }] };
}

/** A trip state as the evidence port would hand it back: endpoints + selection. */
export function selectedTrip(
  trip: TripState,
  origin: PlaceCandidate,
  destination: PlaceCandidate,
  itineraryId: string,
): TripState {
  return {
    ...trip,
    originPlaceId: origin.placeId,
    destinationPlaceId: destination.placeId,
    selected: itineraryRef(itineraryId),
    currentStep: 0,
  };
}

export function bundle(id: string, trip: TripState, alternativeCount = 1): EvidenceBundle {
  return {
    v: 1,
    packId: trip.packId,
    trip,
    cards: [rideCard(id)],
    alternatives: Array.from({ length: alternativeCount }, (_, i) => ({
      id: `itin_${id}_alt${i}`,
      rideCount: 1,
      transferCount: 0,
      fare: { status: "unknown" as const, missingLegIds: [] },
      reportedRideMinutes: unknown<number>(),
    })),
    comparisons: [],
    hourStatements: [],
    notes: [],
    allowedCardIds: [`card_${id}`],
    allowedRecordIds: [`rte_${id}`],
  };
}
