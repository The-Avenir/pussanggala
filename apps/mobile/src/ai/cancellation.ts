/**
 * Prompt, idempotent cancellation (T34).
 *
 * CancellationGuardrail: calling cancel() more than once, or after completion,
 * is always a no-op and never throws. A cancelled token rejects as the typed
 * "cancelled" kind so the recovery layer can distinguish user action from a
 * temporary inference error.
 */

import { AiRuntimeError } from "./errors";

export interface CancellationToken {
  readonly isCancelled: boolean;
  /** Register a callback; returns an unsubscribe function. Fires at most once. */
  onCancel(callback: () => void): () => void;
  /** Throws a typed "cancelled" AiRuntimeError when cancelled. */
  throwIfCancelled(): void;
}

export class CancellationTokenSource {
  private cancelled = false;
  private readonly listeners = new Set<() => void>();

  get token(): CancellationToken {
    const source = this;
    return {
      get isCancelled() {
        return source.cancelled;
      },
      onCancel: (callback) => {
        if (source.cancelled) {
          callback();
          return () => {};
        }
        source.listeners.add(callback);
        return () => {
          source.listeners.delete(callback);
        };
      },
      throwIfCancelled: () => {
        if (source.cancelled) {
          throw new AiRuntimeError("cancelled", "operation cancelled");
        }
      },
    };
  }

  /** Idempotent: second and later calls are no-ops. */
  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // A misbehaving listener must not block prompt cancellation.
      }
    }
    this.listeners.clear();
  }
}

/** Forward cancellation from a parent token into this source. Returns unsubscribe. */
export function linkToken(source: CancellationTokenSource, parent: CancellationToken | undefined): () => void {
  if (!parent) return () => {};
  return parent.onCancel(() => source.cancel());
}
