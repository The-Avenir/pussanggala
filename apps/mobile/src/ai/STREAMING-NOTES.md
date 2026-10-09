# T33 streaming notes — grounded generation and validated streaming

Owner: Member 3. Scope: `apps/mobile/src/ai/` only. Depends on/replaces
ports from T24 (card bundle), T30 (model runner), T32 (conversation
context). All contracts mirror SDD §1.4, §4 (`ai.explain(context,
onSafeUnit)`) and BUILD §5.

## 1. Unit wire format (model → guard)

The model emits **NDJSON**: one complete explanation unit per line, never
partial UI text. A unit line:

```json
{"unit":"explanation_unit","kind":"steps","cardRef":"card:route-1","inserts":["stmt:step-1","stmt:step-2"],"text":"Una, sakay, tapos baba."}
```

| Field | Rule |
|-------|------|
| `unit`  | Literally `"explanation_unit"` (version discriminator). |
| `kind`  | One of `summary`, `steps`, `comparison`, `hours`, `warning`, `unknowns`. |
| `cardRef` | Optional; must be a card ID supplied in the grounding context. |
| `inserts` | Canonical statement IDs only. Every factual element the unit conveys is an insert — never free-text invention. |
| `text` | Connective prose (Taglish/English). No numbers, fares, times or durations (those live in canonical statements). No optimum/verification/availability claims. |

A stream ends cleanly at runner end-of-iteration; a final complete JSON line
without trailing newline is accepted; a partial tail is rejected as
`malformed_json` and never shown.

## 2. Validation rules (all enforced in `explanation-unit.ts` + `streaming-guard.ts`)

1. **Schema shape** — strict key set (`unit`, `kind`, `cardRef`, `inserts`,
   `text`); unknown/extra fields, wrong types, unknown kinds rejected.
2. **INV-1 traceability** — every insert ID must exist in the grounding
   context; validated units expose `resolvedPackRecordIds` (union of pack
   records behind cited statements) for eval/audit. Unknown ID ⇒
   `invented_fact`. Unknown `cardRef` ⇒ `unknown_card_ref`.
3. **No reversed instructions** — pinned twice: within a unit, cited `step`
   statements must appear in strictly increasing canonical `stepOrder`;
   across units, a unit cannot cite a `stepOrder` at or below the highest
   already displayed. An allowlist of names cannot catch this, so both
   checks are order-based, not vocabulary-based (SDD §1.4).
4. **Banned claims** — `guaranteed/cheapest/fastest/best route/optimal`,
   `verified/confirmed current/field-verified`, `operating now/today`,
   `arrival time/prediction`, `next/first/last trip is|at|leaves` ⇒
   `banned_claim` (INV-5, PRD-F5).
5. **Unsupported numeric inserts** — peso amounts, clock times, durations
   in `text` ⇒ `unsupported_number`. Numbers must come from canonical
   statements, so the model physically cannot display a fabricated value.
6. **Kind/role consistency** — `steps` units must cite ≥1 `step` statement
   (likewise `comparison`/`hours`/`warning`/`unknowns`).
7. **Budgets** — per-unit text/insert caps; stream `maxUnits`; per-unit
   buffer cap; rejection budget (`maxRejectedUnits`) after which the stream
   aborts as `invalid_stream`.

Result taxonomy: `completed` (all emitted units validated),
`cancelled` (nothing partial emitted), `invalid_stream` (caller regenerates
or falls back), `model_error` (runner failure; cards stay on screen).

## 3. Cards-first guarantee (INV-1 + PRD-F5)

Cards render before generation (owned by T24/T45). This module never gates
card display: every failure mode of `explain` returns a report instead of
throwing, and `onSafeUnit` only ever receives validated units. Raw model
tokens are never exposed — the only output channel is the buffered,
validated `onSafeUnit` callback.

## 4. Ports other subagents must satisfy

### T30 — `ModelRunnerPort` (`ports.ts`, REPLACEME by native adapter)
- `streamCompletion(prompt, {signal}): AsyncIterable<string>` yielding
  decoded text **chunks** in order (not units — chunking is arbitrary).
- Must observe `signal.aborted` promptly, stop sampling, and free the native
  context; one inference at a time (SDD §1.5).
- No network access (INV-2).
- Constrained decoding (JSON/GBNF per T00/T30) is *recommend* hardening, but
  correctness does not depend on it: the guard rejects non-conforming output.

### T24 — card bundle (`CardBundleInput` / `CanonicalStatement`, REPLACEME)
- Supplies `cards[]` and `statements[]`; every item has non-empty
  `packRecordIds`; `step` statements carry unique 1-based `stepOrder`.
- Text must be canonical/paraphrased — raw Reddit wording never enters this
  pipeline (INV-4). Assembly (`buildGroundingContext`) rejects duplicate
  IDs, untraceable statements, oversize text and bad step orders instead of
  truncating.

### T32 — `TripContextPort` + orchestration (REPLACEME)
- Supplies origin/destination labels and preference as *data*.
- Owns per-conversation lifecycle: call `explain` fresh per follow-up with a
  fresh `AbortController`; on `cancelled` discard the report; on
  `invalid_stream`/`model_error` route to T34 recovery while keeping cards.
- Conversation memory never includes raw chat (INV-3); only unit metadata
  (kinds, insert IDs) should be retained if needed.

## 5. Open integration questions

1. **Exact GBNF/JSON schema and output cap** — to be pinned in T00/T30; this
   module treats the NDJSON line format as the settled contract for now.
2. **Regeneration policy** — T34 decides retry backoff and template fallback
   on `invalid_stream`; the guard intentionally has no retry loop inside.
3. **Unit kind set** — `summary/steps/comparison/hours/warning/unknowns`
   covers SDD's "reply kind"; the T35 eval may justify splitting or adding
   kinds (e.g. `redirect` for unrelated requests, current-trip reference).
4. **Cross-unit step monotonicity and legitimate restarts** — a follow-up
   explanation of the *same* itinerary must start from a fresh guard so the
   step-order cursor resets; T32 must not reuse one guard across journeys.
5. **Numeric-in-prose rule** — currently absolute (any clock time / duration
   / peso amount in `text` rejects the unit). If eval shows false positives
   from harmless connective text (e.g. "second option"), relax only with a
   measured T35 fixture, never to admit fares/times.
6. **Nonce strength** — per-prompt 128-bit delimiter from `Math.random`;
   sufficient against accidental forgery of the DATA delimiter by sourced
   text, but the *validator* is the actual safety boundary, not the prompt.
