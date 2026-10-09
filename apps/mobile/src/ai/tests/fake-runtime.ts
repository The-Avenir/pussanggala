/**
 * FakeModelRuntime — TEST-ONLY stand-in for the native ModelRuntime port.
 *
 * REPLACE (T30/T40): the pinned llama.rn/GGUF native adapter. This fake
 * models the port contract (prompt cancel rejection, idempotent dispose, no
 * handle leak on failure) and exposes failure injection plus handle counters
 * so leak/stress assertions are possible without a device.
 */

import { AiRuntimeError } from "../errors";
import type { CancellationToken } from "../cancellation";
import type {
  ExplanationContext,
  ModelRuntime,
  ModelSpec,
  RuntimeHandle,
  SafeUnitHandler,
} from "../runtime-port";

export type LoadOutcome =
  | { type: "success" }
  | { type: "fail"; error: unknown }
  | { type: "hang-until-cancelled" };

export type GenerateOutcome =
  | { type: "success"; units: string[] }
  | { type: "fail"; error: unknown; units?: string[] }
  | { type: "wait-for-cancel"; units?: string[] };

const SUCCESS: LoadOutcome = { type: "success" };

export class FakeModelRuntime implements ModelRuntime {
  // Leak instrumentation.
  openHandles = 0;
  totalLoads = 0;
  totalDisposes = 0;
  totalGenerations = 0;

  loadQueue: LoadOutcome[] = [];
  generateQueue: GenerateOutcome[] = [];
  readonly loadedSpecs: ModelSpec[] = [];

  private nextId = 1;

  async load(spec: ModelSpec, token: CancellationToken): Promise<RuntimeHandle> {
    this.totalLoads += 1;
    this.loadedSpecs.push(spec);
    const outcome = this.loadQueue.shift() ?? SUCCESS;
    token.throwIfCancelled();
    if (outcome.type === "fail") throw outcome.error;
    if (outcome.type === "hang-until-cancelled") {
      await new Promise<never>((_resolve, reject) => {
        token.onCancel(() => reject(new AiRuntimeError("cancelled", "load cancelled")));
      });
    }
    token.throwIfCancelled();
    this.openHandles += 1;
    return { id: this.nextId++, spec };
  }

  async generate(
    _handle: RuntimeHandle,
    _context: ExplanationContext,
    onSafeUnit: SafeUnitHandler,
    token: CancellationToken,
  ): Promise<void> {
    this.totalGenerations += 1;
    token.throwIfCancelled();
    const outcome = this.generateQueue.shift() ?? { type: "success", units: ["ok"] };
    for (const unit of "units" in outcome ? outcome.units ?? [] : []) {
      token.throwIfCancelled();
      onSafeUnit(unit);
      await Promise.resolve();
    }
    if (outcome.type === "fail") throw outcome.error;
    if (outcome.type === "wait-for-cancel") {
      await new Promise<never>((_resolve, reject) => {
        token.onCancel(() => reject(new Error("native generation aborted")));
      });
    }
  }

  cancel(_handle: RuntimeHandle): void {
    // Idempotent per port contract; token-driven rejection happens in generate().
  }

  dispose(_handle: RuntimeHandle): void {
    this.openHandles -= 1;
    this.totalDisposes += 1;
  }
}
