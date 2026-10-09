# Member 3 Integration Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or executing-plans. Steps use checkbox syntax.

**Goal:** Coherent Member 3 stack on `feat/m3-integration-repair` with tests green; no fake T30/S1 completion.

**Architecture:** Core owns ExplanationUnit (+ optional inserts). One ModelRuntime port. Conversation → core → guardStream → branded SafeExplanationUnit. Eval plugs real stack; stub for harness self-check only.

**Tech Stack:** TypeScript, vitest, zod, existing `@pusang-gala/core`

**Spec:** `docs/superpowers/specs/2026-10-09-m3-integration-repair-design.md`

## Global Constraints

- Core Intent/Preference/ExplanationUnit kinds are authoritative
- No cloud/network in Member 3 modules
- Do not mark T30–T35 checkboxes done
- Run tests after each task
- Sources to adapt: branches `m3-t32-conversation-manager-r2`, `m3-t33-grounded-streaming`, `m3-t34-inference-recovery`, `m3-t35-conversation-eval`

## Tasks

### Task 1 — Core explanation contract
- Extend `packages/core/src/contracts/explanation.ts` with optional `inserts`
- Update `docs/contracts-pusang-gala.md` §9
- Extend `packages/core/test/contracts.test.ts`
- Run `npm test -w @pusang-gala/core`
- Commit

### Task 2 — Conversation package (from T32)
- Port `apps/mobile/src/conversation` onto core types (Intent, Preference, applyIntent, etc.)
- Async IntentParserPort; RuleIntentParser test-only
- package.json + vitest; register workspace
- Run conversation tests
- Commit

### Task 3 — Unified AI package (T33+T34)
- Single `apps/mobile/src/ai` with ModelRuntime (async iterable chunks), guardStream (buffer check AFTER drain), invention hardening, branded SafeExplanationUnit, lifecycle/recovery wrapping guard
- Adapt from T33+T34 branches; fix C3/C4 and invention gap
- package.json + vitest; register workspace
- Run ai tests
- Commit

### Task 4 — Eval harness (T35)
- Port `tools/eval/conversation`; align guard with core schema; SUT adapter for conversation+ai (or thin wiring); keep stub for self-check; preliminary report
- Register workspace; run eval
- Commit

### Task 5 — TODO honesty + root verify
- Update `docs/TODO.md` Member 3 section with branch/blocker/status notes (checkboxes stay unchecked)
- `npm test` at root; fix failures
- Commit
