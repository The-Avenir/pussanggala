/**
 * SystemUnderTest (SUT) port for the T35 conversation/grounding harness.
 *
 * The harness talks to the conversation stack ONLY through this interface, so
 * any of the parallel implementations can be evaluated without touching the
 * harness or fixtures:
 *
 *   - T32 conversation manager  -> implements parse()/respond() against the
 *     real trip-state machine (bounded in-memory context, new-trip reset).
 *   - T33 grounded generation   -> implements guardStream() with the real
 *     model-unit parser/validator; respond() must emit evidence-checked units.
 *   - T34 recovery              -> respond() may return behaviour "failure" with
 *     cards preserved; the harness's failure-state assertions still apply.
 *
 * Contract highlights (SDD §1.4, PRD-F5/F19):
 *   - respond() returns cards BEFORE/alongside the streamed explanation; the
 *     harness checks that displayed_text contains no unsupported claim.
 *   - guardStream() takes raw unit strings as produced by the model adapter
 *     and must only accept units that pass schema + semantic validation.
 *   - Implementations must not use network APIs (INV-2).
 */

import type { EvidenceBundle, TripState } from "./pack.ts";
import type { ExplanationUnit } from "./guard.ts";

export interface ParseOutcome {
  intent: string;
  behaviour: string;
  slots: Record<string, string>;
}

export interface RespondOutcome {
  behaviour: string;
  /** cards rendered first (may be empty for clarifications/redirects) */
  cards: EvidenceBundle["cards"];
  /** validated explanation units that were actually emitted */
  units: ExplanationUnit[];
  /** concatenation of accepted unit texts - what the user would see */
  displayed_text: string;
}

export interface StreamOutcome {
  accepted: { index: number; unit: ExplanationUnit }[];
  rejected: { index: number; reason: string }[];
  displayed_text: string;
}

export interface SystemUnderTest {
  readonly name: string;
  /** Intent/slot extraction for one query against the given trip state. */
  parse(query: string, trip: TripState): Promise<ParseOutcome>;
  /** Full conversational reply: retrieval + behaviour + grounded explanation. */
  respond(query: string, trip: TripState): Promise<RespondOutcome>;
  /** Stream guard for raw model units against the trip's evidence bundle. */
  guardStream(rawUnits: string[], trip: TripState): Promise<StreamOutcome>;
}
