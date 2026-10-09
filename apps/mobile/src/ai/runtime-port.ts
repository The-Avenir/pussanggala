/**
 * ModelRuntime port (T34).
 *
 * This file defines the interface only. The pinned native implementation
 * (llama.rn/GGUF per BUILD §2) is provided by T30/T40 and plugs in behind this
 * port; tests inject a fake runtime with failure injection.
 *
 * Port contract the native adapter MUST honor:
 *  - load() must reject promptly when its token is cancelled (including after
 *    an internal timeout-driven cancel from the manager) and must not leave a
 *    native context allocated when it rejects;
 *  - generate() must stop emitting units and reject when its token is
 *    cancelled; units are complete explanation-unit payloads, never raw token
 *    streams — validation of units belongs to T33's stream guard, layered on
 *    top of this port;
 *  - cancel() and dispose() must be idempotent and safe to call in any order;
 *  - dispose() must release ALL native memory for the handle so repeated
 *    load/generate/cancel cycles do not leak (verified in tests).
 */

import type { CancellationToken } from "./cancellation";
import type { GenerationBudget } from "./capability";

export interface ModelSpec {
  /** Native-readable file path supplied by Member 4's asset loader (T41). */
  modelPath: string;
  sha256: string;
  budget: GenerationBudget;
}

/**
 * Structured explanation context.
 *
 * REPLACE (T24/T32): the real shape is `core.buildContext(cards, notes,
 * tripState)` — a bounded evidence bundle with eligible record IDs, canonical
 * cards, paraphrased notes and unknown/conflict/age flags. Kept minimal here
 * so lifecycle/recovery work proceeds before those packages merge.
 */
export interface ExplanationContext {
  /** Canonical card payload as produced by core.compose (opaque here). */
  readonly cardsJson: string;
  readonly notesJson: string;
  readonly tripStateJson: string;
  readonly budget: GenerationBudget;
}

/**
 * One complete, guarded explanation unit.
 *
 * REPLACE (T33): T33's stream guard validates unit kind, canonical card
 * references and factual inserts before any unit reaches this callback; this
 * layer only transports already-validated units. Raw unchecked tokens must
 * never flow through onSafeUnit or reach the screen (INV, SDD §1.4).
 */
export type SafeExplanationUnit = string;

export type SafeUnitHandler = (unit: SafeExplanationUnit) => void;

/** Opaque native handle returned by a successful load. */
export interface RuntimeHandle {
  readonly id: number;
  readonly spec: ModelSpec;
}

export interface ModelRuntime {
  load(spec: ModelSpec, token: CancellationToken): Promise<RuntimeHandle>;
  generate(
    handle: RuntimeHandle,
    context: ExplanationContext,
    onSafeUnit: SafeUnitHandler,
    token: CancellationToken,
  ): Promise<void>;
  /** Best-effort stop of any in-flight generation on this handle. Idempotent. */
  cancel(handle: RuntimeHandle): void;
  /** Release all native resources for the handle. Idempotent. */
  dispose(handle: RuntimeHandle): Promise<void> | void;
}
