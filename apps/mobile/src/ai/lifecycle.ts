/**
 * AI runtime lifecycle manager.
 *
 * Owns capability probing, model load/unload with timeout and bounded
 * back-off retry, one-at-a-time generation with prompt idempotent
 * cancellation, OS memory-pressure handling and leak-free disposal — and it
 * is the component that wires generation to the display guard:
 *
 *   load() -> runtime.generate(prompt) -> guardStream(...) -> onSafeUnit(branded)
 *
 * Guardrails (BUILD §5 / SDD §1.4–1.5):
 *  - no cloud/network fallback exists anywhere in this file — all failures
 *    surface as typed errors mapped to explained on-device states;
 *  - cards and the active trip are never touched here; every failure keeps
 *    them usable (see recovery.ts);
 *  - raw chunks from the runtime never reach `onSafeUnit`: they are piped
 *    through `guardStream`, which is the only minter of SafeExplanationUnit;
 *  - one model context and one generation at a time; a new explain()
 *    supersedes (cancels) any stale in-flight generation;
 *  - an explained constrained/unsupported fallback never substitutes for
 *    required reference-phone AI — checkReferencePhoneGate (capability.ts)
 *    fails the release if the reference phone probes below "full".
 */

import {
  probeCapability,
  type CapabilityReport,
  type DeviceSnapshot,
  type GenerationBudget,
  type ModelRequirements,
} from "./capability";
import {
  CancellationTokenSource,
  asCancellationToken,
  linkToken,
  type CancellationLike,
  type CancellationToken,
} from "./cancellation";
import { AiRuntimeError, classifyNativeError } from "./errors";
import { buildExplainPrompt } from "./prompt";
import { recoveryForCapability, recoveryForError, type RecoveryState } from "./recovery";
import { guardStream, type ExplainReport } from "./streaming-guard";
import type { SafeUnitHandler } from "./explanation-unit";
import type { GroundingContext } from "./ports";
import type { ModelRuntime, ModelSpec, RuntimeHandle } from "./runtime-port";

export type LifecyclePhase =
  | "idle"
  | "probing"
  | "loading"
  | "ready"
  | "generating"
  | "degraded"
  | "unsupported"
  | "disposed";

export interface LifecycleSnapshot {
  phase: LifecyclePhase;
  capability: CapabilityReport | null;
  budget: GenerationBudget | null;
  lastError: AiRuntimeError | null;
  recovery: RecoveryState | null;
  loadAttempts: number;
  completedGenerations: number;
  cancelledGenerations: number;
}

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

// React Native provides setTimeout/Date globally; declared here so this
// module stays platform-pure (no DOM or Node type dependency).
declare function setTimeout(callback: () => void, ms: number): unknown;

/** Wall-clock timer used in production. Tests inject a manual clock. */
export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface BackoffPolicy {
  baseMs: number;
  factor: number;
  maxMs: number;
}

export interface LifecycleOptions {
  /** Produces a DeviceSnapshot (REPLACE T40: RN DeviceInfo/ActivityManager wiring). */
  probe: () => DeviceSnapshot | Promise<DeviceSnapshot>;
  requirements: ModelRequirements;
  /** Native-readable model path + hash from Member 4's asset loader (T41). */
  model: { modelPath: string; sha256: string };
  clock?: Clock;
  /** Default 30 s; native load on a 4 GB phone should come in well under this (measured in T31). */
  loadTimeoutMs?: number;
  /** Total load attempts including the first; default 3. */
  maxLoadAttempts?: number;
  backoff?: BackoffPolicy;
}

const DEFAULT_BACKOFF: BackoffPolicy = { baseMs: 500, factor: 2, maxMs: 4_000 };

export type MemoryPressureLevel = "warning" | "critical";

export class AiRuntimeManager {
  private readonly runtime: ModelRuntime;
  private readonly options: LifecycleOptions & {
    clock: Clock;
    loadTimeoutMs: number;
    maxLoadAttempts: number;
    backoff: BackoffPolicy;
  };

  private phase: LifecyclePhase = "idle";
  private capability: CapabilityReport | null = null;
  private budget: GenerationBudget | null = null;
  private lastError: AiRuntimeError | null = null;
  private recovery: RecoveryState | null = null;
  private loadAttempts = 0;
  private completedGenerations = 0;
  private cancelledGenerations = 0;

  private handle: RuntimeHandle | null = null;
  private loadPromise: Promise<void> | null = null;
  private generation: { id: number; source: CancellationTokenSource; settled: Promise<void> } | null =
    null;
  private forceConstrained = false;
  private seq = 0;
  private readonly listeners = new Set<(snapshot: LifecycleSnapshot) => void>();

