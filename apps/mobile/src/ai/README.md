# apps/mobile/src/ai — local model runtime (placeholder)

**Owner:** Member 3 (local AI and conversation).

**Tasks:** T30 (native model compatibility/safe-output spike), T31 (model
bake-off/footprint), T33 (grounded generation and validated streaming), T34
(capability, cancellation, inference recovery), T35 (conversation/grounding
evaluation).

Guardrails (BUILD §5): a strictly sub-1B local model; never stream unchecked
model tokens — validate complete explanation units before display; no invented
facts or reversed instructions; no cloud-AI/network fallback; required
reference-phone AI is not replaced by rules-only templates.

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
