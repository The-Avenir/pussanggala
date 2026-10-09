/**
 * Validated streaming guard (SDD §4 `ai.explain(context, onSafeUnit)` / T33).
 *
 * The guard owns the whole safety contract of generation display:
 * - raw model tokens NEVER reach the UI; they only fill an internal buffer;
 * - a unit becomes visible only when a full NDJSON line has been received,
 *   parsed and validated against the grounding context;
 * - cross-unit ordering is enforced so a later unit cannot walk back an
 *   already displayed step;
 * - invalid units are rejected (recorded, never shown); too many rejections
 *   abort the stream as `invalid_stream` — regeneration/fallback policy is
 *   owned by T32/T34, this module only guarantees nothing unchecked is shown;
 * - cancellation emits nothing partial and stops the runner promptly.
 */

import {
  maxStepOrder,
  parseUnitLine,
  validateExplanationUnit,
  checkStepOrderAgainstEmitted,
  type UnitRejection,
  type ValidatedExplanationUnit,
} from "./explanation-unit";
import { validatorContextOf } from "./grounding-context";
import { buildExplainPrompt } from "./prompt";
import type { GroundingContext, ModelRunnerPort } from "./ports";

export type ExplainStatus =
  | "completed" // stream finished; every emitted unit was validated
  | "cancelled" // caller aborted; nothing partial was emitted
  | "invalid_stream" // too many rejections / oversize buffer: regenerate or fall back (T34)
  | "model_error"; // the runner threw

export interface RejectedUnitRecord {
  index: number;
  reasons: UnitRejection[];
}

export interface ExplainReport {
  status: ExplainStatus;
  emittedUnits: number;
  rejectedUnits: RejectedUnitRecord[];
}

export class ExplainCancelled extends Error {
  constructor() {
    super("explanation stream cancelled");
    this.name = "ExplainCancelled";
  }
}

export interface ExplainOptions {
  signal?: AbortSignal;
}

export type OnSafeUnit = (unit: ValidatedExplanationUnit) => void;

/**
 * Runs one guarded explanation stream. `onSafeUnit` fires synchronously per
 * validated unit, in emission order. The report states exactly how many
 * units reached the screen and which were rejected.
 */
export async function explain(
  context: GroundingContext,
  runner: ModelRunnerPort,
  onSafeUnit: OnSafeUnit,
  options: ExplainOptions = {},
): Promise<ExplainReport> {
  const { prompt } = buildExplainPrompt(context);
  return guardStream(context, runner.streamCompletion(prompt, { signal: options.signal ?? new AbortController().signal }), onSafeUnit, options);
}

/**
 * Guard core, separated from prompt construction so evaluators can feed
 * adversarial token streams directly. Public because T35 evaluation needs it.
 */
export async function guardStream(
  context: GroundingContext,
  tokens: AsyncIterable<string>,
  onSafeUnit: OnSafeUnit,
  options: ExplainOptions = {},
): Promise<ExplainReport> {
  const budgets = context.budgets;
  const vctx = validatorContextOf(context);
  const signal = options.signal;
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
    // Only now — complete, parsed, validated — is the unit allowed on screen.
    onSafeUnit(validation.unit);
    return "continue";
  };

  try {
    for await (const chunk of tokens) {
      if (signal?.aborted) {
        return { status: "cancelled", emittedUnits: emitted, rejectedUnits: rejected };
      }
      buffer += chunk;
      if (buffer.length > budgets.maxUnitBufferChars) {
        reject([{ code: "oversize", detail: `single unit exceeded ${budgets.maxUnitBufferChars} buffered chars` }]);
        return { status: "invalid_stream", emittedUnits: emitted, rejectedUnits: rejected };
      }
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (handleLine(line) === "invalid_stream") {
          return { status: "invalid_stream", emittedUnits: emitted, rejectedUnits: rejected };
        }
      }
    }
    // The runner may also stop on its own in response to the abort; never
    // validate the remaining buffer after cancellation.
    if (signal?.aborted) {
      return { status: "cancelled", emittedUnits: emitted, rejectedUnits: rejected };
    }
    // Stream ended: a final complete JSON unit without a trailing newline is
    // still a complete unit and is validated like any other; a partial tail
    // is rejected and never shown.
    if (buffer.trim().length > 0) {
      if (handleLine(buffer) === "invalid_stream") {
        return { status: "invalid_stream", emittedUnits: emitted, rejectedUnits: rejected };
      }
    }
    return { status: "completed", emittedUnits: emitted, rejectedUnits: rejected };
  } catch (err) {
    if (err instanceof ExplainCancelled || (signal?.aborted ?? false)) {
      return { status: "cancelled", emittedUnits: emitted, rejectedUnits: rejected };
    }
    return { status: "model_error", emittedUnits: emitted, rejectedUnits: rejected };
  }
}
