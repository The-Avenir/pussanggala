// T12 part B — deterministic heuristic judge over the T11 sample.
//
//   node tools/corpus/ai-heuristic.mjs [--out <file>]   # regenerate ai-verdicts.json
//   node tools/corpus/ai-heuristic.mjs --explain        # per-rule hit counts, no write
//
// Replaces the hand-judged verdicts that targeted the historical extractor IDs.
// Every exception is produced by a rule below, so the file is reproducible from
// the snapshot alone: same snapshot + same seed => byte-identical ai-verdicts.json.
// Rules are deliberately high-precision and low-recall — a miss leaves a record in
// its part-A state for the human reviewer, a false flag only adds review work.
// Like the hand pass this only quarantines (second_passed -> needs_review); it
// never sets accepted or rejected. Notes are rule descriptions, never source text.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { drawSample, SEED, loadAll } from "./ai-sample.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const JUDGE = "heuristic-part-B";
export const JUDGED_AT = "2026-10-10T00:00:00Z";

// Reason codes are carried over verbatim from the hand-judged part-B taxonomy so the
// two passes stay comparable; only the subset a rule can decide deterministically is used.
export const REASON_CODES = {
  fare_unscoped: "Amount is attached to no ride, so its scope cannot be checked.",
  fare_open_range_as_exact: "Source gives an open lower bound; recorded as an exact amount.",
  fare_approximate_as_exact: "Source qualifies the amount as approximate; recorded as exact.",
  fare_hedged: "Source marks the amount as uncertain.",
  hours_text_adds_unsourced_detail: "Paraphrase adds a claim absent from the cited text.",
  hours_guess_hardened: "Explicitly guessed time recorded as a concrete clock field.",
  hours_hearsay_in_question: "Time relayed as hearsay by a commenter who is asking whether it is true.",
  board_place_not_a_place: "Board field holds a mode token rather than a boarding location.",
  walk_text_adds_unsourced_duration: "Paraphrase asserts a duration absent from the cited text.",
};

export const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Cited text for a candidate: the answer it came from, or title+question when comment_index is null. */
export function citedText(record, post) {
  if (!post) return "";
  return record.comment_index == null
    ? norm(`${post.title ?? ""} ${post.question ?? ""}`)
    : norm(post.answers?.[record.comment_index]?.text ?? "");
}

export const sentences = (t) => t.split(/(?<=[.!?])\s+/).filter((s) => s.trim());

/** Text immediately before/after each standalone occurrence of `n`. */
export function amountWindows(text, n, before = 30, after = 18) {
  const out = [];
  const re = new RegExp(`(?<!\\d)${n}(?!\\d)`, "g");
  for (let m; (m = re.exec(text)); ) {
    const end = m.index + String(n).length;
    out.push({ pre: text.slice(Math.max(0, m.index - before), m.index), post: text.slice(end, end + after) });
  }
  return out;
}

