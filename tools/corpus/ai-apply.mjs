// T12 part B — apply the frozen AI evidence-audit verdicts to reviewed candidates.
//
//   node tools/corpus/ai-apply.mjs [--out <dir>] [--report-dir <dir>]
//
// Reads data/raw/t12/reviewed-candidates.jsonl + tools/corpus/ai-verdicts.json
// (frozen reader audit or heuristic rule screen, as identified by judge) and writes:
//   <out>/ai-sample.jsonl            one verdict line per sampled candidate
//   <out>/reviewed-candidates.jsonl  same records; the exception lines gain an
//                                    `ai_override` with quarantine reason and audit provenance
//   <out>/review-queue.{jsonl,md}    effective human queue, including overrides
//   <report-dir>/t12-evidence.{md,json}   regenerated with a "Part B" section
// This pass only quarantines (second_passed -> needs_review); it never sets
// accepted or rejected. Counts only in reports — no source text. Re-runs are
// byte-identical. Exit 0 ok, 1 validation failure, 2 usage error.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { drawSample, SEED, SAMPLE_KINDS } from "./ai-sample.mjs";
import { buildQueue, queueMd } from "./evidence.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const VERDICTS = path.join(HERE, "ai-verdicts.json");
const PART_B_HEADING = "## Part B — independent AI evidence audit";
const RULE_SCREEN_HEADING = "## Part B — heuristic rule screen";
const auditKind = (v) => /^heuristic(?:-|$)/i.test(v.judge ?? "") ? "rule_screen" : "source_audit";
// Overrides can only restrict eligibility; even malformed promotion overrides fail closed.
const effectiveState = (r) => r.review_state !== "second_passed" || !r.ai_override
  ? r.review_state : r.ai_override.new_state === "rejected" ? "rejected" : "needs_review";

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
export function applyVerdicts(sample, v) {
  checkVerdicts(sample, v);
  const kind = auditKind(v);
  const exc = new Map((v.exceptions ?? []).map((e) => [e.candidate_id, e]));
  const verdictLines = sample.map((r) => {
    const e = exc.get(r.candidate_id);
    return {
      candidate_id: r.candidate_id,
      record_kind: r.record_kind,
      post_id: r.post_id,
      comment_index: r.comment_index,
      verdict: e ? "needs_review" : kind === "rule_screen" ? "unflagged" : "supported",
      reason_code: e?.reason_code ?? null,
      note: e?.note ?? null,
      judged_at: v.judged_at,
      judge: v.judge,
      audit_kind: kind,
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
        judge: v.judge ?? null,
        audit_kind: kind,
      },
    };
    return { line: JSON.stringify(next), overridden: true };
  };
  return { verdictLines, applyLine };
}

