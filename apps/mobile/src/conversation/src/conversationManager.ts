/**
 * T32 — Current-trip conversation manager.
 *
 * A trip-scoped state machine: idle -> clarifying -> active trip -> follow-ups.
 * All structured state transitions go through core `applyIntent`; the manager
 * only decides which intent to apply and when to ask the evidence port for
 * fresh facts.
 *
 * Guarantees (SDD §1.4, PRD-F19, BUILD §5):
 *  - Bounded in-memory context only (INV-3): a capped exchange window plus the
 *    core `TripState`. No persistence or serialization path.
 *  - New-trip reset: a `new_trip` intent (or an explicit action) clears the
 *    trip, any pending clarification and the exchange window.
 *  - Ambiguous places require explicit user confirmation (INV-6).
 *  - Endpoint/preference changes, reverses and follow-ups ALWAYS pull fresh
 *    evidence through `TripEvidencePort`; the manager never answers from
 *    history.
 *  - Unrelated requests get a brief deterministic redirect without calling the
 *    evidence port (and production wiring also skips the model).
 *  - Factual output is core `Card`s from the evidence port, relayed verbatim
 *    and pack-ID traceable (INV-1).
 */
import { applyIntent } from "@pusang-gala/core";
import type {
  Card,
  EvidenceBundle,
  HourStatement,
  PlaceMention,
  ResolveResult,
  ResolvedSlots,
} from "@pusang-gala/core";
import { clarificationPrompt, matchClarificationPick } from "./clarification";
import type {
  FollowUpOutcome,
  IntentParserPort,
  PlanFailureReason,
  TripEvidencePort,
} from "./ports";
import type {
  Clarification,
  ConversationPhase,
  ConversationState,
  Exchange,
  FollowUpTopic,
  Intent,
  Preference,
  TripEndpoints,
  TripState,
} from "./types";

/** Structured turn outcome for the UI layer (rendered directly, no model needed). */
export type TurnResult =
  | {
      type: "plan";
      message: string;
      trip: TripState;
      endpoints: TripEndpoints;
      evidence: EvidenceBundle;
    }
  | { type: "clarification"; message: string; clarification: Clarification }
  | {
      type: "followUp";
      message: string;
      topic: FollowUpTopic;
      cards: readonly Card[];
      hourStatements: readonly HourStatement[];
    }
  | { type: "failure"; message: string; reason: PlanFailureReason }
  | { type: "needsTrip"; message: string }
  | { type: "redirect"; message: string }
  | { type: "reset"; message: string };

export interface ConversationManagerOptions {
  parser: IntentParserPort;
  evidence: TripEvidencePort;
  /**
   * Starting trip state, normally from core `newTrip(pack, preference)`. Its
   * `packId`/`schemaVersion`/`preference` seed every later reset.
   */
  trip: TripState;
  /** Max retained user+assistant exchanges; oldest drop off. Default 8. */
  maxExchanges?: number;
}

export const DEFAULT_MAX_EXCHANGES = 8;

const PREFERENCE_LABEL: Readonly<Record<Preference, string>> = {
  balanced: "balanced",
  lowest_fare: "lowest fare",
  fewest_transfers: "fewest transfers",
  shortest_reported_time: "shortest reported time",
};

const TOPIC_LABEL: Readonly<Record<FollowUpTopic, string>> = {
  alternatives: "alternative routes",
  ask_boarding: "boarding point",
  ask_fare: "fare",
  ask_transfer: "transfer",
  ask_hours: "reported operating hours",
};

const REDIRECT_MESSAGE =
  "Gala lang tayo — I only help with NCR commute questions (routes, fares, transfers, hours, or your current trip).";

const NEEDS_TRIP_MESSAGE =
  'Set up a trip first: tell me where you\'re coming from and where you\'re going (e.g. "from Cubao to Buendia").';

const NEEDS_ORIGIN_MESSAGE = "Saan ka galing? I still need your starting point.";

const NEEDS_DESTINATION_MESSAGE = "Where to? I still need your destination.";

const RESET_MESSAGE = "New trip, meow! Previous context cleared. Where to and from where?";

