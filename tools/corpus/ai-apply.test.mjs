// node --test tools/corpus/ai-apply.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { run, applyVerdicts, buildPartB, checkVerdicts } from "./ai-apply.mjs";
import { SEED } from "./ai-sample.mjs";

const cand = (id, kind, extra = {}) => ({
  candidate_id: id,
  snapshot_sha256: "00".repeat(32),
  post_id: "zz0001",
  comment_index: 0,
  record_kind: kind,
  candidate_payload: {},
  evidence_check: { checks: { locator: true, grounded: true }, flags: [] },
  review_reason: null,
  review_state: "second_passed",
  reviewer_id: null,
  reviewed_at: null,
  ...extra,
});

const FIXTURE = [
  cand("c_zz0001_0_1", "ride"),
  cand("c_zz0001_0_2", "ride"),
  cand("c_zz0001_1_1", "fare"),
  cand("c_zz0001_2_1", "note"),
  cand("c_zz0001_3_1", "ride", { review_state: "needs_review" }), // not sampled
];
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";

const verdicts = {
  task: "T12 part B",
  seed: SEED,
  sample_size: 3, // two ride + one fare second_passed fixtures
  judged_at: "2026-10-09T00:00:00Z",
  judge: "test-judge",
  policy: "fixture",
  reason_codes: { fare_unscoped: "x" },
  exceptions: [
    { candidate_id: "c_zz0001_1_1", record_kind: "fare", new_state: "needs_review", reason_code: "fare_unscoped", note: "fixture note" },
  ],
};

function setup(v = verdicts) {
  const dir = mkdtempSync(path.join(tmpdir(), "t12b-"));
  writeFileSync(path.join(dir, "reviewed-candidates.jsonl"), jsonl(FIXTURE));
  writeFileSync(path.join(dir, "verdicts.json"), JSON.stringify(v));
  writeFileSync(path.join(dir, "t12-evidence.md"), "# T12 evidence pass — counts\n\nhead\n");
  writeFileSync(path.join(dir, "t12-evidence.json"), JSON.stringify({ task: "T12" }) + "\n");
  return dir;
}

test("verdict lines: supported vs needs_review, judge fields carried", () => {
  const { verdictLines } = applyVerdicts(
    FIXTURE.filter((r) => r.review_state === "second_passed" && ["ride", "walk", "fare", "hours", "service_status"].includes(r.record_kind)),
    verdicts
  );
  assert.equal(verdictLines.length, 3);
  const exc = verdictLines.find((l) => l.candidate_id === "c_zz0001_1_1");
  assert.equal(exc.verdict, "needs_review");
  assert.equal(exc.reason_code, "fare_unscoped");
  assert.equal(exc.note, "fixture note");
  assert.equal(exc.judged_at, "2026-10-09T00:00:00Z");
  assert.equal(exc.judge, "test-judge");
  for (const l of verdictLines.filter((x) => x !== exc)) {
    assert.equal(l.verdict, "supported");
    assert.equal(l.reason_code, null);
    assert.equal(l.note, null);
  }
  assert.deepEqual(Object.keys(exc), ["candidate_id", "record_kind", "post_id", "comment_index", "verdict", "reason_code", "note", "judged_at", "judge"]);
});

