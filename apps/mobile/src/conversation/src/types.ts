/**
 * T32 — Current-trip conversation manager: shared types.
 *
 * Everything structural comes from `@pusang-gala/core`. This module adds only
 * the conversation-layer concepts core does not own: the phase label, the
 * bounded exchange window, and the follow-up subset of `IntentKind`.
 */
import type {
  Clarification,
  Intent,
  IntentKind,
  PlaceCandidate,
  Preference,
  TripState,
} from "@pusang-gala/core";

export type {
  Clarification,
  Intent,
  IntentKind,
  PlaceCandidate,
  Preference,
  TripState,
};

/** Conversation manager phases: idle -> clarifying -> active trip. */
export type ConversationPhase = "idle" | "clarifying" | "active";

/**
 * Journey-specific follow-up topics (PRD-F19/F20). A strict subset of core
 * `IntentKind`: `reverse` is excluded because core `applyIntent` performs the
 * swap itself, so the manager re-plans instead of asking for follow-up
 * evidence.
 */
export const FOLLOW_UP_TOPICS = [
  "alternatives",
  "ask_boarding",
  "ask_fare",
  "ask_transfer",
  "ask_hours",
] as const satisfies readonly IntentKind[];

export type FollowUpTopic = (typeof FOLLOW_UP_TOPICS)[number];

export function isFollowUpTopic(kind: IntentKind): kind is FollowUpTopic {
  return (FOLLOW_UP_TOPICS as readonly IntentKind[]).includes(kind);
}

/** The two confirmed endpoints of the current trip, as named by the pack. */
export interface TripEndpoints {
  origin: PlaceCandidate;
  destination: PlaceCandidate;
}

/**
 * One user/assistant exchange. Kept only in the bounded in-memory window
 * (SDD §1.4). NEVER persisted: there is no serialization path (INV-3).
 */
export interface Exchange {
  role: "user" | "assistant";
  text: string;
}

/** Read-only view of manager state for UI/tests. */
export interface ConversationState {
  phase: ConversationPhase;
  /** Core-owned structured trip state; the only durable conversation identity. */
  trip: TripState;
  /** Pack-named endpoints of the planned trip, or null before planning. */
  endpoints: TripEndpoints | null;
  /** Bounded in-memory exchange window; oldest entries drop off. */
  history: readonly Exchange[];
}