  constructor(runtime: ModelRuntime, options: LifecycleOptions) {
    this.runtime = runtime;
    this.options = {
      clock: systemClock,
      loadTimeoutMs: 30_000,
      maxLoadAttempts: 3,
      backoff: DEFAULT_BACKOFF,
      ...options,
    };
  }

  get snapshot(): LifecycleSnapshot {
    return {
      phase: this.phase,
      capability: this.capability,
      budget: this.budget,
      lastError: this.lastError,
      recovery: this.recovery,
      loadAttempts: this.loadAttempts,
      completedGenerations: this.completedGenerations,
      cancelledGenerations: this.cancelledGenerations,
    };
  }

  subscribe(listener: (snapshot: LifecycleSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.snapshot;
    for (const listener of [...this.listeners]) listener(snapshot);
  }

  private setPhase(phase: LifecyclePhase): void {
    this.phase = phase;
    this.emit();
  }

  /** Probe capability and load the model unless the device is unsupported. */
  async initialize(token?: CancellationLike): Promise<LifecycleSnapshot> {
    if (this.phase === "disposed") {
      throw new AiRuntimeError("disposed", "AI runtime manager is disposed");
    }
    if (this.capability === null) {
      this.setPhase("probing");
      this.capability = await probeCapabilityFromOptions(this.options);
      if (this.capability.level === "unsupported") {
        this.recovery = recoveryForCapability(this.capability);
        this.setPhase("unsupported");
        this.emit();
        return this.snapshot;
      }
    }
    if (this.capability.level !== "unsupported") {
      await this.load(token);
    }
    return this.snapshot;
  }

  /**
   * Idempotent while a load is in flight: concurrent callers share it.
   * Retries transient failures with bounded back-off; a full-budget
   * out-of-memory downgrades to the constrained budget once (explained).
   */
  load(token?: CancellationLike): Promise<void> {
    if (this.phase === "disposed") {
      return Promise.reject(new AiRuntimeError("disposed", "AI runtime manager is disposed"));
    }
    if (this.phase === "unsupported") {
      return Promise.reject(
        new AiRuntimeError("unsupported-device", "device cannot run the pinned local model"),
      );
    }
    if (this.handle && this.phase === "ready") {
      return Promise.resolve();
    }
    this.loadPromise ??= this.runLoad(asCancellationToken(token)).finally(() => {
      this.loadPromise = null;
    });
    return this.loadPromise;
  }

  private async runLoad(token?: CancellationToken): Promise<void> {
    if (this.capability === null) {
      this.capability = await probeCapabilityFromOptions(this.options);
      if (this.capability.level === "unsupported") {
        this.recovery = recoveryForCapability(this.capability);
        this.setPhase("unsupported");
        throw new AiRuntimeError("unsupported-device", "device cannot run the pinned local model");
      }
    }
    this.setPhase("loading");
    let failures = 0;
    for (;;) {
      failures += 1;
      this.loadAttempts += 1;
      const budget = this.pickBudget();
      // A fresh token per attempt: a timeout cancels only its own attempt and
      // must not poison retries.
      const source = new CancellationTokenSource();
      const unlink = linkToken(source, token);
      try {
        const handle = await this.withTimeout(
          this.runtime.load(this.spec(budget), source.token),
          this.options.loadTimeoutMs,
          () => new AiRuntimeError("load-timeout", "native model load timed out"),
          () => source.cancel(),
        );
        this.handle = handle;
        this.budget = budget;
        this.lastError = null;
        this.recovery =
          budget === this.options.requirements.constrained
            ? recoveryForCapability({
                level: "constrained",
                reasons: [
                  { code: "memory-constrained", detail: "running with reduced generation budget" },
                ],
                budget,
              })
            : null;
        this.setPhase("ready");
        return;
      } catch (raw) {
        const error = classifyNativeError(raw, "load-failed");
        if (error.kind === "cancelled") {
          this.setPhase(this.handle ? "ready" : "idle");
          throw error;
        }
        this.lastError = error;
        if (error.kind === "out-of-memory" && !this.forceConstrained && this.capability.level === "full") {
          // Explained degradation: retry at the constrained budget.
          this.forceConstrained = true;
        }
        if (!error.retryable || failures >= this.options.maxLoadAttempts) {
          await this.unloadHandleQuietly();
          this.recovery = recoveryForError(error);
          this.setPhase("degraded");
          throw error;
        }
        const { baseMs, factor, maxMs } = this.options.backoff;
        try {
          // Back-off is interruptible only by the caller's external token; the
          // per-attempt source may already be cancelled by its own timeout.
          await this.interruptibleSleep(Math.min(baseMs * factor ** (failures - 1), maxMs), token);
        } catch (sleepError) {
          // Cancellation during back-off must still restore the phase.
          if ((sleepError as AiRuntimeError).kind === "cancelled") {
            this.setPhase(this.handle ? "ready" : "idle");
          }
          throw sleepError;
        }
      } finally {
        unlink();
      }
    }
  }

  private interruptibleSleep(ms: number, token?: CancellationToken): Promise<void> {
    if (!token) return this.options.clock.sleep(ms);
    return Promise.race([
      this.options.clock.sleep(ms),
      new Promise<never>((_resolve, reject) => {
        token.onCancel(() => reject(new AiRuntimeError("cancelled", "operation cancelled")));
      }),
    ]);
  }

  /**
   * Stream a guarded explanation for the supplied grounding context.
   *
   * Raw chunks from `runtime.generate` are piped straight into `guardStream`,
   * so `onSafeUnit` only ever receives complete, schema-valid, grounded,
   * branded units. Any failure throws a typed AiRuntimeError and updates
   * snapshot.recovery; cards and the active trip are untouched.
   *
   * One inference at a time (SDD §1.5): an in-flight generation is cancelled
   * and awaited before the new one starts; its caller receives the typed
   * "cancelled" error.
   */
  async explain(
    context: GroundingContext,
    onSafeUnit: SafeUnitHandler,
    token?: CancellationLike,
  ): Promise<ExplainReport> {
    if (this.phase === "disposed") {
      throw new AiRuntimeError("disposed", "AI runtime manager is disposed");
    }
    if (this.phase === "unsupported") {
      throw new AiRuntimeError("unsupported-device", "device cannot run the pinned local model");
    }
    if (this.loadPromise) {
      await this.loadPromise.catch(() => {});
    }
    if (!this.handle) {
      await this.load(token);
    }
    const handle = this.handle;
    if (!handle || !this.budget) {
      throw new AiRuntimeError("disposed", "model unloaded while starting explanation");
    }

    // Supersede any stale generation and wait until native work has stopped.
    this.cancelActiveGeneration();
    if (this.generation) {
      await this.generation.settled;
      // (this.phase may have changed across the await)
      if ((this.phase as LifecyclePhase) === "disposed") {
        throw new AiRuntimeError("disposed", "AI runtime manager is disposed");
      }
    }

    const source = new CancellationTokenSource();
    const unlink = linkToken(source, asCancellationToken(token));
    // Either cancellation idiom ends at ModelRuntime.cancel().
    const unlinkNative = source.token.onCancel(() => {
      try {
        this.runtime.cancel();
      } catch {
        // cancel() is best-effort per the port contract.
      }
    });
    const id = (this.seq += 1);
    let resolveSettled!: () => void;
    const settled = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });
    this.generation = { id, source, settled };
    this.setPhase("generating");

