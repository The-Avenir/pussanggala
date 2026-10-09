// node --test tools/corpus/evidence.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { run, evaluate, SNAPSHOT_SHA256 } from "./evidence.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const FILES = ["reviewed-candidates.jsonl", "review-queue.jsonl", "review-queue.md"];
const REPORTS = ["t12-evidence.json", "t12-evidence.md"];

// One shared pair of runs into temp dirs (does not touch committed reports).
const tmpA = mkdtempSync(path.join(tmpdir(), "t12a-"));
const tmpB = mkdtempSync(path.join(tmpdir(), "t12b-"));
run({ out: tmpA, reportDir: tmpA });
run({ out: tmpB, reportDir: tmpB });
const reviewed = readFileSync(path.join(tmpA, "reviewed-candidates.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
process.on("exit", () => { rmSync(tmpA, { recursive: true, force: true }); rmSync(tmpB, { recursive: true, force: true }); });

test("two runs are byte-identical", () => {
  for (const f of [...FILES, ...REPORTS])
    assert.ok(readFileSync(path.join(tmpA, f)).equals(readFileSync(path.join(tmpB, f))), `${f} differs between runs`);
});

test("every candidate reviewed; none accepted; reviewer fields null", () => {
  assert.ok(reviewed.length > 0, "expected regenerated T11 candidates");
  assert.equal(reviewed.length, new Set(reviewed.map((r) => r.candidate_id)).size);
  assert.equal(new Set(reviewed.map((r) => r.candidate_id)).size, reviewed.length);
  for (const r of reviewed) {
    assert.ok(["second_passed", "needs_review", "rejected"].includes(r.review_state), r.candidate_id);
    assert.equal(r.reviewer_id, null);
    assert.equal(r.reviewed_at, null);
    assert.ok(r.evidence_check && Array.isArray(r.evidence_check.flags));
  }
});

test("every needs_review / rejected candidate has a review_reason matching its flags", () => {
  for (const r of reviewed) {
    if (r.review_state === "second_passed") continue;
    assert.ok(typeof r.review_reason === "string" && r.review_reason.length > 0, r.candidate_id);
    assert.equal(r.review_reason, [...r.evidence_check.flags].sort().join(","));
  }
});

test("conflict links are symmetric and same post/kind", () => {
  const byId = new Map(reviewed.map((r) => [r.candidate_id, r]));
  let n = 0;
  for (const r of reviewed) {
    for (const o of r.evidence_check.conflicts_with ?? []) {
      const other = byId.get(o);
      assert.ok(other, `${o} missing`);
      assert.ok(other.evidence_check.conflicts_with?.includes(r.candidate_id), `${r.candidate_id} -> ${o} not symmetric`);
      assert.equal(other.post_id, r.post_id);
      assert.equal(other.record_kind, r.record_kind);
      assert.ok(r.evidence_check.flags.includes("conflict"));
      n++;
    }
  }
  assert.equal(n % 2, 0);
});

test("review queue covers exactly the needs_review items", () => {
  const q = readFileSync(path.join(tmpA, "review-queue.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  const ids = q.flatMap((p) => p.items.map((i) => i.candidate_id)).sort();
  const want = reviewed.filter((r) => r.review_state === "needs_review").map((r) => r.candidate_id).sort();
  assert.deepEqual(ids, want);
});

test("synthetic fixture: planted u/handle and 6-word copy are rejected", () => {
  // Invented text, not dataset wording.
  const posts = [{
    id: "zz0001",
    title: "Lantern Plaza to Copper Hill",
    question: "How do I get from Lantern Plaza to Copper Hill?",
    permalink: "https://example.invalid/zz0001",
    answers: [
      { score: 1, text: "Take the blue jeep marked Copper Hill at Lantern Plaza and stop beside the tall orange water tower. Fare is 15." },
      { score: 1, text: "Walk from Copper Hill gate to the chapel, about five minutes." },
    ],
  }];
  const base = { snapshot_sha256: SNAPSHOT_SHA256, post_id: "zz0001", evidence_check: null, review_reason: null, review_state: "extracted", reviewer_id: null, reviewed_at: null };
  const cands = [
    { ...base, candidate_id: "c_zz0001_0_1", comment_index: 0, record_kind: "ride",
      candidate_payload: { mode: "jeepney", signboard: "Copper Hill", board_place: "Lantern Plaza", alight_place: "orange water tower", direction_text: null, ride_min: null } },
    { ...base, candidate_id: "c_zz0001_0_2", comment_index: 0, record_kind: "note",
      candidate_payload: { body: "Riders should stop beside the tall orange water tower here.", kind: "tip" } },
    { ...base, candidate_id: "c_zz0001_1_1", comment_index: 1, record_kind: "walk",
      candidate_payload: { from_place: "Copper Hill gate", to_place: "chapel", walk_text: "Short walk suggested by u/plantedhandle to the chapel.", walk_m: null, walk_min: 5 } },
    { ...base, candidate_id: "c_zz0001_0_3", comment_index: 0, record_kind: "fare",
      candidate_payload: { applies_to_ride: "c_zz0001_0_1", amount_min: 15, amount_max: 15, currency: "PHP" } },
    { ...base, candidate_id: "c_zz0001_0_4", comment_index: 0, record_kind: "fare",
      candidate_payload: { applies_to_ride: "c_zz0001_0_1", amount_min: 99, amount_max: 99, currency: "PHP" } },
    { ...base, candidate_id: "c_zz0001_9_1", comment_index: 9, record_kind: "note",
      candidate_payload: { body: "Out of range locator.", kind: "tip" } },
  ];
  const out = new Map(evaluate(posts, cands, SNAPSHOT_SHA256).map((r) => [r.candidate_id, r]));
  const copy = out.get("c_zz0001_0_2");
  assert.equal(copy.review_state, "rejected");
  assert.ok(copy.evidence_check.flags.includes("raw_wording"));
  const handle = out.get("c_zz0001_1_1");
  assert.equal(handle.review_state, "rejected");
  assert.ok(handle.evidence_check.flags.includes("username"));
  assert.equal(out.get("c_zz0001_0_1").review_state, "second_passed");
  // 99 not in the text -> ungrounded fare rejected; it also conflicts with the grounded 15.
  const bad = out.get("c_zz0001_0_4");
  assert.equal(bad.review_state, "rejected");
  assert.ok(bad.evidence_check.flags.includes("value_not_in_source"));
  assert.deepEqual(bad.evidence_check.conflicts_with, ["c_zz0001_0_3"]);
  assert.deepEqual(out.get("c_zz0001_0_3").evidence_check.conflicts_with, ["c_zz0001_0_4"]);
  assert.equal(out.get("c_zz0001_0_3").review_state, "needs_review");
  assert.ok(out.get("c_zz0001_9_1").evidence_check.flags.includes("bad_locator"));
  assert.equal(out.get("c_zz0001_9_1").review_state, "rejected");
});

test("committed report contains no source text or usernames", () => {
  const posts = JSON.parse(readFileSync(path.join(ROOT, "howtogetthereph_dataset/ncr_routes.json"), "utf8"));
  const texts = new Set();
  for (const p of posts)
    for (const s of [p.title, p.question, ...p.answers.map((a) => a.text)])
      if (typeof s === "string" && s.trim().length > 20) texts.add(s.trim());
  assert.ok(texts.size > 3000);
  for (const f of REPORTS) {
    for (const dir of [tmpA, path.join(HERE, "reports")]) {
      const body = readFileSync(path.join(dir, f), "utf8");
      const leaked = [...texts].filter((t) => body.includes(t) || body.includes(JSON.stringify(t).slice(1, -1)));
      assert.equal(leaked.length, 0, `${f} contains ${leaked.length} source strings`);
      assert.doesNotMatch(body, /\bu\/[A-Za-z0-9_-]{3,}/);
    }
  }
  // Committed reports equal a fresh part-A run, modulo the part-B section that
  // ai-apply.mjs appends to both files (added after part A is committed).
  const committedMd = readFileSync(path.join(HERE, "reports", "t12-evidence.md"), "utf8").split("\n## Part B")[0].trimEnd();
  const freshMd = readFileSync(path.join(tmpA, "t12-evidence.md"), "utf8").trimEnd();
  assert.equal(committedMd, freshMd, "committed t12-evidence.md part A is stale");
  const committedJson = JSON.parse(readFileSync(path.join(HERE, "reports", "t12-evidence.json"), "utf8"));
  const freshJson = JSON.parse(readFileSync(path.join(tmpA, "t12-evidence.json"), "utf8"));
  delete committedJson.part_b;
  assert.deepEqual(committedJson, freshJson, "committed t12-evidence.json part A is stale");
});
