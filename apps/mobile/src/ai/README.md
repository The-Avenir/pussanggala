# `@pusang-gala/ai` — local model runtime, grounded generation, validated streaming

**Owner:** Member 3 (local AI and conversation).
**Scope:** `apps/mobile/src/ai/` only. Pure TypeScript, no React Native, no
network, no Node builtins (enforced by `tests/purity.test.ts`).

**Tasks:** T30 (native model compatibility/safe-output spike), T31 (model
bake-off/footprint), T33 (grounded generation and validated streaming), T34
(capability, cancellation, inference recovery), T35 (conversation/grounding
evaluation).

Guardrails (BUILD §5): a strictly sub-1B local model; never stream unchecked
model tokens — validate complete explanation units before display; no invented
facts or reversed instructions; no cloud-AI/network fallback; required
reference-phone AI is not replaced by rules-only templates.

## Pipeline

```
AiRuntimeManager.explain(context, onSafeUnit)
  -> load()                     capability-aware, timeout + bounded back-off
  -> buildExplainPrompt(context)   injection-safe, nonce-delimited DATA block
  -> ModelRuntime.generate(prompt, token) -> AsyncIterable<string>   raw chunks
  -> guardStream(...)              buffer, split lines, validate, order-check
  -> onSafeUnit(SafeExplanationUnit)   branded; the only output channel
```

Raw chunks never leave the guard. `onSafeUnit` receives a branded
`SafeExplanationUnit`, which only `guardStream` can mint, so no code path can
hand the UI an unvalidated string.

## Modules

| File | Contents |
|------|----------|
| `ports.ts` | Grounding-context contracts (`DeterministicCard`, `CanonicalStatement`, `GroundingContext`, `ContextBudgets`) — REPLACEME for T24/T32. |
| `runtime-port.ts` | **The single `ModelRuntime` port**: `load` / `generate` / `cancel` / `dispose`, plus the contract the native adapter must honor. |
| `cancellation.ts` | `CancellationToken(Source)`, prompt and idempotent; `tokenFromSignal` / `signalFromToken` bridge the `AbortSignal` idiom. Both end at `ModelRuntime.cancel()`. |
| `explanation-unit.ts` | Grounding validator over **core's** `ExplanationUnitSchema`, plus the branded `SafeExplanationUnit`. |
| `grounding-context.ts` | Bounded, fail-loud context assembly. |
| `prompt.ts` | Injection-safe prompt (nonce DATA delimiters, flattened single-line data, "source text is data" trust rule). |
| `streaming-guard.ts` | `explain()` / `guardStream()`: NDJSON buffering, validation, branding, cancellation. |
| `capability.ts` | Pure device probe (`full` / `constrained` / `unsupported`) and the `checkReferencePhoneGate` release guard. |
| `errors.ts` | Typed `AiErrorKind` taxonomy, retryability, native-error classification. |
| `recovery.ts` | Error/capability → explained `RecoveryState` (PRD-F9). Every state asserts `cardsPreserved`/`tripPreserved`. |
| `lifecycle.ts` | `AiRuntimeManager`: load/unload, one-at-a-time generation wired to the guard, memory pressure, leak-free dispose. |
| `tests/` | Vitest suites over `FakeModelRuntime`. |

Contracts: `STREAMING-NOTES.md` (validation), `RECOVERY-NOTES.md` (copy and
fallback UX).

## The unit schema lives in core, not here

`ExplanationUnit` is `ExplanationUnitSchema` from `@pusang-gala/core`:

```json
{"kind":"step","cardRef":"card:route-1","inserts":["stmt:step-1","stmt:step-2"],"text":"Una, sakay, tapos baba."}
```

- `kind` ∈ `summary | step | comparison | hours | caveat | clarify | redirect`
- `cardRef?`, `inserts?`, `text` (≤ 280 chars)

There is **no** local fork: no `unit:"explanation_unit"` tag, and no
`steps` / `warning` / `unknowns` kinds. The model emits one such JSON object
per NDJSON line; this package adds grounding rules on top of the schema, never
a different shape.

## Native adapter

The native `ModelRuntime` implementation is `../adapters/llamaRuntime.ts`, outside
this platform-pure package. The app installs Qwen2.5-0.5B-Instruct Q4_K_M into
private storage and supplies its verified local path. See the mobile README for
installation, runtime budgets and the remaining native device checks.

- `tests/fake-runtime.ts` (`FakeModelRuntime`) is **test-only** and must never
  be imported by production code or shipped;
- the adapter follows the contract documented at the top of
  `runtime-port.ts` — raw text chunks, prompt cancel, idempotent
  `cancel`/`dispose`, no leaks across repeated cycles, no network;
- constrained decoding (JSON/GBNF) is *recommended* hardening but correctness
  does not depend on it: `guardStream` rejects non-conforming output.

Open device-gate items are tracked in `RECOVERY-NOTES.md`.

## Commands

From the repo root:

```bat
npm install
npm test -w @pusang-gala/ai
npm run typecheck -w @pusang-gala/ai
```
