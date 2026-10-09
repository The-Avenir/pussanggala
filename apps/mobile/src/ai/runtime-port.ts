/**
 * The single local model runtime port.
 *
 * This is the one and only seam between the AI layer and the native model.
 * `FakeModelRuntime` (tests/) implements it for tests; the llama.rn native
 * adapter lives in ../adapters/llamaRuntime.ts, outside this pure package.
 *
 * Port contract the native adapter MUST honor:
 *  - `load` rejects promptly when its token is cancelled (including after a
 *    timeout-driven cancel from the manager) and leaves no native context
 *    allocated when it rejects;
 *  - `generate` yields **raw decoded text chunks** in generation order.
 *    Chunk boundaries are arbitrary: a chunk may split a unit or contain
 *    several. The adapter performs no validation and no UI-facing
 *    formatting — `streaming-guard.ts` is the safety boundary, and nothing
 *    yielded here may reach the screen unvalidated;
 *  - `generate` stops sampling and ends/rejects promptly once its token is
 *    cancelled; one inference at a time (SDD §1.5);
 *  - `cancel()` and `dispose()` are idempotent and safe in any order;
 *  - `dispose()` releases ALL native memory so repeated
 *    load/generate/cancel cycles do not leak (verified in tests);
 *  - no network access anywhere behind this port (INV-2).
 */

import type { CancellationLike } from "./cancellation";
import type { GenerationBudget } from "./capability";

export type { SafeExplanationUnit, SafeUnitHandler } from "./explanation-unit";

export interface ModelSpec {
  /** Native-readable file path supplied by Member 4's asset loader (T41). */
  modelPath: string;
  sha256: string;
  budget: GenerationBudget;
}

/** Opaque native handle returned by a successful load. */
export interface RuntimeHandle {
  readonly id: number;
  readonly spec: ModelSpec;
}

export interface ModelRuntime {
  load(spec: ModelSpec, token?: CancellationLike): Promise<RuntimeHandle>;
  /** Raw text chunks, in order. Never units, never validated output. */
  generate(prompt: string, token?: CancellationLike): AsyncIterable<string>;
  /** Best-effort stop of any in-flight generation. Idempotent. */
  cancel(): void;
  /** Release all native resources. Idempotent. */
  dispose(): Promise<void> | void;
}
