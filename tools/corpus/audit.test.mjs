// node --test tools/corpus/audit.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { EXPECTED, EXPECTED_NCR_SHA256 } from "./audit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const REPORT_JSON = path.join(HERE, "reports/t10-audit.json");
const REPORT_MD = path.join(HERE, "reports/t10-audit.md");

test("audit script exits 0 and regenerates reports", () => {
  const r = spawnSync(process.execPath, [path.join(HERE, "audit.mjs")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /T10 audit PASS/);
});

test("NCR count invariants and snapshot hash", () => {
  const rep = JSON.parse(readFileSync(REPORT_JSON, "utf8"));
  assert.equal(rep.input_files["ncr_routes.json"].sha256, EXPECTED_NCR_SHA256);
  assert.deepEqual(rep.counts.ncr_routes_json, EXPECTED.ncr);
  assert.deepEqual(rep.counts.routes_json, EXPECTED.all);
  assert.equal(rep.counts.ncr_routes_json.posts, 3480);
  assert.equal(rep.counts.ncr_routes_json.with_answers, 2186);
  assert.equal(rep.counts.ncr_routes_json.without_answers, 1294);
  assert.equal(rep.counts.ncr_routes_json.answer_texts, 3988);
  assert.equal(rep.assertions.passed, true);
  assert.deepEqual(Object.keys(rep.field_inventory.answers).sort(), ["score", "text"]);
  for (const v of Object.values(rep.absent_metadata.on_answers)) assert.equal(v, true);
});

test("committed reports contain no source wording", () => {
  const posts = JSON.parse(readFileSync(path.join(ROOT, "howtogetthereph_dataset/ncr_routes.json"), "utf8"));
  const texts = new Set();
  for (const p of posts) {
    for (const s of [p.title, p.question, ...p.answers.map((a) => a.text)]) {
      if (typeof s === "string" && s.trim().length > 20) texts.add(s.trim());
    }
  }
  assert.ok(texts.size > 3000, "expected many source strings to check against");
  for (const file of [REPORT_JSON, REPORT_MD]) {
    const body = readFileSync(file, "utf8");
    const leaked = [...texts].filter((t) => body.includes(t) || body.includes(JSON.stringify(t).slice(1, -1)));
    assert.equal(leaked.length, 0, `${path.basename(file)} contains ${leaked.length} source strings`);
    // Also check a 40-char window from each long text (catches partial copies).
    const windows = [...texts].filter((t) => t.length >= 60).map((t) => t.slice(10, 50));
    const partial = windows.filter((w) => body.includes(w));
    assert.equal(partial.length, 0, `${path.basename(file)} contains ${partial.length} source fragments`);
    assert.doesNotMatch(body, /\bu\/[A-Za-z0-9_-]{3,}/, "no Reddit usernames");
  }
});
