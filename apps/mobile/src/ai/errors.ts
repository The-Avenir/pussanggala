/**
 * Typed AI runtime error taxonomy (T34).
 *
 * Maps native/model failures to typed kinds so recovery.ts can turn them into
 * distinct, explained PRD-F9 states. Cards and the active trip are owned by
 * core/persistence and are never replaced by errors raised here.
 */

export type AiErrorKind =
  /** Device cannot run the pinned model at all (ABI, RAM floor, asset). Permanent until hardware/asset changes. */
  | "unsupported-device"
  /** Model/pack asset missing or failed checksum (Member 4 asset readiness feeds this). */
  | "asset-unavailable"
  /** Native load did not settle within the configured timeout. */
  | "load-timeout"
  /** Native OOM during load or generation; recoverable via unload + constrained budget retry. */
  | "out-of-memory"
  /** Native load failed for a non-OOM reason. */
  | "load-failed"
  /** Generation failed partway for a non-OOM, non-cancel reason. */
  | "inference-failed"
  /** A user/lifecycle cancellation; not surfaced as a failure. */
  | "cancelled"
  /** Call raced a disposed manager/runtime. */
  | "disposed"
  /** A second concurrent operation was attempted and refused or superseded. */
  | "busy";

const RETRYABLE = new Set<AiErrorKind>([
  "load-timeout",
  "out-of-memory",
  "load-failed",
  "inference-failed",
]);

export class AiRuntimeError extends Error {
  readonly kind: AiErrorKind;
  readonly retryable: boolean;

  constructor(kind: AiErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiRuntimeError";
    this.kind = kind;
    this.retryable = RETRYABLE.has(kind);
  }
}

export function isAiRuntimeError(value: unknown): value is AiRuntimeError {
  return value instanceof AiRuntimeError;
}

const OOM_RE = /out[- ]?of[- ]?memory|\boom\b|cant Allocate|bad_alloc|std::bad_alloc/i;

/**
 * Classify an arbitrary rejection from the native runtime boundary into the
 * taxonomy. Anything unrecognized becomes a retryable load/inference failure;
 * cancellation must be detected by token state, not by this classifier.
 */
export function classifyNativeError(
  value: unknown,
  fallbackKind: "load-failed" | "inference-failed",
): AiRuntimeError {
  if (isAiRuntimeError(value)) return value;
  const message =
    value instanceof Error ? value.message : typeof value === "string" ? value : "native runtime error";
  if (OOM_RE.test(message)) {
    return new AiRuntimeError("out-of-memory", message, { cause: value });
  }
  return new AiRuntimeError(fallbackKind, message, { cause: value });
}
