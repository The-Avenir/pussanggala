// T12 part B — apply the frozen AI evidence-audit verdicts to reviewed candidates.
//
//   node tools/corpus/ai-apply.mjs [--out <dir>] [--report-dir <dir>]
//
// Reads data/raw/t12/reviewed-candidates.jsonl + tools/corpus/ai-verdicts.json
// (authoritative; judged by the lead against the cited source text) and writes:
//   <out>/ai-sample.jsonl            one verdict line per sampled candidate
//   <out>/reviewed-candidates.jsonl  same records; the exception lines gain an
//                                    `ai_override` {prior_state,new_state,reason_code,note,judged_at}
//   <report-dir>/t12-evidence.{md,json}   regenerated with a "Part B" section
// This pass only quarantines (second_passed -> needs_review); it never sets
// accepted or rejected. Counts only in reports — no source text. Re-runs are
// byte-identical. Exit 0 ok, 1 validation failure, 2 usage error.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { drawSample, SEED, SAMPLE_KINDS, loadAll } from "./ai-sample.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const VERDICTS = path.join(HERE, "ai-verdicts.json");
const PART_B_HEADING = "## Part B — independent AI evidence audit";

// ---------- validation (pure; throws with offender ids only) ----------
export function checkVerdicts(sample, v) {
  const bad = [];
  if (v.seed !== SEED) bad.push(`seed ${v.seed} != SEED ${SEED}`);
  if (v.sample_size !== sample.length) bad.push(`sample_size ${v.sample_size} != live sample ${sample.length}`);
  const inSample = new Map(sample.map((r) => [r.candidate_id, r]));
  const seen = new Set();
  for (const e of v.exceptions ?? []) {
    if (seen.has(e.candidate_id)) bad.push(`duplicate exception ${e.candidate_id}`);
    seen.add(e.candidate_id);
    const s = inSample.get(e.candidate_id);
    if (!s) { bad.push(`exception ${e.candidate_id} not in sample`); continue; }
    if (e.record_kind !== s.record_kind) bad.push(`exception ${e.candidate_id} record_kind ${e.record_kind} != sampled ${s.record_kind}`);
    if (!(e.reason_code in (v.reason_codes ?? {}))) bad.push(`exception ${e.candidate_id} unknown reason_code ${e.reason_code}`);
    if (e.new_state !== "needs_review") bad.push(`exception ${e.candidate_id} new_state ${e.new_state}`);
  }
  if (bad.length) throw new Error(`ai-verdicts validation failed:\n  ${bad.join("\n  ")}`);
}

// ---------- core ----------
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";

/** @returns {verdictLines, applyLine(line)} — applyLine adds ai_override to exceptions. */
export function applyVerdicts(sample, v, reviewedRaw) {
  checkVerdicts(sample, v);
  const exc = new Map((v.exceptions ?? []).map((e) => [e.candidate_id, e]));
  const verdictLines = sample.map((r) => {
    const e = exc.get(r.candidate_id);
    return {
      candidate_id: r.candidate_id,
      record_kind: r.record_kind,
      post_id: r.post_id,
      comment_index: r.comment_index,
      verdict: e ? "needs_review" : "supported",
      reason_code: e?.reason_code ?? null,
      note: e?.note ?? null,
      judged_at: v.judged_at,
      judge: v.judge,
    };
  });
  const applyLine = (line) => {
    const r = JSON.parse(line);
    const e = exc.get(r.candidate_id);
    if (!e) return { line, overridden: false };
    if (r.review_state !== "second_passed")
      throw new Error(`ai_override on ${r.candidate_id}: prior review_state is ${r.review_state}, expected second_passed`);
    const next = {
      ...r,
      ai_override: {
        prior_state: r.review_state,
        new_state: e.new_state,
        reason_code: e.reason_code,
        note: e.note,
        judged_at: v.judged_at,
      },
    };
    return { line: JSON.stringify(next), overridden: true };
  };
  return { verdictLines, applyLine };
}