const TRIP_ENDED_MESSAGE = "Trip ended. Context cleared.";

function mentionLabel(mention: PlaceMention | undefined): string | undefined {
  if (!mention) return undefined;
  if (mention.kind === "text") return mention.text;
  if (mention.kind === "place_id") return mention.placeId;
  return mention.ref;
}

/** Map a non-resolving slot onto the failure the user should hear about. */
function slotFailure(
  result: ResolveResult | undefined,
): { reason: PlanFailureReason; place?: string } | null {
  if (!result) return null;
  if (result.status === "outside_ncr") return { reason: "outside_ncr", place: result.name };
  if (result.status !== "unsupported") return null;
  return { reason: result.reason === "no_trip_context" ? "no_trip_context" : "unsupported_place" };
}

/** Pure TypeScript; no RN/native/persistence/network imports allowed here. */
export class TripConversationManager {
  private readonly parser: IntentParserPort;
  private readonly evidence: TripEvidencePort;
  private readonly maxExchanges: number;
  private readonly basePreference: Preference;

  private trip: TripState;
  private endpoints: TripEndpoints | null = null;
  private history: Exchange[] = [];

  constructor(options: ConversationManagerOptions) {
    this.parser = options.parser;
    this.evidence = options.evidence;
    this.maxExchanges = options.maxExchanges ?? DEFAULT_MAX_EXCHANGES;
    this.trip = options.trip;
    this.basePreference = options.trip.preference;
  }

  /** Handle one raw user utterance. */
  async handleUserMessage(utterance: string): Promise<TurnResult> {
    const text = utterance.trim();
    const result = text.length === 0 ? this.redirect() : await this.dispatch(text);
    if (result.type !== "reset") this.appendExchange(text, result.message);
    return result;
  }

  /** Explicit UI pick of a clarification candidate (INV-6 confirmation). */
  async handleClarificationPick(candidateIndex: number): Promise<TurnResult> {
    const pending = this.trip.pendingClarification;
    if (!pending) return this.needsTrip();
    const choice = pending.candidates[candidateIndex];
    if (!choice) return this.clarifyAgain();
    const result = await this.confirmCandidate(candidateIndex);
    this.appendExchange(`[picked ${candidateIndex + 1}] ${choice.name}`, result.message);
    return result;
  }

  /** Explicit new-trip action: clears all context (PRD-F19). */
  newTrip(): TurnResult {
    this.clearContext();
    return { type: "reset", message: RESET_MESSAGE };
  }

  /** Explicit end-trip action: clears trip and context. */
  endTrip(): TurnResult {
    this.clearContext();
    return { type: "reset", message: TRIP_ENDED_MESSAGE };
  }

  /** Read-only state snapshot. In-memory only; do not persist (INV-3). */
  getState(): Readonly<ConversationState> {
    return {
      phase: this.phase(),
      trip: this.trip,
      endpoints: this.endpoints,
      history: [...this.history],
    };
  }

  // ---- internal dispatch -------------------------------------------------

  private async dispatch(utterance: string): Promise<TurnResult> {
    const pending = this.trip.pendingClarification;
    if (pending) {
      // Deterministic pick first: ordinal or candidate name (INV-6).
      const pick = matchClarificationPick(utterance, pending.candidates);
      if (pick) return this.confirmCandidate(pick.index);
      const intent = await this.parser.parse(utterance, this.trip);
      if (intent.kind === "clarify_answer" && intent.choiceIndex !== undefined) {
        return this.confirmCandidate(intent.choiceIndex);
      }
      // A fresh new-trip request abandons the clarification; anything else
      // (follow-ups, chit-chat, unstructurable text) re-presents candidates.
      if (intent.kind === "new_trip") return this.applySlots(intent);
      return this.clarifyAgain();
    }

    const intent = await this.parser.parse(utterance, this.trip);
    switch (intent.kind) {
      case "new_trip":
      case "change_origin":
      case "change_destination":
        return this.applySlots(intent);
      case "change_preference":
        return this.changePreference(intent);
      case "reverse":
        return this.reverse(intent);
      case "alternatives":
      case "ask_boarding":
      case "ask_fare":
      case "ask_transfer":
      case "ask_hours":
        return this.followUp(intent.kind);
      case "clarify_answer":
        // Nothing is pending, so there is nothing to confirm.
        return this.needsTrip();
      case "unrelated":
        return this.redirect();
    }
  }

