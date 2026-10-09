/**
 * Explanation-unit schema and validator (SDD §1.4 / T33).
 *
 * The model emits one NDJSON line per unit. A unit is displayable only after
 * it is complete, schema-shaped, and every factual element traces to a
 * canonical statement / card ID supplied in the grounding context (INV-1).
 * Free-text `text` is connective prose only: numbers, fares, times and
 * durations may appear solely inside canonical statements, so any numeral
 * pattern in `text` is an unsupported factual insert and is rejected.
 */

import type { CanonicalStatement, ContextBudgets } from "./ports";

export const EXPLANATION_UNIT_TAG = "explanation_unit";

export type ExplanationUnitKind =
  | "summary"
  | "steps"
  | "comparison"
  | "hours"
  | "warning"
  | "unknowns";

export const UNIT_KINDS: readonly ExplanationUnitKind[] = [
  "summary",
  "steps",
  "comparison",
  "hours",
  "warning",
  "unknowns",
];

export interface ExplanationUnit {
  unit: typeof EXPLANATION_UNIT_TAG;
  kind: ExplanationUnitKind;
  /** Canonical card ID from the grounding context, when the unit refers to one card. */
  cardRef?: string;
  /** Canonical statement IDs cited by this unit, in speaking order. */
  inserts: string[];
  /** Connective prose authored by the model. No new facts allowed. */
  text: string;
}

export interface ValidatedExplanationUnit extends ExplanationUnit {
  /** Union of pack record IDs backing all cited statements (visibility for eval/INV-1). */
  resolvedPackRecordIds: string[];
}

export type UnitRejectionCode =
  | "malformed_json"
  | "wrong_shape"
  | "unknown_kind"
  | "unknown_card_ref"
  | "invented_fact"
  | "reversed_instructions"
  | "duplicate_insert"
  | "kind_role_mismatch"
  | "banned_claim"
  | "unsupported_number"
  | "oversize";

export interface UnitRejection {
  code: UnitRejectionCode;
  detail: string;
}

export type UnitValidation =
  | { ok: true; unit: ValidatedExplanationUnit }
  | { ok: false; reasons: UnitRejection[] };

/** Deterministic view over the cards/statements the model was given. */
export interface ValidatorContext {
  cardIds: ReadonlySet<string>;
  statementsById: ReadonlyMap<string, CanonicalStatement>;
  budgets: Pick<ContextBudgets, "maxUnitTextChars" | "maxInsertsPerUnit">;
}

const ALLOWED_KEYS = new Set(["unit", "kind", "cardRef", "inserts", "text"]);

/** Guaranteed-optimum / verification / availability claims the model may never author (INV-5, PRD-F5). */
const BANNED_CLAIM_PATTERNS: readonly { label: string; re: RegExp }[] = [
  { label: "guaranteed-optimum", re: /\bguarantee(?:d|s)?\b/i },
  { label: "guaranteed-optimum", re: /\b(?:fastest|cheapest|shortest)\b/i },
  { label: "guaranteed-optimum", re: /\bbest\s+(?:route|option|way)\b/i },
  { label: "guaranteed-optimum", re: /\boptimal\b/i },
  { label: "spurious-verification", re: /\b(?:verified|confirmed\s+current|field[-\s]verified)\b/i },
  { label: "availability-prediction", re: /\boperat(?:ing|es)\s+(?:now|today)\b/i },
  { label: "availability-prediction", re: /\barrival\s+(?:time|prediction)\b/i },
  { label: "schedule-invention", re: /\b(?:next|first|last)\s+(?:trip|departure)\s+(?:is|at|leaves)\b/i },
];

/**
 * Numerals in model prose always mean an unsupported factual insert: a fare,
 * amount, clock time or duration. Canonical values live in statements.
 */
