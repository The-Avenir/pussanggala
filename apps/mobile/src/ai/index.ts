/**
 * apps/mobile/src/ai — local model runtime support (Member 3).
 *
 * T34 scope: capability probing, runtime lifecycle, cancellation, and
 * inference recovery with explained fallback. T30/T31 own the native runtime
 * implementation behind ModelRuntime; T33 owns the guarded streaming layer
 * that validates units before they reach onSafeUnit.
 */

export {
  probeCapability,
  checkReferencePhoneGate,
  type CapabilityLevel,
  type CapabilityReason,
  type CapabilityReasonCode,
  type CapabilityReport,
  type DeviceSnapshot,
  type GenerationBudget,
  type ModelRequirements,
  type ReferenceGateResult,
} from "./capability";
export { CancellationTokenSource, linkToken, type CancellationToken } from "./cancellation";
export { AiRuntimeError, classifyNativeError, isAiRuntimeError, type AiErrorKind } from "./errors";
export {
  AiRuntimeManager,
  systemClock,
  type BackoffPolicy,
  type Clock,
  type LifecycleOptions,
  type LifecyclePhase,
  type LifecycleSnapshot,
  type MemoryPressureLevel,
} from "./lifecycle";
export {
  recoveryForCapability,
  recoveryForError,
  type RecoveryActionId,
  type RecoveryKind,
  type RecoveryState,
} from "./recovery";
export type {
  ExplanationContext,
  ModelRuntime,
  ModelSpec,
  RuntimeHandle,
  SafeExplanationUnit,
  SafeUnitHandler,
} from "./runtime-port";