test("ai_override added only to exceptions; other lines byte-identical", () => {
  const dir = setup();
  try {
    run({ out: dir, reportDir: dir, verdictsPath: path.join(dir, "verdicts.json"), reviewed: FIXTURE });
    const lines = readFileSync(path.join(dir, "reviewed-candidates.jsonl"), "utf8").trim().split("\n");
    assert.equal(lines.length, FIXTURE.length);
    let overridden = 0;
    for (let i = 0; i < lines.length; i++) {
      const r = JSON.parse(lines[i]);
      if (r.candidate_id === "c_zz0001_1_1") {
        overridden++;
        assert.deepEqual(r.ai_override, {
          prior_state: "second_passed",
          new_state: "needs_review",
          reason_code: "fare_unscoped",
          note: "fixture note",
          judged_at: "2026-10-09T00:00:00Z",
        });
        assert.equal(r.review_state, "second_passed"); // part-A state untouched
        assert.equal(lines[i], JSON.stringify({ ...FIXTURE[i], ai_override: r.ai_override }));
      } else {
        assert.equal(r.ai_override, undefined);
        assert.equal(lines[i], JSON.stringify(FIXTURE[i]));
      }
    }
    assert.equal(overridden, 1);
    const sample = readFileSync(path.join(dir, "ai-sample.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
    assert.equal(sample.length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("re-run is byte-identical and idempotent", () => {
  const a = setup();
  const b = setup();
  try {
    const opts = (d) => ({ out: d, reportDir: d, verdictsPath: path.join(d, "verdicts.json"), reviewed: FIXTURE });
    run(opts(a));
    run(opts(a)); // second run over already-overridden output
    run(opts(b));
    for (const f of ["reviewed-candidates.jsonl", "ai-sample.jsonl", "t12-evidence.md", "t12-evidence.json"])
      assert.ok(readFileSync(path.join(a, f)).equals(readFileSync(path.join(b, f))), `${f} differs`);
    // appended section appears exactly once
    const md = readFileSync(path.join(a, "t12-evidence.md"), "utf8");
    assert.equal(md.split("## Part B").length - 1, 1);
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test("each verdict validation fails loudly", () => {
  const sample = FIXTURE.filter((r) => r.review_state === "second_passed" && r.record_kind !== "note");
  const good = structuredClone(verdicts);
  assert.doesNotThrow(() => checkVerdicts(sample, good));

  const cases = {
    "candidate not in sample": (v) => { v.exceptions[0].candidate_id = "c_nope_0_0"; },
    "duplicate candidate_id": (v) => { v.exceptions.push({ ...v.exceptions[0] }); },
    "unknown reason_code": (v) => { v.exceptions[0].reason_code = "bogus"; },
    "record_kind mismatch": (v) => { v.exceptions[0].record_kind = "walk"; },
    "new_state not needs_review": (v) => { v.exceptions[0].new_state = "rejected"; },
    "seed mismatch": (v) => { v.seed = 1; },
    "sample_size mismatch": (v) => { v.sample_size = 999; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const v = structuredClone(verdicts);
    mutate(v);
    assert.throws(() => checkVerdicts(sample, v), name);
  }
});

test("ai_override on a non-second_passed record fails loudly", () => {
  const v = structuredClone(verdicts);
  v.exceptions[0].candidate_id = "c_zz0001_3_1";
  v.exceptions[0].record_kind = "ride";
  const sample = FIXTURE.filter((r) => r.review_state === "second_passed" && r.record_kind !== "note");
  sample.push(FIXTURE.find((r) => r.candidate_id === "c_zz0001_3_1"));
  v.sample_size = sample.length;
  const { applyLine } = applyVerdicts(sample, v);
  assert.throws(() => applyLine(JSON.stringify(FIXTURE.find((r) => r.candidate_id === "c_zz0001_3_1"))), /second_passed/);
});

test("part B counts and per-kind table are correct", () => {
  const dir = setup();
  try {
    const { partB } = run({ out: dir, reportDir: dir, verdictsPath: path.join(dir, "verdicts.json"), reviewed: FIXTURE });
    assert.equal(partB.sample_size, 3);
    assert.equal(partB.supported, 2);
    assert.equal(partB.flagged, 1);
    assert.deepEqual(partB.per_kind.fare, { sampled: 1, supported: 0, flagged: 1, defect_rate_pct: 100 });
    assert.deepEqual(partB.flagged_by_reason_code, { fare_unscoped: 1 });
    assert.equal(partB.effective_review_state_totals.needs_review, 2); // 1 part-A + 1 override
    assert.equal(partB.effective_review_state_totals.second_passed, 3);
    const j = JSON.parse(readFileSync(path.join(dir, "t12-evidence.json"), "utf8"));
    assert.equal(j.task, "T12");
    assert.equal(j.part_b.flagged, 1);
    const md = readFileSync(path.join(dir, "t12-evidence.md"), "utf8");
    assert.match(md, /## Part B — independent AI evidence audit/);
    assert.match(md, /fare \| 1 \| 0 \| 1 \| 100%/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