// ---------- report ----------
const pct = (a, b) => (b ? +(100 * (a / b)).toFixed(1) : 0);
export function buildPartB(sample, v, effectiveTotals, { partATotals, partAQueue, effectiveQueue } = {}) {
  const kind = auditKind(v);
  const clearLabel = kind === "rule_screen" ? "unflagged" : "supported";
  const rateLabel = kind === "rule_screen" ? "flag_rate_pct" : "defect_rate_pct";
  const exc = new Map((v.exceptions ?? []).map((e) => [e.candidate_id, e]));
  const perKind = {};
  for (const k of SAMPLE_KINDS) perKind[k] = { sampled: 0, [clearLabel]: 0, flagged: 0, [rateLabel]: 0 };
  for (const r of sample) {
    const t = perKind[r.record_kind];
    t.sampled++;
    if (exc.has(r.candidate_id)) t.flagged++;
    else t[clearLabel]++;
  }
  for (const k of SAMPLE_KINDS) perKind[k][rateLabel] = pct(perKind[k].flagged, perKind[k].sampled);
  const byReason = {};
  for (const e of v.exceptions ?? []) byReason[e.reason_code] = (byReason[e.reason_code] ?? 0) + 1;
  const sortedReasons = Object.fromEntries(
    Object.entries(byReason).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  );
  return {
    seed: SEED,
    judge: v.judge ?? null,
    audit_kind: kind,
    judged_at: v.judged_at,
    sample_size: sample.length,
    [clearLabel]: sample.length - (v.exceptions ?? []).length,
    flagged: (v.exceptions ?? []).length,
    per_kind: perKind,
    flagged_by_reason_code: sortedReasons,
    effective_review_state_totals: effectiveTotals,
    part_a_review_state_totals: partATotals,
    part_a_queue: partAQueue,
    effective_queue: effectiveQueue,
    // The judging pass owns the narrative: a hand pass and the heuristic pass draw
    // different conclusions from the same counts.
    notes: kind === "rule_screen" ? [
      "Part B is a deterministic heuristic rule screen, not an independent source-reading audit.",
      "Unflagged means no rule fired; the source was not judged supported. Flag rates measure rule hits, not source-confirmed defect rates or value-semantics conclusions.",
      "Rules can miss defects; every override remains quarantined for the designated human reviewer. This pass never sets accepted or rejected.",
    ] : v.report_notes ?? [
      "This pass only quarantines: it never set accepted or rejected, so the designated human reviewer still owns every queued item.",
      "The deterministic part-A pass held up well for ride and walk records but was systematically weak on fare and hours value semantics, where almost all defects concentrate.",
      "The dominant failure modes are open-ended or approximate amounts recorded as exact, fares carrying no ride scope, and clock values hardened out of hedged or asker-supplied statements.",
    ],
  };
}

