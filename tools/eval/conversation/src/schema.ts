/**
 * Fixture schemas and corpus validation for the T35 conversation/grounding
 * evaluation harness. Validations enforced here:
 *  - corpus sizes (>=50 intent cases with a held-out split, >=100 adversarial cases)
 *  - unique IDs and well-formed expectations
 *  - held-out wording genuinely paraphrases the train split (token Jaccard cap)
 *  - INV-4 hygiene scan: no raw-source wording markers (usernames / platform refs)
 */

export type Split = "train" | "held_out";

export interface IntentExpectation {
  intent: string;
  behaviour: string;
  slots: Record<string, string>;
  required_slots: string[];
}

export interface IntentCase {
  id: string;
  split: Split;
  query: string;
  trip_state: string;
  paraphrase_group: string;
  expected: IntentExpectation;
}

export type AdversarialCategory =
  | "unknown_values"
  | "conflicting_reports"
  | "unrelated_input"
  | "stream_unit_rejection"
  | "source_instruction_injection"
  | "invented_fact_bait"
  | "reversed_instruction_bait";

export interface AdversarialExpectation {
  behaviour?: string;
  accepted_indexes?: number[];
  must_contain?: string[];
  must_not_contain?: string[];
  must_not_regex?: string[];
  must_order?: string[];
}

export interface AdversarialCase {
  id: string;
  category: AdversarialCategory;
  mode: "query" | "stream";
  trip_state: string;
  rationale: string;
  query?: string;
  raw_units?: string[];
  expected: AdversarialExpectation;
}

export const CATEGORIES: AdversarialCategory[] = [
  "unknown_values",
  "conflicting_reports",
  "unrelated_input",
  "stream_unit_rejection",
  "source_instruction_injection",
  "invented_fact_bait",
  "reversed_instruction_bait",
];

export const MIN_INTENT_CASES = 50;
export const MIN_ADVERSARIAL_CASES = 100;
/** Max token-set Jaccard between any held-out and any train query. */
export const MAX_PARAPHRASE_JACCARD = 0.55;

/** INV-4 hygiene: markers that should never appear in synthetic fixtures. */
const INV4_PATTERNS: RegExp[] = [
  /\breddit\b/i,
  /\bupvotes?\b/i,
  /\bdownvotes?\b/i,
  /\bu\/[A-Za-z0-9_-]{2,}/,
  /\br\/[A-Za-z0-9_-]{2,}/,
  /\bOP said\b/,
];

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface CorpusValidation {
  errors: string[];
  warnings: string[];
  stats: {
    intent_total: number;
    intent_train: number;
    intent_held_out: number;
    adversarial_total: number;
    adversarial_by_category: Record<string, number>;
    max_held_out_jaccard: number;
    inv4_hits: string[];
  };
}