const UNSUPPORTED_NUMBER_PATTERNS: readonly { label: string; re: RegExp }[] = [
  { label: "fare-amount", re: /₱\s*\d|\bphp\b\s*\d|\b\d+(?:\.\d+)?\s*(?:pesos?|piso)\b/i },
  { label: "clock-time", re: /\b\d{1,2}\s*:\s*\d{2}\b/ },
  { label: "duration", re: /\b\d+\s*(?:min(?:ute)?s?|hrs?|oras?|hours?)\b/i },
];

const ROLE_REQUIRED_BY_KIND: Partial<Record<ExplanationUnitKind, CanonicalStatement["role"]>> = {
  steps: "step",
  comparison: "comparison",
  hours: "hours",
  warning: "warning",
  unknowns: "unknown",
};

/** Parse one NDJSON line into a raw value; never throws. */
export function parseUnitLine(
  line: string,
): { ok: true; raw: unknown } | { ok: false; reason: UnitRejection } {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return {
      ok: false,
      reason: { code: "malformed_json", detail: "unit line is not valid JSON" },
    };
  }
  return { ok: true, raw };
}

/**
 * Validate one complete unit against the supplied grounding context.
 * Pure and total: any input returns a decision, never throws.
 */
export function validateExplanationUnit(
  raw: unknown,
  ctx: ValidatorContext,
): UnitValidation {
  const reasons: UnitRejection[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      reasons: [{ code: "wrong_shape", detail: "unit is not a JSON object" }],
    };
  }
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_KEYS.has(key)) {
      reasons.push({ code: "wrong_shape", detail: `unknown field "${key}"` });
    }
  }
  if (obj.unit !== EXPLANATION_UNIT_TAG) {
    reasons.push({ code: "wrong_shape", detail: `unit tag must be "${EXPLANATION_UNIT_TAG}"` });
  }
  const kind = obj.kind;
  if (typeof kind !== "string" || !UNIT_KINDS.includes(kind as ExplanationUnitKind)) {
    reasons.push({ code: "unknown_kind", detail: `unknown kind ${JSON.stringify(kind)}` });
  }
  let cardRef: string | undefined;
  if (obj.cardRef !== undefined) {
    if (typeof obj.cardRef !== "string" || obj.cardRef.length === 0) {
      reasons.push({ code: "wrong_shape", detail: "cardRef must be a non-empty string when present" });
    } else if (!ctx.cardIds.has(obj.cardRef)) {
      reasons.push({ code: "unknown_card_ref", detail: `cardRef "${obj.cardRef}" is not in the supplied cards` });
    } else {
      cardRef = obj.cardRef;
    }
  }
  const insertsRaw = obj.inserts;
  let inserts: string[] = [];
  if (!Array.isArray(insertsRaw) || insertsRaw.some((v) => typeof v !== "string" || v.length === 0)) {
    reasons.push({ code: "wrong_shape", detail: "inserts must be an array of non-empty strings" });
  } else {
    inserts = insertsRaw as string[];
    if (inserts.length > ctx.budgets.maxInsertsPerUnit) {
      reasons.push({ code: "oversize", detail: `unit cites ${inserts.length} inserts; max is ${ctx.budgets.maxInsertsPerUnit}` });
    }
  }
  if (typeof obj.text !== "string") {
    reasons.push({ code: "wrong_shape", detail: "text must be a string" });
  }
  const text = typeof obj.text === "string" ? obj.text : "";
  if (text.length > ctx.budgets.maxUnitTextChars) {
    reasons.push({ code: "oversize", detail: `text is ${text.length} chars; max is ${ctx.budgets.maxUnitTextChars}` });
  }

  // Early exit when the shape is unrecoverable; the remaining checks need typed fields.
  if (reasons.some((r) => r.code === "wrong_shape" || r.code === "unknown_kind")) {
    return { ok: false, reasons };
  }

  const cited: CanonicalStatement[] = [];
  const seen = new Set<string>();
  for (const id of inserts) {
    if (seen.has(id)) {
      reasons.push({ code: "duplicate_insert", detail: `statement "${id}" cited twice in one unit` });
      continue;
    }
    seen.add(id);
    const stmt = ctx.statementsById.get(id);
    if (!stmt) {
      reasons.push({ code: "invented_fact", detail: `statement "${id}" is not in the grounding context` });
    } else {
      cited.push(stmt);
    }
  }

  // Reversed instructions: cited step statements must be strictly ordered
  // like the canonical itinerary (SDD §1.4 — allowlists cannot prevent reversal).
  const stepOrders = cited.filter((s) => s.role === "step").map((s) => ({ id: s.id, order: s.stepOrder }));
  for (const s of stepOrders) {
    if (typeof s.order !== "number") {
      reasons.push({ code: "wrong_shape", detail: `step statement "${s.id}" has no canonical order` });
    }
  }
  for (let i = 1; i < stepOrders.length; i++) {
    const prev = stepOrders[i - 1];
    const curr = stepOrders[i];
    if (prev && curr && typeof prev.order === "number" && typeof curr.order === "number" && curr.order <= prev.order) {
      reasons.push({
        code: "reversed_instructions",
        detail: `step "${curr.id}" (order ${curr.order}) cited after later step "${prev.id}" (order ${prev.order})`,
      });
    }
  }

  // Kind/role consistency: a "steps" unit must actually cite step statements, etc.
  const requiredRole = ROLE_REQUIRED_BY_KIND[kind as ExplanationUnitKind];
  if (requiredRole && !cited.some((s) => s.role === requiredRole)) {
    reasons.push({ code: "kind_role_mismatch", detail: `kind "${kind}" must cite at least one "${requiredRole}" statement` });
  }

  for (const { label, re } of BANNED_CLAIM_PATTERNS) {
    if (re.test(text)) {
      reasons.push({ code: "banned_claim", detail: `text matches banned claim pattern "${label}"` });
    }
  }
  for (const { label, re } of UNSUPPORTED_NUMBER_PATTERNS) {
    if (re.test(text)) {
      reasons.push({ code: "unsupported_number", detail: `text contains unsupported numeric insert ("${label}")` });
    }
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }
  const resolvedPackRecordIds = [...new Set(cited.flatMap((s) => s.packRecordIds))];
  const unit: ValidatedExplanationUnit = {
    unit: EXPLANATION_UNIT_TAG,
    kind: kind as ExplanationUnitKind,
    inserts,
    text,
    resolvedPackRecordIds,
  };
  if (cardRef !== undefined) {
    unit.cardRef = cardRef;
  }
  return { ok: true, unit };
}

/**
 * Stream-level ordering check: steps already displayed cannot be walked back
 * by a later unit. Returns a rejection to append when the check fails.
 */
export function checkStepOrderAgainstEmitted(
  unit: ValidatedExplanationUnit,
  ctx: ValidatorContext,
  lastEmittedStepOrder: number,
): UnitRejection | null {
  const orders = unit.inserts
    .map((id) => ctx.statementsById.get(id))
    .filter((s): s is CanonicalStatement => s !== undefined && s.role === "step")
    .map((s) => s.stepOrder)
    .filter((n): n is number => typeof n === "number");
  const first = orders[0];
  if (first !== undefined && first <= lastEmittedStepOrder) {
    return {
      code: "reversed_instructions",
      detail: `unit restarts at step order ${first}, but step order ${lastEmittedStepOrder} was already displayed`,
    };
  }
  return null;
}

/** Highest step order cited by a unit (0 when none). */
export function maxStepOrder(unit: ValidatedExplanationUnit, ctx: ValidatorContext): number {
  let max = 0;
  for (const id of unit.inserts) {
    const s = ctx.statementsById.get(id);
    if (s?.role === "step" && typeof s.stepOrder === "number") {
      max = Math.max(max, s.stepOrder);
    }
  }
  return max;
}
