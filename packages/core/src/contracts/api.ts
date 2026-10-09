import type { PlaceCandidate } from "./intent";

export type ResolveResult =
  | {
      status: "resolved";
      placeId: string;
      match: "exact" | "fuzzy" | "trip_ref" | "id";
    }
  | { status: "needs_clarification"; candidates: PlaceCandidate[] }
  | {
      status: "unsupported";
      reason: "unsupported_place" | "no_trip_context" | "ncr_unresolved";
      suggestions: PlaceCandidate[];
    }
  | { status: "outside_ncr"; placeId: string; name: string };

export type ReplanReason =
  | "schema_changed"
  | "invalid_route_json"
  | "record_missing"
  | "record_ineligible"
  | "service_suspended"
  | "continuity_broken"
  | "endpoint_mismatch"
  | "step_out_of_bounds";