  /**
   * `new_trip` / `change_origin` / `change_destination`: resolve the mentioned
   * places, let core `applyIntent` fold them into the trip, then plan.
   */
  private async applySlots(intent: Intent): Promise<TurnResult> {
    let effective = intent;
    if (intent.kind === "new_trip") {
      // A bare `new_trip` (no places mentioned) is just an explicit restart.
      if (!intent.origin && !intent.destination) return this.newTrip();
      // New-trip reset happens BEFORE resolution so place references like
      // "from here" cannot read the abandoned trip (PRD-F19).
      effective = { ...intent, preference: intent.preference ?? this.basePreference };
      this.history = [];
      this.endpoints = null;
      this.trip = applyIntent(
        this.trip,
        { kind: "new_trip", preference: effective.preference, source: intent.source },
        {},
      );
    }
    const resolved = await this.resolveSlots(effective);
    const originFailure = slotFailure(resolved.origin);
    if (originFailure) {
      return this.failure(originFailure.reason, originFailure.place ?? mentionLabel(effective.origin));
    }
    const destinationFailure = slotFailure(resolved.destination);
    if (destinationFailure) {
      return this.failure(
        destinationFailure.reason,
        destinationFailure.place ?? mentionLabel(effective.destination),
      );
    }
    return this.continueAfterApply(applyIntent(this.trip, effective, resolved));
  }

  private async resolveSlots(intent: Intent): Promise<ResolvedSlots> {
    if (!intent.origin && !intent.destination) return {};
    return this.evidence.resolveSlots({ intent, trip: this.trip });
  }

  private async changePreference(intent: Intent): Promise<TurnResult> {
    return this.continueAfterApply(applyIntent(this.trip, intent, {}));
  }

  /** Core `applyIntent` swaps the endpoints; routing must then be rerun. */
  private async reverse(intent: Intent): Promise<TurnResult> {
    if (!this.endpoints) return this.needsTrip();
    return this.planTrip(applyIntent(this.trip, intent, {}), "Reverse trip");
  }

  private async confirmCandidate(choiceIndex: number): Promise<TurnResult> {
    const pending = this.trip.pendingClarification;
    if (!pending) return this.needsTrip();
    if (choiceIndex < 0 || choiceIndex >= pending.candidates.length) return this.clarifyAgain();
    return this.continueAfterApply(
      applyIntent(this.trip, { kind: "clarify_answer", choiceIndex, source: "rules" }, {}),
    );
  }

  /** Shared tail: clarify, ask for the missing endpoint, or plan. */
  private async continueAfterApply(next: TripState): Promise<TurnResult> {
    if (next.pendingClarification) {
      this.trip = next;
      this.endpoints = null;
      return this.clarification(next.pendingClarification);
    }
    if (next.originPlaceId === undefined || next.destinationPlaceId === undefined) {
      this.trip = next;
      this.endpoints = null;
      if (next.originPlaceId === undefined && next.destinationPlaceId === undefined) {
        return this.needsTrip();
      }
      return {
        type: "needsTrip",
        message:
          next.originPlaceId === undefined ? NEEDS_ORIGIN_MESSAGE : NEEDS_DESTINATION_MESSAGE,
      };
    }
    return this.planTrip(next, "Planned");
  }

  /** Fresh route + compose for `next`. A failure never corrupts a good trip. */
  private async planTrip(next: TripState, lead: string): Promise<TurnResult> {
    const fallback = this.endpoints === null ? null : { trip: this.trip, endpoints: this.endpoints };
    this.trip = next;
    this.endpoints = null;
    const outcome = await this.evidence.plan(next);
    if (outcome.kind === "failed") {
      if (fallback && outcome.reason !== "needs_replan") {
        this.trip = fallback.trip;
        this.endpoints = fallback.endpoints;
      }
      return this.failure(outcome.reason, outcome.place);
    }
    return this.adoptPlan(outcome.trip, outcome.endpoints, outcome.evidence, lead);
  }

