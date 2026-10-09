// T12 part B — stratified random sample of second_passed candidates for an independent AI audit.
//
//   node tools/corpus/ai-sample.mjs --summary          # sample sizes per kind, judged/remaining
//   node tools/corpus/ai-sample.mjs --batch <k>        # print batch k (0-based, ~20 items) for reading
//   node tools/corpus/ai-sample.mjs --next             # print the first batch with unjudged items
//
// Sampling (deterministic): second_passed candidates of each kind are sorted by candidate_id,
// shuffled with mulberry32(SEED + kind offset) Fisher–Yates, and the first QUOTA[kind] taken.
// SEED = 20261009. Quotas: ride 200, walk 60, fare all, hours ≤60, service_status all.
// Batch output contains source text and is for the reviewer's terminal only — never written to
// committed files. Verdicts go to data/raw/t12/ai-sample.jsonl (paraphrased notes only).
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
export const SEED = 20261009;
export const QUOTA = { ride: 200, walk: 60, fare: Infinity, hours: 60, service_status: Infinity };
export const SAMPLE_KINDS = Object.keys(QUOTA);
export const BATCH_SIZE = 20;

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @returns sampled candidate records, ordered by kind (SAMPLE_KINDS order) then sample order. */
export function drawSample(reviewed, seed = SEED, quota = QUOTA) {
  const out = [];
  SAMPLE_KINDS.forEach((kind, ki) => {
    const pool = reviewed
      .filter((r) => r.record_kind === kind && r.review_state === "second_passed")
      .sort((a, b) => (a.candidate_id < b.candidate_id ? -1 : 1));
    const rnd = mulberry32(seed + ki * 7919);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    out.push(...pool.slice(0, Math.min(pool.length, quota[kind])));
  });
  return out;
}

export const readJsonl = (f) =>
  existsSync(f) ? readFileSync(f, "utf8").split(/\r?\n/).filter((l) => l.trim()).map(JSON.parse) : [];

export function loadAll() {
  // Sample from the deterministic (pre-override) part-A states so the sample is stable after overrides.
  const reviewed = readJsonl(path.join(ROOT, "data/raw/t12/reviewed-candidates.jsonl")).map((r) =>
    r.ai_override ? { ...r, review_state: r.ai_override.prior_state } : r
  );
  const posts = JSON.parse(readFileSync(path.join(ROOT, "howtogetthereph_dataset/ncr_routes.json"), "utf8"));
  return { reviewed, posts };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { reviewed, posts } = loadAll();
  const postById = new Map(posts.map((p) => [p.id, p]));
  const byId = new Map(reviewed.map((r) => [r.candidate_id, r]));
  const sample = drawSample(reviewed);
  const judged = new Set(readJsonl(path.join(ROOT, "data/raw/t12/ai-sample.jsonl")).map((v) => v.candidate_id));
  const batches = [];
  for (let i = 0; i < sample.length; i += BATCH_SIZE) batches.push(sample.slice(i, i + BATCH_SIZE));
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };

  if (process.argv.includes("--summary")) {
    const s = {};
    for (const r of sample) { s[r.record_kind] ??= { sampled: 0, judged: 0 }; s[r.record_kind].sampled++; if (judged.has(r.candidate_id)) s[r.record_kind].judged++; }
    console.log(JSON.stringify({ seed: SEED, total: sample.length, batches: batches.length, judged: judged.size, by_kind: s }, null, 2));
  } else {
    let k = arg("--batch") != null ? Number(arg("--batch")) : batches.findIndex((b) => b.some((r) => !judged.has(r.candidate_id)));
    if (k < 0 || k >= batches.length) { console.log("no batch"); process.exit(0); }
    console.log(`=== batch ${k}/${batches.length - 1} ===`);
    for (const r of batches[k]) {
      const p = postById.get(r.post_id);
      const cited = r.comment_index == null ? `[QUESTION] ${p.question ?? ""}` : String(p.answers[r.comment_index]?.text ?? "");
      console.log(`\n--- ${r.candidate_id} [${r.record_kind}]${judged.has(r.candidate_id) ? " (judged)" : ""}`);
      console.log(`TITLE: ${p.title}`);
      if (r.comment_index != null) console.log(`Q: ${String(p.question ?? "").slice(0, 300).replace(/\s+/g, " ")}`);
      console.log(`PAYLOAD: ${JSON.stringify(r.candidate_payload)}`);
      const ride = r.candidate_payload.applies_to_ride ? byId.get(r.candidate_payload.applies_to_ride) : null;
      if (ride) console.log(`RIDE(${ride.candidate_id}, ci=${ride.comment_index}): ${JSON.stringify(ride.candidate_payload)}`);
      console.log(`TEXT: ${cited.replace(/\s+/g, " ").slice(0, 1600)}`);
    }
  }
}
