# T34 — Capability, cancellation and inference recovery notes

Owner: Member 3. Scope: `apps/mobile/src/ai/` only. Contracts referenced:
SDD §1.4–1.5 (streaming, device policy), §4 (`ai.explain` cancel/retry),
§9 gates S4/S7; PRD-F5/F8/F9 (recovery states); BUILD §5 guardrails.

## Modules

| File | Contents |
|------|----------|
| `capability.ts` | Pure device-capability probe: `full` / `constrained` / `unsupported` with typed reason codes, budget selection, and the `checkReferencePhoneGate` release guard. |
| `runtime-port.ts` | `ModelRuntime` port (load / generate / cancel / dispose) + port contract. **REPLACE (T30/T40):** the pinned native adapter implements this. |
| `lifecycle.ts` | `AiRuntimeManager`: load with timeout, bounded back-off retry, one-at-a-time generation with prompt idempotent cancellation, memory-pressure hooks, leak-free unload/dispose. |
| `errors.ts` | Typed `AiErrorKind` taxonomy (`AiRuntimeError`), retryability, native-error classification (incl. OOM phrasing). |
| `cancellation.ts` | `CancellationTokenSource`/`CancellationToken`; cancel is prompt and idempotent; typed `cancelled` rejections. |
| `recovery.ts` | Error/capability → `RecoveryState` (explained PRD-F9 state). Every state asserts `cardsPreserved`/`tripPreserved`. |
| `tests/` | Vitest suites over `FakeModelRuntime` (test-only; replaces with the native adapter). |

## Error taxonomy → explained user-facing states

`recoveryForError` maps kinds to `RecoveryKind`; Member 4 renders the banner
from `titleKey`/`bodyKey` and the listed actions. Copy contract (English +
Taglish suggestion — final wording is part of T46 UI):

| Recovery kind | From | Actions | Title (EN / TL) | Body (EN / TL) |
|---------------|------|---------|-----------------|----------------|
| `ai-constrained` | constrained capability, OOM-downgraded load | continue-without-ai | "Lighter AI mode" / "Naka-simple AI mode" | "This phone runs the assistant with a shorter memory. Answers may be briefer; all route cards still work." / "Mas maikli ang memorya ng assistant sa phone na ito. Maikli ang sagot, pero buo pa rin ang mga route card." |
| `ai-retryable` | load-timeout, load-failed, inference-failed, busy | retry-ai, continue-without-ai | "Assistant hiccup" / "Nag-error sandali ang assistant" | "The explanation failed temporarily. Your route cards and trip are intact — retry, or keep navigating with the cards." / "Pansamantalang nagka-error ang paliwanag. Buu pa rin ang cards at trip mo — subukan ulit, o magpatuloy gamit ang cards." |
| `ai-cancelled` | user/lifecycle cancel | retry-ai | "Explanation stopped" / "Itinigil ang paliwanag" | "You stopped the explanation. Nothing else changed." / "Itinigil mo ang paliwanag. Walang ibang nagbago." |
| `ai-memory-pressure` | out-of-memory, critical pressure | retry-ai, continue-without-ai | "Phone memory is tight" / "Mababa ang memory ng phone" | "The assistant was unloaded to free memory. Retry when other apps are closed; cards and trip stay available." / "In-unload ang assistant para magka-memory. Subukan ulit kapag nakasara ang ibang apps; nananatili ang cards at trip." |
| `ai-unsupported` | unsupported-device, disposed | continue-without-ai | "Assistant not available on this phone" / "Hindi available ang assistant sa phone na ito" | "This phone can't run the on-device assistant. Routing, cards, maps and trips work fully — only the spoken-style explanation is unavailable." / "Hindi kaya ng phone na ito ang on-device assistant. Gagana nang buo ang routing, cards, maps at trips — ang paliwanag lang ang hindi available." |
| `ai-asset-problem` | asset-unavailable | check-assets, continue-without-ai | "Assistant file problem" / "Problema sa file ng assistant" | "The offline assistant file is missing or corrupted. Check offline assets in settings; everything else still works." / "Nawawala o sira ang offline file ng assistant. Tingnan ang offline assets sa settings; gumagana pa rin ang iba." |

## Fallback UX contract for Member 4 screens (PRD-F9 / SDD §1.4)

1. **Cards first, always.** `core.compose` cards render immediately after
   routing; AI explanation is an enhancement streamed after. Under every
   RecoveryKind the cards, schematic, map and active trip MUST stay rendered
   and interactive — the AI layer never owns or mutates them (asserted in
   tests via fixtures).
2. **Never silent.** Any state where the AI is absent or reduced shows the
   banner above. Do not hide failures behind rules-only output.
3. **Retry semantics.** `retry-ai` calls `manager.load()` (after
   degraded/idle) or repeats `manager.explain(...)`; cancelled/late units
   from superseded generations never reach the screen.