  private async followUp(topic: FollowUpTopic): Promise<TurnResult> {
    if (!this.endpoints) return this.needsTrip();
    const outcome: FollowUpOutcome = await this.evidence.followUp({ topic, trip: this.trip });
    switch (outcome.kind) {
      case "answer":
        return {
          type: "followUp",
          topic,
          cards: outcome.cards,
          hourStatements: outcome.hourStatements,
          message: `Here is the latest ${TOPIC_LABEL[topic]} info from the pack:`,
        };
      case "replanned":
        return this.adoptPlan(
          outcome.trip,
          outcome.endpoints,
          outcome.evidence,
          "Alternatives refreshed",
        );
      case "failed":
        // The pack moved under us: drop the trip but keep the window intact.
        if (outcome.reason === "needs_replan") this.resetTrip();
        return this.failure(outcome.reason);
    }
  }

  // ---- helpers -----------------------------------------------------------

  private adoptPlan(
    trip: TripState,
    endpoints: TripEndpoints,
    evidence: EvidenceBundle,
    lead: string,
  ): TurnResult {
    this.trip = trip;
    this.endpoints = endpoints;
    return {
      type: "plan",
      message:
        `${lead}: ${endpoints.origin.name} → ${endpoints.destination.name} ` +
        `(${PREFERENCE_LABEL[trip.preference]}, ${evidence.alternatives.length} alternative(s)). ` +
        `Cards attached.`,
      trip,
      endpoints,
      evidence,
    };
  }

  private phase(): ConversationPhase {
    if (this.trip.pendingClarification) return "clarifying";
    return this.endpoints ? "active" : "idle";
  }

  private resetTrip(): void {
    this.trip = applyIntent(
      this.trip,
      { kind: "new_trip", preference: this.basePreference, source: "rules" },
      {},
    );
    this.endpoints = null;
  }

  private clearContext(): void {
    this.resetTrip();
    this.history = [];
  }

  private appendExchange(userText: string, assistantText: string): void {
    this.history.push(
      { role: "user", text: userText },
      { role: "assistant", text: assistantText },
    );
    const overflow = this.history.length - this.maxExchanges * 2;
    if (overflow > 0) this.history.splice(0, overflow);
  }

  private redirect(): TurnResult {
    return { type: "redirect", message: REDIRECT_MESSAGE };
  }

  private needsTrip(): TurnResult {
    return { type: "needsTrip", message: NEEDS_TRIP_MESSAGE };
  }

  private clarification(clarification: Clarification): TurnResult {
    return {
      type: "clarification",
      message: clarificationPrompt(clarification.slot, clarification.candidates),
      clarification,
    };
  }

  private clarifyAgain(): TurnResult {
    const pending = this.trip.pendingClarification;
    return pending ? this.clarification(pending) : this.redirect();
  }

  private failure(reason: PlanFailureReason, place?: string): TurnResult {
    return { type: "failure", reason, message: failureMessage(reason, place) };
  }
}

function failureMessage(reason: PlanFailureReason, place?: string): string {
  const named = place === undefined ? "That place" : `"${place}"`;
  switch (reason) {
    case "outside_ncr":
      return `${named} is outside the NCR. Pusang Gala only covers Metro Manila trips.`;
    case "unsupported_place":
      return `No supported records found for ${named} yet. Try a nearby known landmark.`;
    case "no_trip_context":
      return "I have no current trip to read that from. Tell me where you're coming from and where you're going.";
    case "same_place":
      return "That is the same place for both ends. Give me a different destination.";
    case "no_origin_access":
      return "No source-backed way from your starting point to a stop. Try a nearby landmark.";
    case "no_destination_access":
      return "No source-backed way to reach your destination from a stop. Try a nearby landmark.";
    case "no_route":
      return "No complete source-backed route for that trip right now. Your current trip stays as is.";
    case "needs_replan":
      return "This pack changed and your trip's records no longer line up. Please plan the trip again.";
  }
}