    try {
      const { prompt } = buildExplainPrompt(context);
      const report = await guardStream(
        context,
        this.runtime.generate(prompt, source.token),
        (unit) => {
          // Late units from a superseded/cancelled generation never surface.
          if (!source.token.isCancelled && this.generation?.id === id) onSafeUnit(unit);
        },
        { token: source.token },
      );

      if (report.status === "cancelled") {
        this.cancelledGenerations += 1;
        this.lastError = null;
        this.recovery = recoveryForError(new AiRuntimeError("cancelled", "explanation cancelled"));
        if (this.generation?.id === id) this.setPhase(this.handle ? "ready" : "degraded");
        throw new AiRuntimeError("cancelled", "explanation cancelled");
      }
      if (report.status === "model_error") {
        throw await this.failGeneration(classifyNativeError(report.error, "inference-failed"), id);
      }
      if (report.status === "invalid_stream") {
        throw await this.failGeneration(
          new AiRuntimeError(
            "invalid-stream",
            `model output failed the display guard (${report.rejectedUnits.length} rejected units)`,
          ),
          id,
        );
      }

      this.completedGenerations += 1;
      this.lastError = null;
      if (this.generation?.id === id) this.setPhase("ready");
      return report;
    } catch (raw) {
      if (raw instanceof AiRuntimeError) throw raw;
      if (source.token.isCancelled) {
        this.cancelledGenerations += 1;
        this.lastError = null;
        if (this.generation?.id === id) this.setPhase(this.handle ? "ready" : "degraded");
        throw new AiRuntimeError("cancelled", "explanation cancelled", { cause: raw });
      }
      throw await this.failGeneration(classifyNativeError(raw, "inference-failed"), id);
    } finally {
      unlinkNative();
      unlink();
      if (this.generation?.id === id) this.generation = null;
      resolveSettled();
    }
  }

  /**
   * Record a generation failure, unloading on OOM so the next attempt reloads
   * at the constrained budget. Cards/trip stay usable in every branch.
   */
  private async failGeneration(error: AiRuntimeError, id: number): Promise<AiRuntimeError> {
    this.lastError = error;
    this.recovery = recoveryForError(error);
    if (error.kind === "out-of-memory") {
      this.forceConstrained = true;
      await this.unloadHandleQuietly();
      this.setPhase("degraded");
    } else if (this.generation?.id === id) {
      // Cards/trip stay usable; the next explain() retries with the in-memory
      // model (or reloads if the handle was lost).
      this.setPhase(this.handle ? "ready" : "degraded");
    }
    return error;
  }

  /** Prompt and idempotent cancellation of the in-flight generation. */
  cancelActiveGeneration(): void {
    this.generation?.source.cancel();
  }

  /**
   * OS memory-pressure hook (Member 4 wires RN/TRIM events). "warning"
   * cancels any in-flight generation and pins future loads to the
   * constrained budget; "critical" additionally unloads the model and moves
   * to an explained degraded state. Cards/trip are never touched.
   */
  async onMemoryPressure(level: MemoryPressureLevel): Promise<void> {
    if (this.phase === "disposed" || this.phase === "unsupported") return;
    this.forceConstrained = true;
    const generation = this.generation;
    this.cancelActiveGeneration();
    if (level === "critical") {
      if (generation) await generation.settled;
      await this.unloadHandleQuietly();
      this.recovery = recoveryForError(new AiRuntimeError("out-of-memory", "OS memory pressure"));
      this.setPhase("degraded");
    }
  }

  /**
   * Release the native context without disposing the manager (SDD §1.5:
   * release on memory pressure/idle/background). The next explain() reloads.
   * Idempotent and safe while generating (cancels first).
   */
  async unloadModel(): Promise<void> {
    if (this.phase === "disposed") return;
    const generation = this.generation;
    this.cancelActiveGeneration();
    if (generation) await generation.settled;
    await this.unloadHandleQuietly();
    this.budget = null;
    if (this.phase !== "unsupported") {
      this.setPhase("idle");
    }
  }

  /** Release all native resources. Idempotent; safe to call repeatedly. */
  async dispose(): Promise<void> {
    if (this.phase === "disposed") return;
    const generation = this.generation;
    this.cancelActiveGeneration();
    if (generation) await generation.settled;
    await this.unloadHandleQuietly();
    this.recovery = null;
    this.setPhase("disposed");
  }

  private pickBudget(): GenerationBudget {
    if (this.capability?.level === "constrained" || this.forceConstrained) {
      return this.options.requirements.constrained;
    }
    return this.options.requirements.full;
  }

  private spec(budget: GenerationBudget): ModelSpec {
    return {
      modelPath: this.options.model.modelPath,
      sha256: this.options.model.sha256,
      budget,
    };
  }

  private async unloadHandleQuietly(): Promise<void> {
    const handle = this.handle;
    this.handle = null;
    if (!handle) return;
    try {
      await this.runtime.dispose();
    } catch {
      // Disposal is best-effort; failures here must not mask the real error
      // or block cleanup. The native adapter contract keeps this leak-free.
    }
  }

  private async withTimeout<T>(
    operation: Promise<T>,
    ms: number,
    onTimeout: () => AiRuntimeError,
    onTimeoutSideEffect?: () => void,
  ): Promise<T> {
    const timeoutMarker = this.options.clock.sleep(ms).then(() => TIMEOUT);
    // Avoid an unhandled rejection when the timeout wins the race.
    operation.catch(() => {});
    const result = await Promise.race([operation, timeoutMarker]);
    if ((result as unknown) === TIMEOUT) {
      // Per the port contract the adapter rejects promptly and frees any
      // native context once its token is cancelled.
      onTimeoutSideEffect?.();
      throw onTimeout();
    }
    return result as T;
  }
}

const TIMEOUT = Symbol("ai-load-timeout");

async function probeCapabilityFromOptions(options: LifecycleOptions): Promise<CapabilityReport> {
  const snapshot = await options.probe();
  return probeCapability(snapshot, options.requirements);
}