4. **No network path.** No action may trigger downloads/cloud inference — the
   actions above only touch local state (asserted: no cloud/network wording
   or affordance in any state).
5. **Cancel affordance** during generation calls
   `manager.cancelActiveGeneration()`; prompt and idempotent.
6. **Unsupported devices** still get the full routing/cards/map/manual-input
   feature set (SDD §1.5 capability table).

### Reference-phone guardrail (S4/S7)

`checkReferencePhoneGate(report, { isReferencePhone: true })` MUST pass on
the release branch for the named reference phone. A `constrained` or
`unsupported` probe on the reference phone is a **release-blocking failure**,
never the shipped behaviour (BUILD §5: "No reference-phone rules-only
release"). Call it in T47 packaging evidence.

## Lifecycle semantics (SDD §1.5)

- One model context and one generation at a time. A new `explain()`
  cancels and **awaits** the stale generation before starting; its caller
  receives `AiRuntimeError("cancelled")`.
- Load: timeout (default 30 s) cancels the native attempt (port contract:
  reject promptly, free partial context), then bounded exponential back-off
  (default 500 ms ×2, cap 4 s, 3 attempts total). A full-budget OOM retries
  at the constrained budget once, with the `ai-constrained` explained state.
- OOM during generation → unload + `ai-memory-pressure` + `forceConstrained`;
  the next load uses the constrained budget.
- `onMemoryPressure("warning")`: cancels in-flight generation, pins future
  loads to constrained. `"critical"`: additionally unloads the model and
  degrades with explanation. Wire from RN app-state/trim events (Member 4).
- `unloadModel()` is the idle/background release hook; `dispose()` is
  terminal. Both cancel first, await settle, then free native handles.

## Native adapter contract (for T30/T40 implementation of `ModelRuntime`)

- `load` rejects promptly on token cancel and frees partial native state;
  timeout-driven cancels come from the manager.
- `generate` emits only complete explanation-unit payloads (T33 validates
  them); stops and rejects on cancel; raw token streams never cross the port.
- `cancel`/`dispose` idempotent, safe in any order, no leaks on repeated
  load/generate/cancel cycles.

## Stress-test commands and results

Workspace has no app manifest yet (T40 owns it); run from the **repo root** —
uses the hoisted root `typescript`/`vitest` (no new dependencies added):

```bat
npx tsc -p apps/mobile/src/ai/tsconfig.json
npx tsc -p apps/mobile/src/ai/tsconfig.test.json
npx vitest run apps/mobile/src/ai
```

Results (2026-10-09, Windows, Node 26.11.1, vitest 5.0.3, TS 6.0.3):

- Typecheck: pass (both configs).
- Tests: **34 passed / 0 failed** across 5 files: capability matrix,
  reference-gate guard, token cancellation, cancel-during-generate,
  back-off retry (2 attempts, manual clock), load timeout with native-side
  cancel (2 hung attempts, 0 leaked handles), OOM downgrade to constrained,
  persistent-OOM degradation + later recovery, inference failure → typed
  retry → success, OOM mid-generation unload, one-at-a-time supersede,
  critical memory pressure during generation, 20× load/generate/cancel/unload
  leak cycle (`openHandles === 0`, `totalLoads === totalDisposes`),
  idempotent dispose, unsupported-device path with cards/trip intact,
  recovery mapping/copy-key/network-wording checks, src purity (no RN/Expo/
  Node-builtin/network imports or `fetch`/`WebSocket`/`XMLHttpRequest`).

Repeat runs: deterministic (manual clock for time-dependent paths; ≤5 ms
real back-off only in injection-free paths).

## Device-gate items pending (S4, with Member 4)

- [ ] Real `DeviceSnapshot` wiring (ABIs, total RAM, low-RAM flag) from RN
      native APIs in T40; today the probe input is injected.
- [ ] RN memory-warning/trim event wiring to `onMemoryPressure`, and
      app-background/idle wiring to `unloadModel` (measure first — S4).
- [ ] Native adapter behind `ModelRuntime` (llama.rn candidate per T30/S1):
      verify prompt cancel rejection and partial-context cleanup on a real
      phone; 20-generation soak without OOM.
- [ ] Peak-PSS and concurrent map/GPS/model measurement (M6, ≤1 GB on the
      4 GB reference phone); reconcile `reservedForAppMb` (currently a 1 GB
      placeholder) and the full/constrained budgets with measurements.
- [ ] `loadTimeoutMs` default (30 s) validated against measured cold load on
      the reference phone (T31 timing splits).
- [ ] OOM message patterns in `classifyNativeError` confirmed against the
      selected runtime's actual error strings on-device.
- [ ] S7: unseen-query runs through degraded/recovery paths on the physical
      reference + fallback phones.
