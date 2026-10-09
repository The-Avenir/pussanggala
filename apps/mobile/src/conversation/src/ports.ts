/**
 * T32 — Ports the conversation manager depends on.
 *
 * ============================================================================
 * WIRING NOTES
 *  - `IntentParserPort` is satisfied today by `RuleIntentParser`, which wraps
 *    core `parse(query, trip)`. The production adapter (T30) must keep the
 *    same contract: deterministic core rules FIRST, and the local model only
 *    for journey-related utterances — `unrelated` must be decided without an
 *    inference call (BUILD §5). The signature is async so a model fallback can
 *    drop in without changing the manager.
 *  - `TripEvidencePort` is satisfied by core's `resolve` (slot resolution) and
 *    the `route` -> `rank` -> `compose` -> `buildContext` pipeline (T21–T24)
 *    plus the T25 follow-up helpers (`answerHours`, alternatives). Every call
 *    must return FRESH evidence for the given `TripState`; nothing may be
 *    answered from the conversation window.
 * ============================================================================
 */
import type {
  Card,
  EvidenceBundle,
  FailureReason,
  HourStatement,
  Intent,
  ReplanReason,
  ResolvedSlots,
  TripState,
} from "@pusang-gala/core";
import type { FollowUpTopic, TripEndpoints } from "./types";

/**
 * Deterministic intent extraction port. Core rules must classify the common
 * cases offline and cheaply: the manager calls this on every utterance,
 * including chit-chat. Parsers never invent place IDs, fares or route legs
 * (PRD-F1 acceptance); they only structure what the user said against the
 * current `TripState`.
 */
export interface IntentParserPort {
  parse(utterance: string, trip: TripState): Promise<Intent>;
}

/** Slot resolution request: the mentions on `intent`, read against the pack. */
export interface ResolveSlotsRequest {
  intent: Intent;
  trip: TripState;
}

/**
 * Failure reasons the manager can surface, drawn from core `FailureReason`.
 * `ambiguous_place` is absent on purpose: ambiguity is a clarification, not a
 * failure (INV-6).
 */
export type PlanFailureReason = Extract<
  FailureReason,
  | "outside_ncr"
  | "unsupported_place"
  | "no_trip_context"
  | "same_place"
  | "no_origin_access"
  | "no_destination_access"
  | "no_route"
  | "needs_replan"
>;

/** Outcome of a fresh planning request for a fully-specified trip. */
export type PlanOutcome =
  | {
      kind: "planned";
      /** Trip with the chosen itinerary selected (core `selectItinerary`). */
      trip: TripState;
      endpoints: TripEndpoints;
      evidence: EvidenceBundle;
    }
  | {
      kind: "failed";
      reason: PlanFailureReason;
      /** Pack-named place the failure is about, when the reason is place-scoped. */
      place?: string;
      /** Detail when `reason` is `needs_replan` (T25 pack-change behaviour). */
      replan?: ReplanReason;
    };

/** Journey-specific follow-up evidence request. */
export interface FollowUpRequest {
  topic: FollowUpTopic;
  /** Current structured trip state; the port derives fresh evidence from it. */
  trip: TripState;
}

/**
 * Outcomes of a follow-up query.
 *  - `answer`: fresh cards (and hour statements for `ask_hours`). Missing
 *    values stay explicit on the cards, never fabricated (INV-5).
 *  - `replanned`: `alternatives` reran directed routing and selected another
 *    itinerary; the manager adopts the returned trip and bundle.
 *  - `failed`: the OLD trip stays in effect, except for `needs_replan`, which
 *    means the trip's record IDs no longer validate against the installed pack.
 */
export type FollowUpOutcome =
  | {
      kind: "answer";
      topic: FollowUpTopic;
      cards: readonly Card[];
      hourStatements: readonly HourStatement[];
    }
  | {
      kind: "replanned";
      trip: TripState;
      endpoints: TripEndpoints;
      evidence: EvidenceBundle;
    }
  | { kind: "failed"; reason: PlanFailureReason };

/**
 * Fresh-evidence port. The ONLY source of factual content in the
 * conversation. The manager relays its cards verbatim; it never synthesizes
 * factual text itself and never answers a follow-up from the exchange window.
 */
export interface TripEvidencePort {
  /** Resolve the intent's place mentions. Feeds core `applyIntent`. */
  resolveSlots(request: ResolveSlotsRequest): Promise<ResolvedSlots>;
  /** Fresh route + rank + compose + buildContext for the given trip. */
  plan(trip: TripState): Promise<PlanOutcome>;
  /** Fresh follow-up evidence for the given trip. */
  followUp(request: FollowUpRequest): Promise<FollowUpOutcome>;
}
