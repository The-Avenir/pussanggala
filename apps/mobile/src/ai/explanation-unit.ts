/**
 * Explanation-unit validator (SDD §1.4).
 *
 * The wire shape is owned by `@pusang-gala/core`: a unit is exactly
 * `ExplanationUnitSchema` — `{ kind, cardRef?, inserts?, text }` with
 * `kind` in `summary | step | comparison | hours | caveat | clarify |
 * redirect` and `text` at most 280 chars. There is no local fork of the
 * schema and no `unit` discriminator tag: the model emits one core-shaped
 * JSON object per NDJSON line.
 *
 * On top of the schema this module enforces grounding (INV-1): every factual
 * element a unit conveys must trace to a canonical statement cited in
 * `inserts`. Free `text` is connective prose only — numbers, fares, times,
 * durations and travel instructions live in canonical statements, so prose
 * that asserts them without citing anything is invention and is rejected.
 */

import { ExplanationUnitKindSchema, ExplanationUnitSchema } from "@pusang-gala/core";
import type { ExplanationUnit, ExplanationUnitKind } from "@pusang-gala/core";

import type { CanonicalStatement, ContextBudgets, StatementRole } from "./ports";

export type { ExplanationUnit, ExplanationUnitKind };

export const UNIT_KINDS: readonly ExplanationUnitKind[] = ExplanationUnitKindSchema.options;

export interface ValidatedExplanationUnit extends ExplanationUnit {
  /** Union of pack record IDs backing all cited statements (visibility for eval/INV-1). */
  readonly resolvedPackRecordIds: readonly string[];
}

/**
 * Nominal marker minted only by the stream guard. It is a real (non-enumerable)
 * runtime property, so `isSafeExplanationUnit` can prove at runtime that a
 * value reached `onSafeUnit` through validation rather than as a bare string
 * or a hand-rolled object literal.
 */
const SAFE_UNIT_MARK: unique symbol = Symbol("pusang-gala.ai.safe-explanation-unit");

/**
 * A validated unit that is cleared for display. Branded: no string and no
 * object literal can be assigned to this type, so `onSafeUnit` handlers
 * cannot be fed unchecked model output even by mistake.
 */
export type SafeExplanationUnit = ValidatedExplanationUnit & {
  readonly [SAFE_UNIT_MARK]: true;
};

export type SafeUnitHandler = (unit: SafeExplanationUnit) => void;

/**
 * Mint the brand. Call sites are restricted to `streaming-guard.ts`, which
 * only reaches this after `validateExplanationUnit` returned `ok`.
 */
export function brandSafeUnit(unit: ValidatedExplanationUnit): SafeExplanationUnit {
  const branded = Object.defineProperty({ ...unit }, SAFE_UNIT_MARK, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return Object.freeze(branded) as SafeExplanationUnit;
}

export function isSafeExplanationUnit(value: unknown): value is SafeExplanationUnit {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[SAFE_UNIT_MARK] === true
  );
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
  budgets: Pick<ContextBudgets, "maxUnitTextChars" | "maxInsertsPerUnit" | "connectiveTextOnly">;
}

const ALLOWED_KEYS = new Set(["kind", "cardRef", "inserts", "text"]);

