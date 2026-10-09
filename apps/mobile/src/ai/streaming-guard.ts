/**
 * Validated streaming guard (SDD §4 `ai.explain(context, onSafeUnit)`).
 *
 * The guard owns the whole safety contract of generation display:
 * - raw model chunks NEVER reach the UI; they only fill an internal buffer;
 * - a unit becomes visible only when a full NDJSON line has been received,
 *   parsed and validated against the grounding context, and it reaches
 *   `onSafeUnit` as a branded `SafeExplanationUnit` that no caller can forge;
 * - cross-unit ordering is enforced so a later unit cannot walk back an
 *   already displayed step;
 * - invalid units are rejected (recorded, never shown); too many rejections
 *   abort the stream as `invalid_stream` — regeneration/fallback policy is
 *   owned by the lifecycle manager, this module only guarantees nothing
 *   unchecked is shown;
 * - cancellation emits nothing partial and stops the runner promptly.
 */

import {
  brandSafeUnit,
  maxStepOrder,
  parseUnitLine,
  validateExplanationUnit,
  checkStepOrderAgainstEmitted,
  type SafeUnitHandler,
  type UnitRejection,
} from "./explanation-unit";
import { validatorContextOf } from "./grounding-context";
import { buildExplainPrompt } from "./prompt";
import type { AbortSignalLike, CancellationToken } from "./cancellation";
import type { GroundingContext } from "./ports";
import type { ModelRuntime } from "./runtime-port";

export type ExplainStatus =
  | "completed" // stream finished; every emitted unit was validated
  | "cancelled" // caller aborted; nothing partial was emitted
  | "invalid_stream" // too many rejections / oversize buffer: regenerate or fall back
  | "model_error"; // the runtime threw

export interface RejectedUnitRecord {
  index: number;
  reasons: UnitRejection[];
}

export interface ExplainReport {
  status: ExplainStatus;
  emittedUnits: number;
  rejectedUnits: RejectedUnitRecord[];
  /** Present only when status is "model_error"; the lifecycle layer classifies it. */
  error?: unknown;
}

export class ExplainCancelled extends Error {
  constructor() {
    super("explanation stream cancelled");
    this.name = "ExplainCancelled";
  }
}

export interface ExplainOptions {
  /** Web idiom. Either or both may be supplied; both map to the same cancel. */
  signal?: AbortSignalLike;
  token?: CancellationToken;
}

/**
 * Runs one guarded explanation stream end to end: prompt, generate, guard.
 * `onSafeUnit` fires synchronously per validated unit, in emission order.
 */
export async function explain(
  context: GroundingContext,
  runtime: ModelRuntime,
  onSafeUnit: SafeUnitHandler,
  options: ExplainOptions = {},
): Promise<ExplainReport> {
  const { prompt } = buildExplainPrompt(context);
  const chunks = runtime.generate(prompt, options.token ?? options.signal);
  return guardStream(context, chunks, onSafeUnit, options);
}

/**
 * Guard core, separated from prompt construction so evaluators can feed
 * adversarial chunk streams directly. Public because T35 evaluation needs it.
 */
export async function guardStream(
  context: GroundingContext,
  chunks: AsyncIterable<string>,
  onSafeUnit: SafeUnitHandler,
  options: ExplainOptions = {},
): Promise<ExplainReport> {
  const budgets = context.budgets;
  const vctx = validatorContextOf(context);
  const isCancelled = (): boolean =>
    (options.signal?.aborted ?? false) || (options.token?.isCancelled ?? false);
  const rejected: RejectedUnitRecord[] = [];
  let emitted = 0;
  let unitIndex = 0;
  let buffer = "";
  let lastStepOrder = 0;

  const reject = (reasons: UnitRejection[]): boolean => {
    rejected.push({ index: unitIndex, reasons });
    // true => stream must abort as invalid
    return rejected.length > budgets.maxRejectedUnits;
  };

  const handleLine = (line: string): "invalid_stream" | "continue" => {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return "continue";
    }
    if (unitIndex >= budgets.maxUnits) {
      reject([{ code: "oversize", detail: `more than ${budgets.maxUnits} units emitted` }]);
      return "invalid_stream";
    }
    const parsed = parseUnitLine(trimmed);
    if (!parsed.ok) {
      unitIndex += 1;
      return reject([parsed.reason]) ? "invalid_stream" : "continue";
    }
    const validation = validateExplanationUnit(parsed.raw, vctx);
    if (!validation.ok) {
      unitIndex += 1;
      return reject(validation.reasons) ? "invalid_stream" : "continue";
    }
    const orderViolation = checkStepOrderAgainstEmitted(validation.unit, vctx, lastStepOrder);
    if (orderViolation) {
      unitIndex += 1;
      return reject([orderViolation]) ? "invalid_stream" : "continue";
    }
    lastStepOrder = Math.max(lastStepOrder, maxStepOrder(validation.unit, vctx));
    unitIndex += 1;
    emitted += 1;
    // Only now — complete, parsed, validated — is the unit allowed on screen,
    // and only as a branded value.
    onSafeUnit(brandSafeUnit(validation.unit));
    return "continue";
  };

  const report = (status: ExplainStatus): ExplainReport => ({
    status,
    emittedUnits: emitted,
    rejectedUnits: rejected,
  });

  try {
    for await (const chunk of chunks) {
      if (isCancelled()) {
        return report("cancelled");
      }
      buffer += chunk;
      // Drain every complete line FIRST. A single chunk may carry several
      // units, or a unit plus the start of the next one; only what is left
      // undrained is an incomplete unit, so only that counts against the
      // per-unit buffer cap.
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (handleLine(line) === "invalid_stream") {
          return report("invalid_stream");
        }
      }
      if (buffer.length > budgets.maxUnitBufferChars) {
        reject([
          {
            code: "oversize",
            detail: `incomplete unit exceeded ${budgets.maxUnitBufferChars} buffered chars`,
          },
        ]);
        return report("invalid_stream");
      }
    }
    // The runtime may also stop on its own in response to the cancel; never
    // validate the remaining buffer after cancellation.
    if (isCancelled()) {
      return report("cancelled");
    }
    // Stream ended: a final complete JSON unit without a trailing newline is
    // still a complete unit and is validated like any other; a partial tail
    // is rejected and never shown.
    if (buffer.trim().length > 0) {
      if (handleLine(buffer) === "invalid_stream") {
        return report("invalid_stream");
      }
    }
    return report("completed");
  } catch (err) {
    if (err instanceof ExplainCancelled || isCancelled()) {
      return report("cancelled");
    }
    return { ...report("model_error"), error: err };
  }
}
