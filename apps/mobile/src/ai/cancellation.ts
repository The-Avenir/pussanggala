/**
 * Prompt, idempotent cancellation.
 *
 * CancellationGuardrail: calling cancel() more than once, or after
 * completion, is always a no-op and never throws. A cancelled token rejects
 * as the typed "cancelled" kind so the recovery layer can distinguish user
 * action from a temporary inference error.
 *
 * The single `ModelRuntime` port accepts a `CancellationToken`. Callers that
 * already own an `AbortController` (web/RN idioms, T33's original guard API)
 * convert with `tokenFromSignal`; adapters that need a signal convert the
 * other way with `signalFromToken`. Both directions end at the same place:
 * `ModelRuntime.cancel()`.
 */

import { AiRuntimeError } from "./errors";

export interface CancellationToken {
  readonly isCancelled: boolean;
  /** Register a callback; returns an unsubscribe function. Fires at most once. */
  onCancel(callback: () => void): () => void;
  /** Throws a typed "cancelled" AiRuntimeError when cancelled. */
  throwIfCancelled(): void;
}

/**
 * Structural view of the standard `AbortSignal`. Declared locally so this
 * package needs neither DOM nor Node lib types (purity boundary).
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: "abort", listener: () => void): void;
  removeEventListener(type: "abort", listener: () => void): void;
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
export function linkToken(
  source: CancellationTokenSource,
  parent: CancellationToken | undefined,
): () => void {
  if (!parent) return () => {};
  return parent.onCancel(() => source.cancel());
}

/** Adapt an `AbortSignal` into the port's cancellation token. */
export function tokenFromSignal(signal: AbortSignalLike): CancellationToken {
  return {
    get isCancelled() {
      return signal.aborted;
    },
    onCancel: (callback) => {
      if (signal.aborted) {
        callback();
        return () => {};
      }
      signal.addEventListener("abort", callback);
      return () => signal.removeEventListener("abort", callback);
    },
    throwIfCancelled: () => {
      if (signal.aborted) {
        throw new AiRuntimeError("cancelled", "operation cancelled");
      }
    },
  };
}

/** Either cancellation idiom is accepted at the port boundary. */
export type CancellationLike = CancellationToken | AbortSignalLike;

function isAbortSignalLike(value: CancellationLike): value is AbortSignalLike {
  return "aborted" in value;
}

/** Normalize whichever idiom the caller used into a `CancellationToken`. */
export function asCancellationToken(value: CancellationLike | undefined): CancellationToken | undefined {
  if (!value) return undefined;
  return isAbortSignalLike(value) ? tokenFromSignal(value) : value;
}

/** Minimal controller shape, so `signalFromToken` needs no global typings. */
export interface AbortControllerLike {
  readonly signal: AbortSignalLike;
  abort(): void;
}

/**
 * Adapt a `CancellationToken` into an `AbortSignal` for adapters written
 * against the web idiom. `makeController` defaults to the ambient
 * `AbortController`, which React Native and Node both provide.
 */
export function signalFromToken(
  token: CancellationToken,
  makeController: () => AbortControllerLike = defaultController,
): AbortSignalLike {
  const controller = makeController();
  if (token.isCancelled) {
    controller.abort();
  } else {
    token.onCancel(() => controller.abort());
  }
  return controller.signal;
}

declare const AbortController: { new (): AbortControllerLike };

function defaultController(): AbortControllerLike {
  return new AbortController();
}