// ---------- report ----------
const pct = (a, b) => (b ? +(100 * (a / b)).toFixed(1) : 0);
export function buildPartB(sample, v, effectiveTotals) {
  const exc = new Map((v.exceptions ?? []).map((e) => [e.candidate_id, e]));
  const perKind = {};
  for (const k of SAMPLE_KINDS) perKind[k] = { sampled: 0, supported: 0, flagged: 0, defect_rate_pct: 0 };
  for (const r of sample) {
    const t = perKind[r.record_kind];
    t.sampled++;
    if (exc.has(r.candidate_id)) t.flagged++;
    else t.supported++;
  }
  for (const k of SAMPLE_KINDS) perKind[k].defect_rate_pct = pct(perKind[k].flagged, perKind[k].sampled);
  const byReason = {};
  for (const e of v.exceptions ?? []) byReason[e.reason_code] = (byReason[e.reason_code] ?? 0) + 1;
  const sortedReasons = Object.fromEntries(
    Object.entries(byReason).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  );
  return {
    seed: SEED,
    judge: v.judge ?? null,
    sample_size: sample.length,
    supported: sample.length - (v.exceptions ?? []).length,
    flagged: (v.exceptions ?? []).length,
    per_kind: perKind,
    flagged_by_reason_code: sortedReasons,
    effective_review_state_totals: effectiveTotals,
    // The judging pass owns the narrative: a hand pass and the heuristic pass draw
    // different conclusions from the same counts.
    notes: v.report_notes ?? [
      "This pass only quarantines: it never set accepted or rejected, so the designated human reviewer still owns every queued item.",
      "The deterministic part-A pass held up well for ride and walk records but was systematically weak on fare and hours value semantics, where almost all defects concentrate.",
      "The dominant failure modes are open-ended or approximate amounts recorded as exact, fares carrying no ride scope, and clock values hardened out of hedged or asker-supplied statements.",
    ],
  };
}

function partBMd(b) {
  const row = (...c) => `| ${c.join(" | ")} |`;
  const L = [
    PART_B_HEADING,
    "",
    `Independent audit of ${b.sample_size} sampled candidates (seed ${b.seed}, judge \`${b.judge}\`): ${b.supported} supported, ${b.flagged} flagged to needs_review. Counts only; no source text.`,
    "",
    row("record_kind", "sampled", "supported", "flagged", "defect_rate"),
    row("---", "---:", "---:", "---:", "---:"),
    ...Object.entries(b.per_kind).map(([k, t]) => row(k, t.sampled, t.supported, t.flagged, `${t.defect_rate_pct}%`)),
    "",
    "Flagged by reason_code:",
    "",
    row("reason_code", "count"),
    row("---", "---:"),
    ...Object.entries(b.flagged_by_reason_code).map(([k, n]) => row(k, n)),
    "",
    `Effective review-state totals after overrides: ${Object.entries(b.effective_review_state_totals).map(([k, n]) => `${k} ${n}`).join(", ")}.`,
    "",
    ...b.notes.map((s) => `- ${s}`),
    "",
  ];
  return L.join("\n");
}

// ---------- CLI ----------
export function run({
  out = path.join(ROOT, "data/raw/t12"),
  reportDir = path.join(HERE, "reports"),
  verdictsPath = VERDICTS,
  reviewed = null,
  seed = SEED,
} = {}) {
  reviewed ??= loadAll().reviewed;
  const sample = drawSample(reviewed, seed);
  const v = JSON.parse(readFileSync(verdictsPath, "utf8"));
  const { verdictLines, applyLine } = applyVerdicts(sample, v);

  const reviewedFile = path.join(out, "reviewed-candidates.jsonl");
  const lines = readFileSync(reviewedFile, "utf8").split(/\r?\n/).filter((l) => l.trim());
  let overridden = 0;
  const newLines = lines.map((l) => {
    const r = applyLine(l);
    if (r.overridden) overridden++;
    return r.line;
  });
  const effTotals = {};
  for (const l of newLines) {
    const r = JSON.parse(l);
    const s = r.ai_override ? r.ai_override.new_state : r.review_state;
    effTotals[s] = (effTotals[s] ?? 0) + 1;
  }
  const partB = buildPartB(sample, v, effTotals);

  mkdirSync(out, { recursive: true });
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(path.join(out, "ai-sample.jsonl"), jsonl(verdictLines));
  writeFileSync(reviewedFile, newLines.join("\n") + "\n");

  const mdFile = path.join(reportDir, "t12-evidence.md");
  const md = readFileSync(mdFile, "utf8");
  const head = md.split(`\n${PART_B_HEADING}`)[0].replace(/\s+$/, "") + "\n\n";
  writeFileSync(mdFile, head + partBMd(partB));

  const jsonFile = path.join(reportDir, "t12-evidence.json");
  const j = JSON.parse(readFileSync(jsonFile, "utf8"));
  delete j.part_b;
  j.part_b = partB;
  writeFileSync(jsonFile, JSON.stringify(j, null, 2) + "\n");
  return { partB, overridden, lines: lines.length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? path.resolve(process.argv[i + 1]) : undefined; };
  if (process.argv.includes("--help")) { console.log("node tools/corpus/ai-apply.mjs [--out dir] [--report-dir dir]"); process.exit(0); }
  try {
    const r = run({ out: arg("--out"), reportDir: arg("--report-dir") });
    console.log(`T12 part B applied — sample ${r.partB.sample_size}, supported ${r.partB.supported}, flagged ${r.partB.flagged}; ` +
      `${r.overridden} ai_override records of ${r.lines}`);
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(1);
  }
}
