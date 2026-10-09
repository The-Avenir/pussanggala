/**
 * FakeModelRuntime — TEST-ONLY stand-in for the native ModelRuntime port.
 *
 * TODO (T30/T40): the pinned llama.rn/GGUF native adapter. This fake models
 * the port contract (raw text chunks, prompt cancel, idempotent dispose, no
 * handle leak on failure) and exposes failure injection plus handle counters
 * so leak/stress assertions are possible without a device.
 */

import { asCancellationToken, type CancellationLike } from "../cancellation";
import { AiRuntimeError } from "../errors";
import type { ModelRuntime, ModelSpec, RuntimeHandle } from "../runtime-port";

export type LoadOutcome =
  | { type: "success" }
  | { type: "fail"; error: unknown }
  | { type: "hang-until-cancelled" };

export type GenerateOutcome =
  | { type: "success"; chunks: string[] }
  | { type: "fail"; error: unknown; chunks?: string[] }
  | { type: "wait-for-cancel"; chunks?: string[] };

const SUCCESS: LoadOutcome = { type: "success" };

export class FakeModelRuntime implements ModelRuntime {
  // Leak instrumentation.
  openHandles = 0;
  totalLoads = 0;
  totalDisposes = 0;
  totalGenerations = 0;
  cancelCalls = 0;

  loadQueue: LoadOutcome[] = [];
  generateQueue: GenerateOutcome[] = [];
  readonly loadedSpecs: ModelSpec[] = [];
  readonly prompts: string[] = [];

  private nextId = 1;

  async load(spec: ModelSpec, token?: CancellationLike): Promise<RuntimeHandle> {
    this.totalLoads += 1;
    this.loadedSpecs.push(spec);
    const t = asCancellationToken(token);
    const outcome = this.loadQueue.shift() ?? SUCCESS;
    t?.throwIfCancelled();
    if (outcome.type === "fail") throw outcome.error;
    if (outcome.type === "hang-until-cancelled") {
      await new Promise<never>((_resolve, reject) => {
        t?.onCancel(() => reject(new AiRuntimeError("cancelled", "load cancelled")));
      });
    }
    t?.throwIfCancelled();
    this.openHandles += 1;
    return { id: this.nextId++, spec };
  }

  async *generate(prompt: string, token?: CancellationLike): AsyncIterable<string> {
    this.totalGenerations += 1;
    this.prompts.push(prompt);
    const t = asCancellationToken(token);
    t?.throwIfCancelled();
    const outcome = this.generateQueue.shift() ?? { type: "success", chunks: [] };
    for (const chunk of outcome.chunks ?? []) {
      if (t?.isCancelled) return;
      yield chunk;
      // Let a microtask run so cancels between chunks are observable.
      await Promise.resolve();
    }
    if (outcome.type === "fail") throw outcome.error;
    if (outcome.type === "wait-for-cancel") {
      // Native generation stops on cancel; the stream simply ends.
      await new Promise<void>((resolve) => {
        if (t === undefined || t.isCancelled) {
          resolve();
          return;
        }
        t.onCancel(resolve);
      });
    }
  }

  cancel(): void {
    // Idempotent per port contract; token-driven stop happens in generate().
    this.cancelCalls += 1;
  }

  dispose(): void {
    this.totalDisposes += 1;
    if (this.openHandles > 0) this.openHandles -= 1;
  }
}
