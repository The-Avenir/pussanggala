/**
 * Recovery policy (T34): error taxonomy -> user-facing explained states.
 *
 * Invariants enforced by construction:
 *  - every RecoveryState declares cardsPreserved/tripPreserved = true. This
 *    module owns NO card or trip state; deterministic cards (core.compose,
 *    T24) and ACTIVE_TRIP (T44) live outside the AI layer, so no inference
 *    failure path can lose them. Member 4's screens must keep rendering them
 *    under every state below.
 *  - every state is EXPLAINED: title/body copy keys are stable and map to the
 *    copy contract in RECOVERY-NOTES.md. No silent rules-only substitution.
 *  - no state offers, implies or performs a network/cloud fallback (INV-2).
 */

import type { AiErrorKind, AiRuntimeError } from "./errors";
import type { CapabilityReport } from "./capability";

export type RecoveryKind =
  /** AI runs at a reduced budget; degradation explained, AI still active. */
  | "ai-constrained"
  /** Transient load/inference failure; retry is offered, cards stay. */
  | "ai-retryable"
  /** User/lifecycle cancel acknowledged; informational only. */
  | "ai-cancelled"
  /** OS memory pressure; model unloaded, retry when pressure clears. */
  | "ai-memory-pressure"
  /** Device cannot run the model; other features unaffected. */
  | "ai-unsupported"
  /** Model asset missing/corrupt; route to asset readiness UI. */
  | "ai-asset-problem";

export type RecoveryActionId = "retry-ai" | "cancel" | "continue-without-ai" | "check-assets";

export interface RecoveryState {
  readonly kind: RecoveryKind;
  /** Stable message keys; copy contract lives in RECOVERY-NOTES.md. */
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly actions: readonly RecoveryActionId[];
  readonly cardsPreserved: true;
  readonly tripPreserved: true;
  readonly retryable: boolean;
}

function state(
  kind: RecoveryKind,
  actions: readonly RecoveryActionId[],
  retryable: boolean,
): RecoveryState {
  return {
    kind,
    titleKey: `ai.recovery.${kind}.title`,
    bodyKey: `ai.recovery.${kind}.body`,
    actions,
    cardsPreserved: true,
    tripPreserved: true,
    retryable,
  };
}

const STATES: Record<RecoveryKind, RecoveryState> = {
  "ai-constrained": state("ai-constrained", ["continue-without-ai"], false),
  "ai-retryable": state("ai-retryable", ["retry-ai", "continue-without-ai"], true),
  "ai-cancelled": state("ai-cancelled", ["retry-ai"], true),
  "ai-memory-pressure": state("ai-memory-pressure", ["retry-ai", "continue-without-ai"], true),
  "ai-unsupported": state("ai-unsupported", ["continue-without-ai"], false),
  "ai-asset-problem": state("ai-asset-problem", ["check-assets", "continue-without-ai"], false),
};

/** Recovery banner for a capability report; null when the device is "full". */
export function recoveryForCapability(report: CapabilityReport): RecoveryState | null {
  if (report.level === "full") return null;
  return report.level === "constrained" ? STATES["ai-constrained"] : STATES["ai-unsupported"];
}

const ERROR_TO_RECOVERY: Record<AiErrorKind, RecoveryKind> = {
  "unsupported-device": "ai-unsupported",
  "asset-unavailable": "ai-asset-problem",
  "load-timeout": "ai-retryable",
  "load-failed": "ai-retryable",
  "inference-failed": "ai-retryable",
  "out-of-memory": "ai-memory-pressure",
  cancelled: "ai-cancelled",
  disposed: "ai-unsupported",
  busy: "ai-retryable",
};

/** Map a typed runtime error to its explained user-facing state. */
export function recoveryForError(error: AiRuntimeError): RecoveryState {
  return STATES[ERROR_TO_RECOVERY[error.kind]];
}
