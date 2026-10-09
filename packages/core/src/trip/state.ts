import type { ResolveResult } from "../contracts/api";
import type { Intent, Preference, TripState } from "../contracts/intent";
import type { Itinerary } from "../contracts/routing";
import type { Pack } from "../pack/types";

export interface ResolvedSlots {
  origin?: ResolveResult;
  destination?: ResolveResult;
}

export function newTrip(pack: Pack, preference: Preference = "balanced"): TripState {
  return { packId: pack.manifest.pack_id, schemaVersion: pack.manifest.schema_version, preference, currentStep: 0 };
}

export function applyIntent(trip: TripState, intent: Intent, resolved: ResolvedSlots): TripState {
  const next: TripState = intent.kind === "new_trip"
    ? { packId: trip.packId, schemaVersion: trip.schemaVersion, preference: intent.preference ?? "balanced", currentStep: 0 }
    : { ...trip };
  const clearSelection = () => { delete next.selected; next.currentStep = 0; };
  const applySlots = (slots: ("origin" | "destination")[]) => {
    let clarificationSet = false;
    for (const slot of slots) {
      const result = resolved[slot];
      if (result?.status === "resolved") {
        next[slot === "origin" ? "originPlaceId" : "destinationPlaceId"] = result.placeId;
        if (next.pendingClarification?.slot === slot) delete next.pendingClarification;
      } else if (result?.status === "needs_clarification" && !clarificationSet) {
        const mention = intent[slot];
        next.pendingClarification = { slot, text: mention?.kind === "text" ? mention.text : "", candidates: result.candidates };
        clarificationSet = true;
      }
    }
  };
  switch (intent.kind) {
    case "new_trip": applySlots(["origin", "destination"]); break;
    case "change_origin": applySlots(["origin"]); clearSelection(); break;
    case "change_destination": applySlots(["destination"]); clearSelection(); break;
    case "change_preference":
      if (intent.preference !== undefined) next.preference = intent.preference;
      clearSelection();
      break;
    case "reverse": {
      delete next.originPlaceId;
      delete next.destinationPlaceId;
      if (trip.destinationPlaceId !== undefined) next.originPlaceId = trip.destinationPlaceId;
      if (trip.originPlaceId !== undefined) next.destinationPlaceId = trip.originPlaceId;
      clearSelection();
      delete next.pendingClarification;
      break;
    }
    case "clarify_answer": {
      const pending = next.pendingClarification;
      const candidate = intent.choiceIndex === undefined ? undefined : pending?.candidates[intent.choiceIndex];
      if (pending && candidate) {
        next[pending.slot === "origin" ? "originPlaceId" : "destinationPlaceId"] = candidate.placeId;
        delete next.pendingClarification;
        clearSelection();
      }
      break;
    }
  }
  return next;
}

export function selectItinerary(trip: TripState, itinerary: Itinerary): TripState {
  return { ...trip, selected: itinerary.ref, currentStep: 0 };
}

export function advanceStep(trip: TripState): TripState {
  return trip.selected ? { ...trip, currentStep: Math.min(trip.currentStep + 1, trip.selected.steps.length - 1) } : { ...trip };
}
