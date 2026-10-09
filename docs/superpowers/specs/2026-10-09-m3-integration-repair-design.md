# Member 3 integration repair — design

**Date:** 2026-10-09  
**Scope:** Approach 1 from multi-model review (integration repair; no claimed S1/T40).  
**Branch:** `feat/m3-integration-repair`

## Goal

Land a coherent Member 3 stack on a branch from current `main`: core-owned explanation contract, one runtime port, conversation + streaming guard + recovery + eval harness wired and tested. Native GGUF/S1 remains explicitly pending (T30/T40).

## Architecture

```
User text → ConversationManager (T32)
  → IntentParserPort (rules first; model async later)
  → @pusang-gala/core (parse/resolve/route/compose/buildContext/applyIntent)
  → EvidenceBundle + cards
  → AiRuntimeManager (T34) → ModelRuntime.generate → AsyncIterable<chunk>
  → guardStream (T33) → SafeExplanationUnit (branded) → UI
Eval (T35) plugs the same manager+guard via SystemUnderTest; stub only for harness self-check.
```

## Contracts

- Keep core kinds: `summary|step|comparison|hours|caveat|clarify|redirect`
- Add optional `inserts: string[]` for INV-1 traceability
- `text` ≤ 280; factual numbers/boarding claims must come from inserts / canonical statements (enforced in T33 validator)
- Single `ModelRuntime`: `load` / `generate → AsyncIterable<string>` / `cancel` / `dispose`
- `onSafeUnit` only receives branded units from `guardStream`

## Packages

- `packages/core` — contracts (existing)
- `apps/mobile/src/conversation` — T32 adapted to core types
- `apps/mobile/src/ai` — unified T33+T34
- `tools/eval/conversation` — T35 adapted to core + real SUT adapter
- Root workspaces register mobile packages / eval so `npm test` runs them

## Honesty

- Do not check T30–T35 done boxes
- TODO notes: branch, blockers (T00 phones, T40, T30), preliminary eval
- FakeModelRuntime / RuleIntentParser are test/dev only

## Testing

After each deliverable: run that package’s tests; final `npm test` at root.