// ---- fare markers: must sit adjacent to the recorded amount, modulo currency/filler ----
const OPEN_PRE = /\b(at ?least|atleast|minimum|min|starting|starts? at|simula|mula)\s*(of|sa|at)?\s*[₱p]?\s*$/i;
const OPEN_POST = /^\s*(php|pesos?|piso)?\s*(\+|up\b|pataas|onwards?\b|or more|above|or higher)/i;
const APPROX_PRE = /\b(around|about|approx\w*|roughly|more or less|nasa|humigit|mga|~)\s*(na|sa)?\s*[₱p]?\s*$/i;
const HEDGE_POST = /^\s*\(?\s*(php|pesos?|piso)?\s*\?/i;
const HEDGE_PRE = /\b(by experience|i think|i guess|not sure|afaik|iirc|siguro|yata|parang|baka|tingin ko|last i (checked|rode|asked))\b[^.?!]{0,25}$/i;

// ---- hours markers ----
const CLOCK = /24\s*\/\s*7|24\s*(hrs?|hours)\b|\d{1,2}\s*[:.]\s*\d{2}|\d{1,2}\s*(am|pm|nn|mn)\b/i;
const ALL_DAY_NEGATED = /\b(hindi|hinde|di|not|wala|no)\b[^.?!]{0,15}(24\s*\/\s*7|24\s*(hrs?|hours)\b)/i;
const CONDITIONAL = /\b(as long as|basta|kung may|kung meron|pag may|depende|depends on)\b/i;
const HOURS_HEDGE = /\bmga\s+\d|\b(madalang|minsan|siguro|yata|parang|baka|i think|i guess|not sure|afaik|iirc|by experience)\b|\b(from the )?last time i\b/i;

// ---- ride / walk markers ----
const BARE_MODE = /^(h\s+)?(jeep|jeepney|bus|trike|tricycle|uv|uv express|e-?jeep|e-?trike|taxi|grab|van|fx|pedicab|habal(-habal)?)$/i;
const WALK_NUM_SOURCED =
  /\d{1,3}\s*(min\w*|m\b|meters?|metro)[^.?!]{0,12}(walk|lakad|hakbang)|\b(walk|lakad|hakbang)\w*[^.?!]{0,12}\d{1,3}\s*(min\w*|m\b|meters?|metro)/i;

/**
 * Decide one sampled candidate against its cited text.
 * @returns {string|null} reason_code, or null when no rule fires (judged supported).
 */
export function judgeRecord(record, text) {
  const pl = record.candidate_payload ?? {};

  if (record.record_kind === "fare") {
    if (pl.applies_to_ride == null) return "fare_unscoped";
    const exact = pl.amount_min != null && pl.amount_min === pl.amount_max;
    if (!exact) return null;
    const w = amountWindows(text, pl.amount_min);
    if (w.some((x) => OPEN_PRE.test(x.pre) || OPEN_POST.test(x.post))) return "fare_open_range_as_exact";
    if (w.some((x) => APPROX_PRE.test(x.pre))) return "fare_approximate_as_exact";
    if (w.some((x) => HEDGE_POST.test(x.post) || HEDGE_PRE.test(x.pre))) return "fare_hedged";
    return null;
  }

  if (record.record_kind === "hours") {
    const hasClock = pl.starts_local != null || pl.ends_local != null;
    if (!hasClock) return null;
    const s = sentences(text).find((x) => CLOCK.test(x));
    if (!s) return null;
    if (/\?/.test(s)) return "hours_hearsay_in_question";
    if (ALL_DAY_NEGATED.test(s) || CONDITIONAL.test(s)) return "hours_text_adds_unsourced_detail";
    if (HOURS_HEDGE.test(s)) return "hours_guess_hardened";
    return null;
  }

  if (record.record_kind === "ride") {
    if (BARE_MODE.test(norm(pl.board_place)) || BARE_MODE.test(norm(pl.alight_place))) return "board_place_not_a_place";
    return null;
  }

  if (record.record_kind === "walk") {
    const claimsNumber = pl.walk_min != null || pl.walk_m != null;
    if (claimsNumber && !WALK_NUM_SOURCED.test(text)) return "walk_text_adds_unsourced_duration";
    return null;
  }

  return null;
}

/** @returns the full ai-verdicts.json object for a sample, in sample order. */
export function buildVerdicts(sample, postById) {
  const exceptions = [];
  for (const r of sample) {
    const code = judgeRecord(r, citedText(r, postById.get(r.post_id)));
    if (!code) continue;
    exceptions.push({
      candidate_id: r.candidate_id,
      record_kind: r.record_kind,
      new_state: "needs_review",
      reason_code: code,
      note: REASON_CODES[code],
    });
  }
  const used = Object.fromEntries(Object.entries(REASON_CODES).filter(([k]) => exceptions.some((e) => e.reason_code === k)));
  return {
    task: "T12 part B",
    seed: SEED,
    sample_size: sample.length,
    judged_at: JUDGED_AT,
    judge: JUDGE,
    policy:
      "Heuristic re-sample (tools/corpus/ai-heuristic.mjs) after T11 candidate IDs changed. Each sampled candidate was " +
      "matched against deterministic rules for the defect classes the hand-judged pass found — open-ended fares, " +
      "approximate or hedged fares, unscoped fares, hedged or interrogative hours, mode tokens in place fields, and " +
      "unsourced walk durations. Rules are high-precision and low-recall: candidates absent from `exceptions` were not " +
      "cleared by a reader, they simply matched no rule, and keep their part-A state. Exceptions move second_passed -> " +
      "needs_review only; this pass never sets accepted or rejected, so the designated human reviewer still owns every " +
      "queued item (CONTRACT.md 'Review states').",
    reason_codes: used,
    report_notes: [
      "Part B was regenerated by the deterministic heuristic judge (heuristic-part-B), not by a reader: the hand-judged verdicts targeted the historical extractor IDs and no longer intersect the current T11 sample.",
      "This pass only quarantines: it never set accepted or rejected, so the designated human reviewer still owns every queued item.",
      "Rules are high-precision and low-recall, so `supported` here means \"matched no defect rule\", not \"read and confirmed against the source\". Treat the defect rates as a lower bound.",
      "Defects concentrate in fare and hours value semantics, as in the hand-judged pass: amounts carrying no ride scope, amounts recorded as exact from approximate or hedged text, and clock values hardened out of hedged, conditional or interrogative statements.",
    ],
    exceptions,
  };
}

// ---------- CLI ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const i = process.argv.indexOf("--out");
  const outFile = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(HERE, "ai-verdicts.json");
  const { reviewed, posts } = loadAll();
  const sample = drawSample(reviewed);
  const v = buildVerdicts(sample, new Map(posts.map((p) => [p.id, p])));

  const byCode = {};
  for (const e of v.exceptions) byCode[e.reason_code] = (byCode[e.reason_code] ?? 0) + 1;
  const byKind = {};
  const flagged = new Set(v.exceptions.map((e) => e.candidate_id));
  for (const r of sample) {
    byKind[r.record_kind] ??= { sampled: 0, flagged: 0 };
    byKind[r.record_kind].sampled++;
    if (flagged.has(r.candidate_id)) byKind[r.record_kind].flagged++;
  }
  if (process.argv.includes("--explain")) {
    console.log(JSON.stringify({ sample_size: sample.length, flagged: v.exceptions.length, by_kind: byKind, by_reason_code: byCode }, null, 2));
  } else {
    writeFileSync(outFile, JSON.stringify(v, null, 2) + "\n");
    console.log(`wrote ${path.relative(process.cwd(), outFile)} — sample ${sample.length}, flagged ${v.exceptions.length}`);
    console.log(JSON.stringify(byCode, null, 2));
  }
}
