/**
 * Stream-unit guard + unsupported-claim detector for the T35 harness.
 *
 * This is the evaluation-side reference of the SDD §1.4 streaming contract:
 * a raw model unit is buffered, schema-checked, and semantically checked
 * against the evidence bundle BEFORE it may be displayed. The checks are
 * deterministic heuristics (amounts, durations, clock times, board/alight
 * direction, banned claim phrases, conflict completeness); T33 must keep at
 * least these rules and may add deeper semantic review. A vocabulary
 * allowlist alone is insufficient (BUILD §5) - the reversal checks exist
 * because a model can reverse instructions using allowed names.
 */

import {
  ExplanationUnitSchema,
  type ExplanationUnit,
  type ExplanationUnitKind,
} from "@pusang-gala/core";

import { stopNameVariants } from "./pack.ts";
import type { BundleCard, EvidenceBundle } from "./pack.ts";

export type { ExplanationUnit } from "@pusang-gala/core";

export const UNIT_TEXT_CAP = 280;

const KINDS_REQUIRE_REF = new Set<ExplanationUnitKind>(["step"]);
const UNIT_FIELDS = new Set(["kind", "cardRef", "inserts", "text"]);

export interface UnitVerdict {
  ok: boolean;
  reason: string;
  unit?: ExplanationUnit;
}

/** Parse + schema-validate one raw unit string (never throws). */
export function parseUnit(raw: string): UnitVerdict {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "unparseable JSON (truncated or malformed unit)" };
  }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj))
    return { ok: false, reason: "unit is not a JSON object" };
  const rec = obj as Record<string, unknown>;
  const extra = Object.keys(rec).filter((key) => !UNIT_FIELDS.has(key));
  if (extra.length > 0)
    return { ok: false, reason: `unexpected unit fields: ${extra.join(",")}` };

  const parsed = ExplanationUnitSchema.safeParse(rec);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      reason: issue?.message ?? "unit does not match ExplanationUnitSchema",
    };
  }

  return {
    ok: true,
    reason: "",
    unit: parsed.data,
  };
}

// ---------------------------------------------------------------------------
// Unsupported-claim detector
// ---------------------------------------------------------------------------

export interface ClaimAnalysis {
  allowedAmounts: Set<number>;
  allowedDurationsMin: Set<number>;
  allowedClockTimes: Set<string>;
  /** cards with >=2 conflicting fare reports */
  conflictedCards: BundleCard[];
  allCards: BundleCard[];
}

function extractClockTimes(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)) out.push(m[0]);
  return out;
}

export function buildClaimAnalysis(bundle: EvidenceBundle): ClaimAnalysis {
  const allowedAmounts = new Set<number>();
  const allowedDurationsMin = new Set<number>();
  const allowedClockTimes = new Set<string>();
  const conflictedCards: BundleCard[] = [];
  for (const card of bundle.cards) {
    const distinct = new Set<number>();
    for (const f of card.fares) {
      distinct.add(f.amount_min);
      if (f.amount_max !== f.amount_min) distinct.add(f.amount_max);
    }
    for (const amount of distinct) allowedAmounts.add(amount);
    if (distinct.size >= 2) conflictedCards.push(card);
    if (card.ride_min !== null) allowedDurationsMin.add(card.ride_min);
    if (card.hours) for (const t of extractClockTimes(card.hours.hours_text)) allowedClockTimes.add(t);
  }
  // Derived totals are legal only where every card fare is a single report.
  const allSingle = bundle.cards.length > 0 && bundle.cards.every((c) => c.fares.length === 1);
  if (allSingle) {
    let total = 0;
    for (const c of bundle.cards) total += c.fares[0]!.amount_min;
    allowedAmounts.add(total);
  }
  return { allowedAmounts, allowedDurationsMin, allowedClockTimes, conflictedCards, allCards: [...bundle.cards] };
}

const BANNED_CLAIM_RES: Array<{ re: RegExp; label: string }> = [
  { re: /\b(?:verified|field[- ]verified)\b/i, label: "verification claim (INV-5: no verified/field-verified states)" },
  { re: /\bguaranteed\b/i, label: "guarantee claim" },
  { re: /\bcurrently operating\b/i, label: "live-operation claim" },
  { re: /\boperat(?:es?|ing)\b[^.\n]{0,20}\bright now\b/i, label: "live-operation claim" },
  { re: /\b(?:departs?|leaves?|trips?|runs?)\s+every\b[^.\n]{0,24}\d/i, label: "frequency/schedule invention" },
  { re: /\b24\s*\/\s*7\b/i, label: "24/7 operation claim" },
  { re: /\b24[- ]hours?\b/i, label: "24-hour operation claim" },
  { re: /\b(?:trip|ride|fare|jeep|bus)(?:ney|s)?\s+(?:is|are)\s+free\b/i, label: "free-fare claim" },
  { re: /\btrips?\s+free\b/i, label: "free-trip claim" },
  { re: /\b(?:ignore|disregard|forget)\b[^.\n]{0,30}\b(?:instructions?|rules?|cards?|validation)\b/i, label: "instruction echo" },
  { re: /\bsystem\s+(?:prompt|notice)\b/i, label: "prompt/authority echo" },
  { re: /\bpaste it back\b/i, label: "prompt-leak echo" },
  { re: /\breal[- ]time\b|\blive (?:gps|tracking|updates?)\b/i, label: "live-data claim" },
];

const PESO_RE = /₱\s?(\d+(?:\.\d+)?)|\bphp\s?(\d+(?:\.\d+)?)\b|(\d+(?:\.\d+)?)\s*pesos\b/gi;
const DURATION_RE = /(\d+(?:\.\d+)?)\s*(?:min|minutes)\b/gi;
const CLOCK_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;

