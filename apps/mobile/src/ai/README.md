# apps/mobile/src/ai — local model runtime

**Owner:** Member 3 (local AI and conversation).

**Tasks:** T30 (native model compatibility/safe-output spike), T31 (model
bake-off/footprint), T33 (grounded generation and validated streaming), T34
(capability, cancellation, inference recovery), T35 (conversation/grounding
evaluation).

Guardrails (BUILD §5): a strictly sub-1B local model; never stream unchecked
model tokens — validate complete explanation units before display; no invented
facts or reversed instructions; no cloud-AI/network fallback; required
reference-phone AI is not replaced by rules-only templates.

<<<<<<< HEAD
## T33 modules (this checkout)

- `ports.ts` — local contracts (`CardBundleInput`, `CanonicalStatement`,
  `ModelRunnerPort`, `TripContextPort`) marked REPLACEME for T24/T30/T32.
- `explanation-unit.ts` — unit schema + validator (INV-1 traceability,
  step-order/reversal checks, banned claims, unsupported numerals).
- `grounding-context.ts` — bounded, fail-loud context assembly.
- `prompt.ts` — injection-safe prompt (nonce DATA delimiters, flattened
  single-line data, "source text is data" trust rule).
- `streaming-guard.ts` — `explain()` / `guardStream()` buffering NDJSON and
  emitting only validated units via `onSafeUnit`.
- `STREAMING-NOTES.md` — validation contract, ports, open questions.
- `tsconfig.json` — REPLACEME(T40): temporary typecheck scope only.

Run tests: `npx vitest run apps/mobile/src/ai` (repo root); typecheck:
`npx tsc -p apps/mobile/src/ai/tsconfig.json`.
=======
## Implemented: T34 capability / lifecycle / recovery

- `capability.ts` — pure device probe (`full`/`constrained`/`unsupported`)
  and `checkReferencePhoneGate` release guard.
- `runtime-port.ts` — `ModelRuntime` load/generate/cancel/dispose port;
  native adapter from T30/T40 replaces the test fake.
- `lifecycle.ts` — `AiRuntimeManager`: load timeout, bounded back-off retry,
  prompt idempotent cancellation, memory-pressure and unload/dispose hooks.
- `errors.ts`, `cancellation.ts`, `recovery.ts` — typed error taxonomy,
  tokens, explained PRD-F9 recovery states (cards/trip always preserved).
- `RECOVERY-NOTES.md` — taxonomy, Member 4 fallback-UX contract, stress-test
  commands/results, pending S4 device-gate items.
- `tests/` — vitest suites; run from repo root:
  `npx vitest run apps/mobile/src/ai`
>>>>>>> origin/feat/t34-inference-recovery
