# T32 — Current-trip conversation manager

Owner: Member 3. Tasks: T32 (this module); feeds T33 (grounded streaming) and
T35 (conversation evaluation).

## What this module does

Trip-scoped state machine for the current-trip conversation (SDD §1.4,
PRD-F19/F20):

```
idle --new_trip--> (needs_clarification) clarifying --explicit pick--> active
active --change_origin/destination/preference, reverse, follow-up--> fresh evidence
active|clarifying|idle --new_trip / newTrip() / endTrip()--> reset -> idle
```

The manager owns no trip facts of its own. Everything structural is core:

| Concern | Core surface |
| --- | --- |
| Intent shape and kinds | `Intent`, `IntentKind` (snake_case) |
| Routing preference | `Preference` (`balanced`, `lowest_fare`, `fewest_transfers`, `shortest_reported_time`) |
| Trip state | `TripState` |
| State transitions | `applyIntent(trip, intent, resolved)` |
| Place resolution results | `ResolveResult`, `ResolvedSlots`, `PlaceCandidate` |
| Clarification | `Clarification` |
| Facts | `Card`, `HourStatement`, `EvidenceBundle` |
| Failures | `FailureReason`, `ReplanReason` |

Guarantees:

- **Bounded in-memory context (INV-3):** the only retained history is a capped
  exchange window (`ConversationManagerOptions.maxExchanges`, default 8
  user+assistant exchanges; oldest drop off) plus the core `TripState`. Nothing
  is persisted or serialized — there is deliberately no persistence API
  (checked in `test/guardrails.test.ts`). Reset turns are not logged at all.
  Member 4's T44 persistence stores stable IDs only, outside this module.
- **New-trip reset (PRD-F19):** `newTrip()`, `endTrip()`, and any `new_trip`
  intent clear the trip, any pending clarification and the window before
  planning. The reset goes through core `applyIntent`, so `packId` and
  `schemaVersion` survive it.
- **Clarification requires explicit confirmation (INV-6):** an ambiguous
  endpoint leaves `trip.pendingClarification` set and pauses planning. Only an
  ordinal ("1", "2nd", "una"), an exact/unique-prefix candidate name, or the UI
  callback `handleClarificationPick(index)` confirms. Anything else
  re-presents the candidates; a `new_trip` request abandons them.
- **Fresh evidence only:** endpoint/preference changes, reverses and every
  follow-up call `TripEvidencePort` again with the current `TripState`. The
  manager never answers from the exchange window, and it holds no cached
  `EvidenceBundle` — each bundle is handed to the caller on the turn that
  produced it.
- **Brief redirection:** `unrelated` input gets a fixed one-line redirect
  without touching the evidence port; production wiring must also classify
  unrelated input deterministically *before* any model call (see `ports.ts`).
- **Canonical cards (INV-1):** all factual content is core `Card`s relayed
  verbatim from the evidence port; the manager composes no facts itself. Its
  own strings are navigation/status copy only.

## Public API

```ts
import { newTrip } from "@pusang-gala/core";
import { RuleIntentParser, TripConversationManager } from "@pusang-gala/conversation";

const manager = new TripConversationManager({
  parser,                       // IntentParserPort
  evidence,                     // TripEvidencePort
  trip: newTrip(pack, "balanced"),
});

await manager.handleUserMessage(text);        // -> TurnResult (tagged union)
await manager.handleClarificationPick(index); // explicit UI confirmation
manager.newTrip(); manager.endTrip();         // explicit resets
manager.getState();                           // read-only in-memory snapshot
```

`TurnResult` variants: `plan` (`trip` + `endpoints` + `evidence` bundle),
`clarification` (core `Clarification`), `followUp` (topic + cards +
hour statements), `failure` (core-derived `PlanFailureReason`), `needsTrip`,
`redirect`, `reset`. The UI renders these directly; no model needed.

## Ports other tasks must satisfy

### `IntentParserPort`