/** Guaranteed-optimum / verification / availability claims the model may never author (INV-5, PRD-F5). */
const BANNED_CLAIM_PATTERNS: readonly { label: string; re: RegExp }[] = [
  { label: "guaranteed-optimum", re: /\bguarantee(?:d|s)?\b/i },
  { label: "guaranteed-optimum", re: /\b(?:fastest|cheapest|shortest|quickest)\b/i },
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

/**
 * Prose that asserts a commute fact. Such a claim is only admissible when the
 * unit cites the canonical statement it came from; uncited, it is invention
 * regardless of whether it happens to be true.
 */
const FACTUAL_ASSERTION_PATTERNS: readonly { label: string; re: RegExp }[] = [
  { label: "boarding", re: /\b(?:board(?:ing)?|ride|sakay|sumakay|sasakay|hop\s+on|get\s+on|take\s+the)\b/i },
  { label: "alighting", re: /\b(?:alight|disembark|get\s+off|baba|bumaba|bababa)\b/i },
  { label: "transfer", re: /\b(?:transfer|magpalit|palit\s+ng)\b/i },
  { label: "walking", re: /\b(?:walk(?:ing)?|lakad|maglakad|naglalakad)\b/i },
  { label: "fare", re: /\b(?:fares?|pamasahe|bayad|pesos?|piso|php)\b|₱/i },
  {
    label: "time",
    re: /\b(?:minutes?|mins?|hours?|hrs?|oras|schedule|departs?|departure|arrives?|arrival|opens?|closes?)\b/i,
  },
  {
    label: "place",
    re: /\b(?:stations?|terminals?|stops?|avenue|street|corner|barangay|jeepneys?|jeeps?|buses|bus|tricycles?|trike|uv\s+express|p2p|mrt|lrt|edsa)\b/i,
  },
];

const ROLES_REQUIRED_BY_KIND: Partial<Record<ExplanationUnitKind, readonly StatementRole[]>> = {
  step: ["step"],
  comparison: ["comparison"],
  hours: ["hours"],
  caveat: ["warning", "unknown"],
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
export function validateExplanationUnit(raw: unknown, ctx: ValidatorContext): UnitValidation {
  const reasons: UnitRejection[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      reasons: [{ code: "wrong_shape", detail: "unit is not a JSON object" }],
    };
  }
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) {
      reasons.push({ code: "wrong_shape", detail: `unknown field "${key}"` });
    }
  }

  // The schema itself is core's: shape and the 280-char text cap are decided
  // there, never re-stated here.
  const parsed = ExplanationUnitSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      reasons.push(schemaIssueToRejection(issue));
    }
    return { ok: false, reasons };
  }
  const unit = parsed.data;
  const inserts = unit.inserts ?? [];
  const text = unit.text;

  if (reasons.length > 0) {
    // Extra fields mean the line was not produced against the pinned schema;
    // the grounded checks below assume a schema-shaped unit.
    return { ok: false, reasons };
  }

  if (text.length > ctx.budgets.maxUnitTextChars) {
    reasons.push({
      code: "oversize",
      detail: `text is ${text.length} chars; max is ${ctx.budgets.maxUnitTextChars}`,
    });
  }
  if (inserts.length > ctx.budgets.maxInsertsPerUnit) {
    reasons.push({
      code: "oversize",
      detail: `unit cites ${inserts.length} inserts; max is ${ctx.budgets.maxInsertsPerUnit}`,
    });
  }
  if (unit.cardRef !== undefined && !ctx.cardIds.has(unit.cardRef)) {
    reasons.push({
      code: "unknown_card_ref",
      detail: `cardRef "${unit.cardRef}" is not in the supplied cards`,
    });
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
  const stepOrders = cited
    .filter((s) => s.role === "step")
    .map((s) => ({ id: s.id, order: s.stepOrder }));
  for (const s of stepOrders) {
    if (typeof s.order !== "number") {
      reasons.push({ code: "wrong_shape", detail: `step statement "${s.id}" has no canonical order` });
    }
  }
  for (let i = 1; i < stepOrders.length; i++) {
    const prev = stepOrders[i - 1];
    const curr = stepOrders[i];
    if (
      prev &&
      curr &&
      typeof prev.order === "number" &&
      typeof curr.order === "number" &&
      curr.order <= prev.order
    ) {
      reasons.push({
        code: "reversed_instructions",
        detail: `step "${curr.id}" (order ${curr.order}) cited after later step "${prev.id}" (order ${prev.order})`,
      });
    }
  }

  // Kind/role consistency: a "step" unit must actually cite step statements, etc.
  const requiredRoles = ROLES_REQUIRED_BY_KIND[unit.kind];
  if (requiredRoles && !cited.some((s) => requiredRoles.includes(s.role))) {
    reasons.push({
      code: "kind_role_mismatch",
      detail: `kind "${unit.kind}" must cite at least one ${requiredRoles
        .map((r) => `"${r}"`)
        .join(" or ")} statement`,
    });
  }

  for (const { label, re } of BANNED_CLAIM_PATTERNS) {
    if (re.test(text)) {
      reasons.push({ code: "banned_claim", detail: `text matches banned claim pattern "${label}"` });
    }
  }
  for (const { label, re } of UNSUPPORTED_NUMBER_PATTERNS) {
    if (re.test(text)) {
      reasons.push({
        code: "unsupported_number",
        detail: `text contains unsupported numeric insert ("${label}")`,
      });
    }
  }

  // Invention hardening: factual prose with nothing cited to back it. Units
  // that legitimately carry no facts (clarify, redirect, bare summaries) pass
  // because their prose asserts no boarding/fare/time/place claim.
  if (inserts.length === 0 || ctx.budgets.connectiveTextOnly) {
    // These phrases ask for input or describe the conversation, not a travel step.
    // Keep named places and actual walking/boarding instructions in the fact checks.
    const factualText = text
      .replace(/\bwalk (?:you|us) through\b/gi, 'explain')
      .replace(/\b(?:tell me|share|use) (?:a nearby |a |any )(?:station|mall|landmark|area)(?:\s*(?:,|or|and)\s*(?:a |an |nearby |just the )?(?:station|mall|landmark|area))*\b/gi, 'describe your location')
      .replace(/\b(?:a |any )?(?:station|mall|landmark|area)(?:\s*(?:,|or|and)\s*(?:a |an |nearby |just the )?(?:station|mall|landmark|area))* (?:is|are|would be) (?:fine|okay|ok|enough|helpful)\b/gi, 'a nearby location is fine');
    for (const { label, re } of FACTUAL_ASSERTION_PATTERNS) {
      if (re.test(factualText)) {
        reasons.push({
          code: "invented_fact",
          detail: `text asserts a "${label}" fact outside canonical inserts`,
        });
      }
    }
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  const resolvedPackRecordIds = [...new Set(cited.flatMap((s) => s.packRecordIds))];
  const validated: ValidatedExplanationUnit = {
    kind: unit.kind,
    text,
    resolvedPackRecordIds,
    ...(unit.cardRef !== undefined ? { cardRef: unit.cardRef } : {}),
    ...(unit.inserts !== undefined ? { inserts: unit.inserts } : {}),
  };
  return { ok: true, unit: validated };
}

function schemaIssueToRejection(issue: { code: string; path: readonly PropertyKey[]; message: string }): UnitRejection {
  const field = issue.path.map(String).join(".");
  if (field === "kind") {
    return { code: "unknown_kind", detail: `unknown kind: ${issue.message}` };
  }
  if (issue.code === "too_big") {
    return { code: "oversize", detail: `${field || "unit"} exceeds the core schema cap: ${issue.message}` };
  }
  return { code: "wrong_shape", detail: `${field || "unit"}: ${issue.message}` };
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
  const orders = (unit.inserts ?? [])
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
  for (const id of unit.inserts ?? []) {
    const s = ctx.statementsById.get(id);
    if (s?.role === "step" && typeof s.stepOrder === "number") {
      max = Math.max(max, s.stepOrder);
    }
  }
  return max;
}