function partBMd(b) {
  const heuristic = b.audit_kind === "rule_screen";
  const clearLabel = heuristic ? "unflagged" : "supported";
  const rateLabel = heuristic ? "flag_rate_pct" : "defect_rate_pct";
  const row = (...c) => `| ${c.join(" | ")} |`;
  const L = [
    heuristic ? RULE_SCREEN_HEADING : PART_B_HEADING,
    "",
    `${heuristic ? "Deterministic rule screen" : "Independent audit"} of ${b.sample_size} sampled candidates (seed ${b.seed}, judge \`${b.judge}\`): ${b[clearLabel]} ${clearLabel}, ${b.flagged} flagged to needs_review. Counts only; no source text.`,
    "",
    row("record_kind", "sampled", clearLabel, "flagged", heuristic ? "flag_rate" : "defect_rate"),
    row("---", "---:", "---:", "---:", "---:"),
    ...Object.entries(b.per_kind).map(([k, t]) => row(k, t.sampled, t[clearLabel], t.flagged, `${t[rateLabel]}%`)),
    "",
    "Flagged by reason_code:",
    "",
    row("reason_code", "count"),
    row("---", "---:"),
    ...Object.entries(b.flagged_by_reason_code).map(([k, n]) => row(k, n)),
    "",
    `Effective review-state totals after overrides: ${Object.entries(b.effective_review_state_totals).map(([k, n]) => `${k} ${n}`).join(", ")}.`,
    "",
    `Part-A review-state totals (before overrides): ${Object.entries(b.part_a_review_state_totals ?? {}).map(([k, n]) => `${k} ${n}`).join(", ")}.`,
    "",
    `Part-A queue (before overrides): ${b.part_a_queue?.posts ?? 0} posts / ${b.part_a_queue?.items ?? 0} items. The part-A counts above remain separate from the effective queue artifacts.`,
    "",
    `Effective human review queue: ${b.effective_queue?.posts ?? 0} posts / ${b.effective_queue?.items ?? 0} items (${b.effective_queue?.posts_with_route_critical_items ?? 0} posts with route-critical items), including ${b.effective_queue?.override_items ?? 0} override items. Rebuilt data/raw/t12/review-queue.{jsonl,md} includes all effective items and their override reason codes.`,
    "",
    "Queued overrides by reason_code:",
    "",
    row("reason_code", "items"),
    row("---", "---:"),
    ...Object.entries(b.effective_queue?.override_by_reason_code ?? {}).map(([k, n]) => row(k, n)),
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
  posts = null,
  seed = SEED,
} = {}) {
  const reviewedFile = path.join(out, "reviewed-candidates.jsonl");
  const lines = readFileSync(reviewedFile, "utf8").split(/\r?\n/).filter((l) => l.trim());
  reviewed ??= lines.map((l) => JSON.parse(l));
  posts ??= JSON.parse(readFileSync(path.join(ROOT, "howtogetthereph_dataset/ncr_routes.json"), "utf8"));
  const sample = drawSample(reviewed, seed);
  const v = JSON.parse(readFileSync(verdictsPath, "utf8"));
  const { verdictLines, applyLine } = applyVerdicts(sample, v);

  let overridden = 0;
  const newLines = lines.map((l) => {
    const r = applyLine(l);
    if (r.overridden) overridden++;
    return r.line;
  });
  const effTotals = {};
  const baseTotals = {};
  const effective = newLines.map((l) => {
    const r = JSON.parse(l);
    baseTotals[r.review_state] = (baseTotals[r.review_state] ?? 0) + 1;
    const s = effectiveState(r);
    effTotals[s] = (effTotals[s] ?? 0) + 1;
    const reason = s === "needs_review" && r.ai_override ? r.ai_override.reason_code : null;
    return { ...r, review_state: s, review_reason: [r.review_reason, reason].filter(Boolean).join(",") || null };
  });
  const queue = buildQueue(posts, effective);
  const baseQueue = buildQueue(posts, newLines.map((l) => {
    const { ai_override, ...r } = JSON.parse(l);
    return r;
  }));
  const queueStats = (q) => ({
    posts: q.length,
    items: q.reduce((n, p) => n + p.items.length, 0),
    posts_with_route_critical_items: q.filter((p) => p.route_critical_items > 0).length,
  });
  const queuedOverrides = effective.filter((r) => r.review_state === "needs_review" && r.ai_override);
  const overrideReasons = {};
  for (const r of queuedOverrides) {
    const reason = r.ai_override.reason_code;
    overrideReasons[reason] = (overrideReasons[reason] ?? 0) + 1;
  }
  const partB = buildPartB(sample, v, effTotals, {
    partATotals: baseTotals,
    partAQueue: queueStats(baseQueue),
    effectiveQueue: { ...queueStats(queue), override_items: queuedOverrides.length,
      override_by_reason_code: Object.fromEntries(Object.entries(overrideReasons).sort(([a], [b]) => a.localeCompare(b))) },
  });

  mkdirSync(out, { recursive: true });
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(path.join(out, "ai-sample.jsonl"), jsonl(verdictLines));
  writeFileSync(reviewedFile, newLines.join("\n") + "\n");
  writeFileSync(path.join(out, "review-queue.jsonl"), jsonl(queue));
  // Include the full queue so no override item is hidden below the part-A digest limit.
  writeFileSync(path.join(out, "review-queue.md"), queueMd(queue, queue.length));

  const mdFile = path.join(reportDir, "t12-evidence.md");
  const md = readFileSync(mdFile, "utf8");
  // Replace historical audit headings and current rule-screen headings on reruns.
  const head = md.split(/^## Part B(?:\s|$)/m)[0].replace(/\s+$/, "") + "\n\n";
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
    const clearLabel = r.partB.audit_kind === "rule_screen" ? "unflagged" : "supported";
    console.log(`T12 part B applied — sample ${r.partB.sample_size}, ${clearLabel} ${r.partB[clearLabel]}, flagged ${r.partB.flagged}; ` +
      `${r.overridden} ai_override records of ${r.lines}`);
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(1);
  }
}
