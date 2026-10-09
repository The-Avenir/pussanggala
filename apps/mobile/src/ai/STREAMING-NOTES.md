# Streaming notes — grounded generation and validated streaming

Owner: Member 3. Scope: `apps/mobile/src/ai/` only. Contracts mirror SDD §1.4,
§4 (`ai.explain(context, onSafeUnit)`) and BUILD §5. Depends on T24 (card
bundle), T30/T40 (native runtime), T32 (conversation context).

## 1. Unit wire format (model → guard)

The model emits **NDJSON**: one complete explanation unit per line, never
partial UI text. The line is a JSON object in the **core**
`ExplanationUnitSchema` shape — this package does not define its own:

```json
{"kind":"step","cardRef":"card:route-1","inserts":["stmt:step-1","stmt:step-2"],"text":"Una, sakay, tapos baba."}
```

| Field | Rule |
|-------|------|
| `kind` | One of `summary`, `step`, `comparison`, `hours`, `caveat`, `clarify`, `redirect`. |
| `cardRef` | Optional; must be a card ID supplied in the grounding context. |
| `inserts` | Optional; canonical statement IDs only. Every factual element the unit conveys must appear here — never as free-text invention. |
| `text` | Connective prose (Taglish/English), ≤ 280 chars (core cap). No numbers, fares, times or durations. No optimum/verification/availability claims. |

There is **no** `unit` discriminator tag and no `steps`/`warning`/`unknowns`
kinds; those were a T33-local fork and are now rejected as `wrong_shape` /
`unknown_kind`.

A stream ends cleanly at end-of-iteration; a final complete JSON line without
a trailing newline is accepted; a partial tail is rejected as
`malformed_json` and never shown.

## 2. Validation rules (`explanation-unit.ts` + `streaming-guard.ts`)

1. **Schema shape** — strict key set (`kind`, `cardRef`, `inserts`, `text`),
   then `ExplanationUnitSchema.safeParse`. Unknown/extra fields, wrong types,
   unknown kinds and the 280-char cap are decided by core's schema.
2. **INV-1 traceability** — every insert ID must exist in the grounding
   context; validated units expose `resolvedPackRecordIds` (union of pack
   records behind cited statements) for eval/audit. Unknown ID ⇒
   `invented_fact`. Unknown `cardRef` ⇒ `unknown_card_ref`.
3. **Invention hardening** — prose that asserts a **boarding, alighting,
   transfer, walking, fare, time or place** fact while the unit cites *no*
   statement is `invented_fact`. This is what makes `inserts` load-bearing
   rather than decorative: an uncited factual claim is invention even when it
   happens to be true. Units that genuinely carry no facts (`clarify`,
   `redirect`, bare summaries) pass because their prose asserts none.
4. **No reversed instructions** — pinned twice: within a unit, cited `step`
   statements must appear in strictly increasing canonical `stepOrder`;
   across units, a unit cannot cite a `stepOrder` at or below the highest
   already displayed. An allowlist of names cannot catch this, so both
   checks are order-based, not vocabulary-based (SDD §1.4).
5. **Banned claims** — `guaranteed/cheapest/fastest/quickest/best route/
   optimal`, `verified/confirmed current/field-verified`, `operating now/
   today`, `arrival time/prediction`, `next/first/last trip is|at|leaves` ⇒
   `banned_claim` (INV-5, PRD-F5).
6. **Unsupported numeric inserts** — peso amounts, clock times, durations in
   `text` ⇒ `unsupported_number`. Numbers come from canonical statements, so
   the model physically cannot display a fabricated value.
7. **Kind/role consistency** — `step` units must cite ≥1 `step` statement;
   `comparison` ⇒ `comparison`; `hours` ⇒ `hours`; `caveat` ⇒ `warning` or
   `unknown`. `summary`/`clarify`/`redirect` have no role requirement.
8. **Budgets** — per-unit text/insert caps; stream `maxUnits`; per-unit
   buffer cap; rejection budget (`maxRejectedUnits`) after which the stream
   aborts as `invalid_stream`.

Result taxonomy: `completed` (all emitted units validated), `cancelled`
(nothing partial emitted), `invalid_stream` (caller regenerates or falls
back), `model_error` (runtime failure; cards stay on screen; `report.error`
carries the cause for classification).