const CONFLICT_WORD_RE = /\b(?:conflict\w*|differ\w*|both reports)\b/i;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Deterministic unsupported-claim detector. Returns violation labels; an empty
 * array means no unsupported claim was detected. Applied to every candidate
 * display text in both suites - any hit is a hard failure (PRD M3 target: 0).
 */
export function detectUnsupportedClaims(text: string, bundle: EvidenceBundle): string[] {
  const violations: string[] = [];
  const a = buildClaimAnalysis(bundle);

  // 1) money amounts must come from evidence (or a fully-known derived total)
  for (const m of text.matchAll(PESO_RE)) {
    const amount = Number(m[1] ?? m[2] ?? m[3]);
    if (!a.allowedAmounts.has(amount)) {
      violations.push(`unsupported fare amount: ${m[0]}`);
    }
  }
  // 2) ride durations must come from evidence
  for (const m of text.matchAll(DURATION_RE)) {
    const mins = Number(m[1]);
    if (!a.allowedDurationsMin.has(mins)) {
      violations.push(`unsupported duration: ${m[0]}`);
    }
  }
  // 3) clock times must come from a bundle hours report
  for (const m of text.matchAll(CLOCK_RE)) {
    if (!a.allowedClockTimes.has(m[0])) {
      violations.push(`unsupported clock time: ${m[0]}`);
    }
  }
  // 4) banned claim phrases
  for (const { re, label } of BANNED_CLAIM_RES) {
    if (re.test(text)) violations.push(`banned claim phrase: ${label}`);
  }
  // 5) board/alight reversal checks per card (allowed-vocabulary reversal is
  //    the classic LLM failure these exist to catch)
  for (const card of a.allCards) {
    const boards = stopNameVariants(card.board_stop_name).map(escapeRe);
    const alights = stopNameVariants(card.alight_stop_name).map(escapeRe);
    const board = `(?:${boards.join("|")})`;
    const alight = `(?:${alights.join("|")})`;
    const patterns: Array<{ re: RegExp; label: string }> = [
      { re: new RegExp(`\\bboard(?:ing)?\\b[^.\\n]{0,25}${alight}`, "i"), label: "board used with alighting stop" },
      { re: new RegExp(`\\b(?:get on|hop on|sakay|sasakay|sumakay)\\b[^.\\n]{0,25}${alight}`, "i"), label: "ride-marker used with alighting stop" },
      { re: new RegExp(`\\balight(?:ing)?\\b[^.\\n]{0,25}${board}`, "i"), label: "alight used with boarding stop" },
      { re: new RegExp(`\\b(?:get off|get down|baba|bababa)\\b[^.\\n]{0,25}${board}`, "i"), label: "exit-marker used with boarding stop" },
    ];
    for (const { re, label } of patterns) {
      if (re.test(text)) violations.push(`reversed instruction (${card.leg_id}): ${label}`);
    }
  }
  // 6) conflict completeness: if any amount of a conflicted card is stated,
  //    all conflicting amounts and conflict wording must be present
  for (const card of a.conflictedCards) {
    const amounts = [...new Set(card.fares.flatMap((f) => [f.amount_min, f.amount_max]))];
    const present = amounts.filter((amt) =>
      new RegExp(`₱\\s?${amt}(?!\\d)|\\b${amt}\\s*pesos\\b`, "i").test(text),
    );
    if (present.length === 0) continue;
    const allPresent = amounts.every((amt) => present.includes(amt));
    if (!allPresent || !CONFLICT_WORD_RE.test(text)) {
      violations.push(
        `conflict hidden for ${card.leg_id}: stated [${present.join(",")}] of [${amounts.join(",")}]`,
      );
    }
  }
  return violations;
}

/** Full validation of a parsed unit against the bundle (schema + semantics). */
export function validateUnit(unit: ExplanationUnit, bundle: EvidenceBundle): UnitVerdict {
  if (KINDS_REQUIRE_REF.has(unit.kind) && !unit.cardRef)
    return { ok: false, reason: `${unit.kind} unit requires a cardRef` };
  if (unit.cardRef && !bundle.cards.some((c) => c.card_id === unit.cardRef))
    return { ok: false, reason: `cardRef '${unit.cardRef}' is not in the evidence bundle` };
  const violations = detectUnsupportedClaims(unit.text, bundle);
  if (violations.length > 0)
    return { ok: false, reason: `unsupported or contradictory claim: ${violations.join("; ")}` };
  return { ok: true, reason: "", unit };
}

export interface GuardedStreamResult {
  accepted: { index: number; unit: ExplanationUnit }[];
  rejected: { index: number; reason: string }[];
  displayed_text: string;
}

/** Buffer -> parse -> validate -> emit. Only accepted units may display. */
export function guardStream(rawUnits: string[], bundle: EvidenceBundle): GuardedStreamResult {
  const accepted: { index: number; unit: ExplanationUnit }[] = [];
  const rejected: { index: number; reason: string }[] = [];
  rawUnits.forEach((raw, index) => {
    const parsed = parseUnit(raw);
    if (!parsed.ok || !parsed.unit) {
      rejected.push({ index, reason: parsed.reason });
      return;
    }
    const checked = validateUnit(parsed.unit, bundle);
    if (checked.ok) accepted.push({ index, unit: parsed.unit });
    else rejected.push({ index, reason: checked.reason });
  });
  return {
    accepted,
    rejected,
    displayed_text: accepted.map((u) => u.unit.text).join(" "),
  };
}
