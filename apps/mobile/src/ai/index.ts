/**
 * `@pusang-gala/ai` — on-device model runtime, grounded generation and
 * validated streaming (Member 3).
 *
 * The package merges two halves of the same pipeline:
 *   - grounded streaming: context assembly, injection-safe prompt, and the
 *     display guard that only ever emits validated, branded units;
 *   - inference recovery: capability probing, load/generate lifecycle,
 *     cancellation and explained recovery states.
 *
 * See README.md for the native-adapter TODO (T30/T40), STREAMING-NOTES.md
 * for the validation contract and RECOVERY-NOTES.md for the copy contract.
 */

export {
  CORE_UNIT_TEXT_MAX,
  DEFAULT_BUDGETS,
  type CanonicalStatement,
  type CardBundleInput,
  type ContextBudgets,
  type DeterministicCard,
  type GroundingContext,
  type StatementRole,
  type TripContextPort,
} from "./ports";

export {
  UNIT_KINDS,
  brandSafeUnit,
  checkStepOrderAgainstEmitted,
  isSafeExplanationUnit,
  maxStepOrder,
  parseUnitLine,
  validateExplanationUnit,
  type ExplanationUnit,
  type ExplanationUnitKind,
  type SafeExplanationUnit,
  type SafeUnitHandler,
  type UnitRejection,
  type UnitRejectionCode,
  type UnitValidation,
  type ValidatedExplanationUnit,
  type ValidatorContext,
} from "./explanation-unit";

export {
  buildGroundingContext,
  validatorContextOf,
  type AssemblyInput,
  type AssemblyResult,
} from "./grounding-context";

export { DATA_BLOCK_KIND, buildExplainPrompt, sanitizeDataText, type ExplainPrompt } from "./prompt";

export {
  ExplainCancelled,
  explain,
  guardStream,
  type ExplainOptions,
  type ExplainReport,
  type ExplainStatus,
  type RejectedUnitRecord,
} from "./streaming-guard";

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

export {
  CancellationTokenSource,
  asCancellationToken,
  linkToken,
  signalFromToken,
  tokenFromSignal,
  type AbortControllerLike,
  type AbortSignalLike,
  type CancellationLike,
  type CancellationToken,
} from "./cancellation";

export {
  AiRuntimeError,
  classifyNativeError,
  isAiRuntimeError,
  type AiErrorKind,
} from "./errors";

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

export type { ModelRuntime, ModelSpec, RuntimeHandle } from "./runtime-port";