`parse(utterance, trip): Promise<Intent>`. Satisfied today by
`RuleIntentParser`, a thin wrapper over core `parse(query, trip)`.

The production adapter (T30) composes **around** that wrapper: core rules
first, `ai.extractIntent` only for utterances the rules flagged as
journey-related, so `unrelated` never burns an inference (BUILD §5). The
signature is already async for exactly this reason. Parsers must never invent
place IDs, fares or route legs (PRD-F1); they only structure the utterance
against the current `TripState`.

### `TripEvidencePort`

- `resolveSlots({ intent, trip })`: core `resolve` over the intent's place
  mentions, returning `ResolvedSlots`. The manager feeds the result straight
  into `applyIntent`, so ambiguity becomes `trip.pendingClarification`
  automatically. `outside_ncr` / `unsupported` results are surfaced as
  failures and the trip is left alone.
- `plan(trip)`: `route` -> `rank` -> `selectItinerary` -> `compose` ->
  `buildContext` for a trip that has both endpoints. Returns the selected
  `TripState`, the pack-named `endpoints`, and the `EvidenceBundle`. Every call
  must re-read the pack.
- `followUp({ topic, trip })`: T25 helpers. `alternatives` may return
  `replanned` (another itinerary selected); `ask_boarding` / `ask_fare` /
  `ask_transfer` / `ask_hours` return fresh cards (plus `HourStatement`s for
  hours) where unknown values stay explicit — never fabricated (INV-5).
  `failed` with `needs_replan` signals pack-incompatible record IDs and drops
  the trip.

`reverse` is deliberately **not** a follow-up topic: core `applyIntent`
performs the swap, so the manager swaps and then calls `plan` for fresh
evidence.

## T35 eval bridge (`createConversationEvalSut`)

Exports a harness-facing SUT named `conversation-ai-bridge-v0`. Parse/respond
use the same deterministic rules as `tools/eval` `StubRulesSut` (vendored under
`src/evalHarness/`). `guardStream` prefers duck-typed `@pusang-gala/ai` helpers
when the passed `aiModule` exposes them; otherwise it uses the eval guard.

Real-path eval (`PUSANG_GALA_EVAL_SUT=real`) may fail corpus accuracy gates
until T30/T33 production wiring lands; it should load without
`RealSutUnavailableError` and pass harness self-checks.

## Open integration questions

1. **`plan` vs. itinerary selection.** The port currently both ranks and
   selects, returning the `TripState` with `selected` set. If the UI needs to
   offer the ranked list before selecting, `plan` should return the itineraries
   and the manager should call core `selectItinerary` on an explicit pick.
2. **T25 follow-up helper surface.** Does core expose one `followUp` entry
   point or per-topic helpers? The port assumes one; splitting is trivial.
3. **`alternatives` semantics.** Modelled as a follow-up that may replan. If
   "alternatives" should only *describe* `EvidenceBundle.alternatives` without
   changing the selection, it becomes an `answer`-only topic.
4. **T30 model classification seam.** Ordering of core `parse` misses ->
   `ai.extractIntent`, and how `unrelated` is decided cheaply before any
   inference. Also: core `parse` has no "journey-flavoured but unstructurable"
   kind, so such text currently lands in `unrelated` and gets the redirect —
   confirm whether core should grow that distinction or whether the model
   fallback covers it.
5. **History window size.** 8 exchanges is a guess; settle with T31 context
   budget measurements. T33's `buildContext` bundle does not consume the
   window today (it is exposed read-only; nothing in T32 requires feeding it
   to the model).
6. **GPS-origin confirmation (INV-6, T43).** A GPS-suggested origin should
   arrive as a `change_origin` intent with a `place_id` mention plus a UI
   confirmation outside the chat loop — needs a Member 4 decision; the manager
   currently only covers place ambiguity.
7. **Cat-voice surface.** Fixed strings here are English/light Taglish; final
   persona copy and T5 explanation phrasing belong to T33/T46.