export function validateCorpora(
  intentCases: IntentCase[],
  adversarialCases: AdversarialCase[],
  tripStates: string[],
): CorpusValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tripStateSet = new Set(tripStates);

  // --- intent corpus basics ---
  const ids = new Set<string>();
  let train = 0;
  let heldOut = 0;
  for (const c of intentCases) {
    if (ids.has(c.id)) errors.push(`duplicate intent case id ${c.id}`);
    ids.add(c.id);
    if (!/^INT-/.test(c.id)) errors.push(`${c.id}: intent id must start with INT-`);
    if (c.split !== "train" && c.split !== "held_out")
      errors.push(`${c.id}: invalid split ${String(c.split)}`);
    if (c.split === "train") train += 1;
    else heldOut += 1;
    if (!c.query || !c.query.trim()) errors.push(`${c.id}: empty query`);
    if (!tripStateSet.has(c.trip_state))
      errors.push(`${c.id}: unknown trip_state ${c.trip_state}`);
    if (!c.expected?.intent || !c.expected?.behaviour)
      errors.push(`${c.id}: missing expected intent/behaviour`);
    for (const req of c.expected?.required_slots ?? []) {
      if (!(req in (c.expected?.slots ?? {})))
        errors.push(`${c.id}: required_slot '${req}' missing from slots`);
    }
  }
  if (intentCases.length < MIN_INTENT_CASES)
    errors.push(
      `intent corpus too small: ${intentCases.length} < ${MIN_INTENT_CASES}`,
    );
  if (train === 0 || heldOut === 0)
    errors.push("intent corpus must contain both train and held_out splits");
  if (heldOut < train)
    warnings.push(
      `held_out split (${heldOut}) is smaller than train split (${train})`,
    );

  // --- paraphrase novelty: every held-out query must be far from every train query ---
  let maxJ = 0;
  let maxJPair = "";
  const trainTokens = intentCases
    .filter((c) => c.split === "train")
    .map((c) => ({ id: c.id, t: tokens(c.query) }));
  for (const c of intentCases.filter((x) => x.split === "held_out")) {
    const ct = tokens(c.query);
    for (const tr of trainTokens) {
      const j = jaccard(ct, tr.t);
      if (j > maxJ) {
        maxJ = j;
        maxJPair = `${c.id} vs ${tr.id}`;
      }
      if (j >= MAX_PARAPHRASE_JACCARD)
        errors.push(
          `${c.id}: held-out wording too close to train ${tr.id} (Jaccard ${j.toFixed(2)} >= ${MAX_PARAPHRASE_JACCARD}) — held-out cases must genuinely paraphrase`,
        );
    }
  }
  if (maxJPair) warnings.push(`max held-out/train Jaccard ${maxJ.toFixed(2)} (${maxJPair})`);

  // --- adversarial corpus basics ---
  const byCategory: Record<string, number> = {};
  for (const c of adversarialCases) {
    if (ids.has(c.id)) errors.push(`duplicate case id ${c.id}`);
    ids.add(c.id);
    if (!CATEGORIES.includes(c.category))
      errors.push(`${c.id}: invalid category ${String(c.category)}`);
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    if (!tripStateSet.has(c.trip_state))
      errors.push(`${c.id}: unknown trip_state ${c.trip_state}`);
    if (c.mode === "query" && !c.query) errors.push(`${c.id}: query mode needs query`);
    if (c.mode === "stream" && !(c.raw_units?.length))
      errors.push(`${c.id}: stream mode needs raw_units`);
    if (c.mode === "stream" && !c.expected.accepted_indexes)
      errors.push(`${c.id}: stream case needs expected.accepted_indexes`);
    if (c.mode === "query" && !c.expected.behaviour)
      errors.push(`${c.id}: query case needs expected.behaviour`);
  }
  if (adversarialCases.length < MIN_ADVERSARIAL_CASES)
    errors.push(
      `adversarial corpus too small: ${adversarialCases.length} < ${MIN_ADVERSARIAL_CASES}`,
    );
  for (const cat of CATEGORIES) {
    if ((byCategory[cat] ?? 0) === 0) errors.push(`no adversarial cases for ${cat}`);
  }

  // --- INV-4 hygiene scan over fixture text ---
  const inv4Hits: string[] = [];
  const scan = (label: string, text: string) => {
    for (const re of INV4_PATTERNS) {
      const m = re.exec(text);
      if (m) inv4Hits.push(`${label}: '${m[0]}'`);
    }
  };
  for (const c of intentCases) scan(c.id, c.query);
  for (const c of adversarialCases) {
    if (c.query) scan(c.id, c.query);
    if (c.raw_units) scan(c.id, c.raw_units.join("\n"));
  }
  if (inv4Hits.length > 0)
    errors.push(`INV-4 hygiene hits in fixtures: ${inv4Hits.join("; ")}`);

  return {
    errors,
    warnings,
    stats: {
      intent_total: intentCases.length,
      intent_train: train,
      intent_held_out: heldOut,
      adversarial_total: adversarialCases.length,
      adversarial_by_category: byCategory,
      max_held_out_jaccard: Number(maxJ.toFixed(3)),
      inv4_hits: inv4Hits,
    },
  };
}