## 3. Buffer accounting (ordering matters)

Per chunk the guard **drains every complete line first, then** measures what
is left:

```
buffer += chunk
while (buffer has "\n") { take line; validate; maybe emit }
if (buffer.length > maxUnitBufferChars) -> invalid_stream
```

Checking the cap before the drain was a bug: a single chunk carrying several
valid units (or many units plus a short tail) could exceed a cap that is
meant to bound **one incomplete unit**, and the whole stream aborted even
though nothing was wrong. The cap now only ever measures the undrained
partial line. Both halves are regression-tested: many units in one chunk
pass; a 3000-char unterminated unit still aborts.

## 4. Nothing unchecked can reach the screen

`onSafeUnit` takes a `SafeExplanationUnit`: a validated unit carrying a
non-enumerable brand symbol minted only by `brandSafeUnit`, called only from
`guardStream` after validation succeeded. It is a nominal type, not an alias
for `string`, so:

- a raw model chunk cannot be passed to a lifecycle/UI handler — it does not
  typecheck, and `isSafeExplanationUnit` rejects it at runtime;
- a hand-rolled object literal with the right fields is also rejected;
- `AiRuntimeManager.explain` has no path from `ModelRuntime.generate` to
  `onSafeUnit` that bypasses `guardStream`.

## 5. Cards-first guarantee (INV-1 + PRD-F5)

Cards render before generation (owned by T24/T45). This module never gates
card display: every failure mode returns a report (or a typed error with an
explained `RecoveryState`) instead of losing state, and `onSafeUnit` only
ever receives validated units.

## 6. Ports other subagents must satisfy

### T30/T40 — `ModelRuntime` (`runtime-port.ts`)
- `generate(prompt, token?)` yields decoded text **chunks** in order (not
  units — chunk boundaries are arbitrary and may split or combine units).
- Must observe cancellation promptly, stop sampling, and free the native
  context; one inference at a time (SDD §1.5).
- `load`/`cancel`/`dispose` per the contract comment in `runtime-port.ts`.
- No network access (INV-2).

### T24 — card bundle (`CardBundleInput` / `CanonicalStatement`)
- Supplies `cards[]` and `statements[]`; every item has non-empty
  `packRecordIds`; `step` statements carry unique 1-based `stepOrder`.
- Text must be canonical/paraphrased — raw Reddit wording never enters this
  pipeline (INV-4). `buildGroundingContext` rejects duplicate IDs,
  untraceable statements, oversize text and bad step orders instead of
  truncating.

### T32 — trip context + orchestration (`TripContextPort`)
- Supplies origin/destination labels and preference as *data*.
- Owns per-conversation lifecycle: call `explain` fresh per follow-up; on
  `cancelled` discard the report; on `invalid_stream`/`model_error` surface
  the manager's `RecoveryState` while keeping cards.
- Conversation memory never includes raw chat (INV-3); only unit metadata
  (kinds, insert IDs) should be retained if needed.

## 7. Open integration questions

1. **Exact GBNF/JSON schema and output cap** — to be pinned in T00/T30; the
   NDJSON-of-core-units line format is the settled contract for now.
2. **Regeneration policy** — the guard has no retry loop inside;
   `AiRuntimeManager` maps `invalid_stream` to the retryable
   `ai-unsafe-output` state and leaves the retry decision to the caller.
3. **Cross-unit step monotonicity and legitimate restarts** — a follow-up
   explanation of the *same* itinerary must start from a fresh guard so the
   step-order cursor resets; T32 must not reuse one guard across journeys.
4. **Factual-marker vocabulary** — the invention-hardening patterns are a
   deliberate over-approximation on *uncited* units only. If T35 eval shows
   false positives, relax with a measured fixture; never relax it to admit
   uncited fares, times or boarding instructions.
5. **Numeric-in-prose rule** — currently absolute (any clock time, duration
   or peso amount in `text` rejects the unit) even when cited.
6. **Nonce strength** — per-prompt 128-bit delimiter from `Math.random`;
   sufficient against accidental forgery by sourced text, but the
   *validator* is the actual safety boundary, not the prompt.
