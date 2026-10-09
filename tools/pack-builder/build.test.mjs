// node --test tools/pack-builder/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "./lib/sqlite.mjs";
import {
  BuildError, DISPOSITION_PRECEDENCE, SCHEMA_SQL_PATH, build, leakScan, readEligibleDir, resolveDispositions,
} from "./build.mjs";
import { readPack, runAcceptance } from "./acceptance.mjs";
import { MUTATIONS, clone } from "./lib/mutations.mjs";
import { checkRecords, loadSourceNgrams } from "./lib/checks.mjs";
import { TABLES, toRawPackTables } from "./lib/spec.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FX = join(HERE, "fixtures");
const RAW = join(FX, "raw-dataset.json");
const RUN = JSON.parse(readFileSync(join(FX, "run.json"), "utf8"));
const DISP = JSON.parse(readFileSync(join(FX, "dispositions.json"), "utf8"));
const BASE = readEligibleDir(join(FX, "eligible"));

const tmpDirs = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "pg-pack-"));
  tmpDirs.push(d);
  return d;
};
process.on("exit", () => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }); });

const runBuild = (overrides = {}) => build({
  tables: overrides.tables ?? clone(BASE),
  dispositions: overrides.dispositions ?? DISP,
  run: overrides.run ?? RUN,
  rawDatasetPath: overrides.raw ?? RAW,
  outDir: overrides.outDir ?? tmp(),
});

function assertBuildFails(overrides, code) {
  const out = tmp();
  assert.throws(() => runBuild({ ...overrides, outDir: out }), (e) => {
    assert.ok(e instanceof BuildError, `expected BuildError, got ${e}`);
    assert.ok(e.issues.some((i) => i.code === code), `expected ${code}, got ${e.issues.map((i) => i.code).join(",")}`);
    return true;
  });
  assert.equal(existsSync(join(out, "pack.sqlite")), false, "failed build must not leave a pack");
  return out;
}

const mutated = (fn) => { const t = clone(BASE); fn(t); return t; };

test("happy path: builds, SQLite checks clean, reports reconcile", () => {
  const { packPath, companion, report } = runBuild();
  const db = new DatabaseSync(packPath, { readOnly: true });
  try {
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 1);
    const m = db.prepare("SELECT * FROM pack_manifest").all();
    assert.equal(m.length, 1);
    assert.equal(m[0].included_posts + m[0].filtered_posts + m[0].pending_posts + m[0].rejected_posts, m[0].answered_posts);
    assert.equal(m[0].created_at, RUN.created_at);
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
    assert.ok(idx.includes("leg_route_idx") && idx.includes("record_source_record_idx"));
  } finally {
    db.close();
  }
  assert.match(companion.pack_sha256, /^[0-9a-f]{64}$/);
  assert.equal(companion.schema_version, 1);
  assert.ok(companion.pack_bytes > 0);
  // Precedence: fx002 rejected+pending -> pending; fx003 filtered+included -> included.
  assert.deepEqual(report.dispositions, { included: 2, pending: 1, rejected: 0, filtered: 0 });
  assert.equal(report.records.leg, 2);
  assert.deepEqual(report.eligibility.leg, { ready: 1, excluded: 1 });
  assert.equal(report.coverage.routes_with_ready_legs, 1);
  assert.equal(report.source_date_min, "2024-12-15");
  assert.equal(report.source_date_max, "2025-03-01");
  const outDir = dirname(packPath);
  assert.ok(existsSync(join(outDir, "yield-report.md")));
  assert.ok(existsSync(join(outDir, "yield-report.json")));
});

test("deterministic: same input gives same pack_sha256", () => {
  const a = runBuild().companion.pack_sha256;
  const b = runBuild().companion.pack_sha256;
  assert.equal(a, b);
});

test("round trip: pack reads back to the input rows (T20 RawPackTables shape)", () => {
  const { packPath } = runBuild();
  const { tables, manifests } = readPack(packPath);
  for (const t of TABLES) {
    const cmp = (x, y) => (typeof x === "number" ? x - y : x < y ? -1 : x > y ? 1 : 0);
    const expected = [...BASE[t.name]].sort((x, y) => cmp(x[t.pk], y[t.pk]));
    assert.deepEqual(tables[t.name], expected, t.name);
  }
  const raw = toRawPackTables(tables, manifests[0]);
  assert.deepEqual(Object.keys(raw).sort(), ["fare_reports", "hours_reports", "legs", "manifest", "note_links", "notes",
    "place_aliases", "place_ambiguities", "place_stops", "places", "record_sources", "regions", "routes", "shapes",
    "sources", "stops", "walk_links"]);
});

test("disposition precedence is included > pending > rejected > filtered", () => {
  assert.deepEqual(DISPOSITION_PRECEDENCE, ["included", "pending", "rejected", "filtered"]);
  const { final } = resolveDispositions({ a: ["filtered", "rejected"], b: ["rejected", "pending"], c: ["pending", "included"], d: "filtered" });
  assert.deepEqual(final, { a: "rejected", b: "pending", c: "included", d: "filtered" });
});

test("FK violation fails", () => {
  assertBuildFails({ tables: mutated((t) => { t.leg[0].board_stop_id = "st_missing"; }) }, "dangling_fk");
});

test("amount_min > amount_max fails", () => {
  assertBuildFails({ tables: mutated((t) => { t.fare_report[0].amount_min = 99; }) }, "fare_range_inverted");
});

test("shape with two owners fails", () => {
  assertBuildFails({ tables: mutated((t) => { t.shape[0].walk_id = "wk_market-to-terminal"; }) }, "shape_owner_count");
});

test("record without source fails", () => {
  const tables = mutated((t) => { t.record_source = t.record_source.filter((r) => r.record_id !== "hr_violet-1"); });
  const out = assertBuildFails({ tables }, "missing_provenance");
  assert.ok(out);
});

test("ready leg on suspended or retired route fails", () => {
  for (const status of ["suspended", "retired"]) {
    assertBuildFails({ tables: mutated((t) => { t.route.find((r) => r.route_id === "rt_violet-loop").service_status = status; }) }, "ready_on_inactive_route");
  }
  // An excluded leg on a suspended route is allowed (the base fixture has one).
  assert.equal(BASE.leg.find((l) => l.leg_id === "lg_orange-1").eligibility, "excluded");
});

test("dispositions not summing to answered_posts fails", () => {
  assertBuildFails({ dispositions: { fx001: "included", fx003: "included" } }, "dispositions_sum");
  assertBuildFails({ run: { ...RUN, answered_posts: 4 } }, "dispositions_sum");
});

test("run metadata must match the raw dataset", () => {
  assertBuildFails({ run: { ...RUN, input_sha256: "0".repeat(64) } }, "input_mismatch");
});

test("included post must be cited and cited post must be included", () => {
  assertBuildFails({ dispositions: { ...DISP, fx003: "filtered" } }, "source_post_not_included");
});

test("leak scan catches a planted 6-word copy", () => {
  const grams = loadSourceNgrams(RAW);
  // Fixture raw answer text, synthetic: "...get off at the fountain gate corner near the market."
  const tables = mutated((t) => { t.note[0].body = "Tip: get off at the fountain gate corner please."; });
  const hits = leakScan(tables, RAW);
  assert.deepEqual(hits.map((h) => [h.code, h.table, h.id]), [["leak_ngram", "note", "nt_violet-fare"]]);
  assert.ok(!JSON.stringify(hits).includes("fountain"), "issues must not echo record text");
  assert.ok(grams.size > 0);
  // Five copied words are below the threshold.
  assert.deepEqual(leakScan(mutated((t) => { t.note[0].body = "Get off at the fountain."; }), grams), []);
  assertBuildFails({ tables }, "leak_ngram");
});

test("leak scan is case/whitespace/punctuation insensitive", () => {
  const tables = mutated((t) => { t.walk_link[0].walk_text = "WALK   straight, past the BAKERY then cross."; });
  assert.equal(leakScan(tables, RAW)[0]?.code, "leak_ngram");
});

test("leak scan catches a planted u/ handle and profile link", () => {
  const t1 = mutated((t) => { t.stop[0].landmark_hint = "ask u/sample_rider"; });
  assert.deepEqual(leakScan(t1, RAW).map((h) => [h.code, h.id]), [["leak_handle", "st_plaza-bay"]]);
  const t2 = mutated((t) => { t.source[0].url = "https://www.reddit.com/user/sample_rider"; });
  assert.equal(leakScan(t2, RAW)[0]?.code, "leak_handle");
  assertBuildFails({ tables: t1 }, "leak_handle");
});

test("ambiguous alias in unique place_alias is rejected", () => {
  const tables = mutated((t) => {
    t.place_alias.push({ alias_id: 99, place_id: "pl_sample-plaza", alias_norm: "fixture center", alias_display: "Fixture Center" });
  });
  assertBuildFails({ tables }, "alias_conflict");
  // Duplicated alias_norm across two places in place_alias is also rejected.
  const dup = mutated((t) => {
    t.place_alias.push({ alias_id: 99, place_id: "pl_example-market", alias_norm: "sample plaza", alias_display: "Sample Plaza" });
  });
  assertBuildFails({ tables: dup }, "alias_conflict");
  // Ambiguous aliases need >= 2 candidates in place_ambiguity.
  assertBuildFails({ tables: mutated((t) => { t.place_ambiguity.pop(); }) }, "ambiguity_too_few");
});

test("SQLite schema itself enforces constraints (defence in depth)", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(readFileSync(SCHEMA_SQL_PATH, "utf8"));
    db.exec(`INSERT INTO region VALUES ('rg_x','R','{}','h');
      INSERT INTO place VALUES ('pl_a','rg_x','A','k','ar','accepted',NULL,NULL,'unmapped');
      INSERT INTO place VALUES ('pl_b','rg_x','B','k','ar','accepted',NULL,NULL,'unmapped');
      INSERT INTO stop VALUES ('st_a','pl_a','A','h');
      INSERT INTO route VALUES ('rt_a','bus',NULL,'d','unknown');
      INSERT INTO leg VALUES ('lg_a','rt_a','st_a','st_a',NULL,NULL,'ready');
      INSERT INTO walk_link VALUES ('wk_a','st_a','st_a',NULL,NULL,'t','ready');
      INSERT INTO place_alias VALUES (1,'pl_a','alias a','Alias A');`);
    const bad = [
      "INSERT INTO stop VALUES ('st_b','pl_missing','B','h')",
      "INSERT INTO fare_report VALUES ('fr_a','lg_a',20,10,'PHP','reported_segment',NULL)",
      "INSERT INTO shape VALUES ('sh_a','lg_a','wk_a','{}','schematic')",
      "INSERT INTO shape VALUES ('sh_b',NULL,NULL,'{}','schematic')",
      "INSERT INTO note VALUES ('nt_a','b','tip'); INSERT INTO note_link VALUES (1,'nt_a',NULL,NULL)",
      "INSERT INTO place VALUES ('pl_c','rg_x','C','k','ar','accepted',14.5,NULL,'mapped')",
      "INSERT INTO place_alias VALUES (2,'pl_b','alias a','Alias A')",
      "INSERT INTO walk_link VALUES ('wk_b','st_a','st_a',-5,NULL,'t','ready')",
      "INSERT INTO leg VALUES ('lg_b','rt_a','st_a','st_a',1.5,NULL,'ready')",
      "INSERT INTO route VALUES ('rt_b','ferry',NULL,'d','unknown')",
      "INSERT INTO route VALUES ('RT_Bad','bus',NULL,'d','unknown')",
      "INSERT INTO hours_report VALUES ('hr_a','rt_a','t','25:00',NULL,NULL)",
    ];
    for (const sql of bad) {
      db.exec("SAVEPOINT s");
      assert.throws(() => db.exec(sql), undefined, sql);
      db.exec("ROLLBACK TO s; RELEASE s");
    }
    db.exec("INSERT INTO pack_manifest VALUES ('p','1','rg_x','b','c',NULL,NULL,180,'h',3,2,1,1,0,0)");
    assert.throws(() => db.exec("INSERT INTO pack_manifest VALUES ('q',1,'rg_x','b','c',NULL,NULL,180,'h',3,2,1,1,0,0)"));
  } finally {
    db.close();
  }
  const db2 = new DatabaseSync(":memory:");
  try {
    db2.exec(readFileSync(SCHEMA_SQL_PATH, "utf8"));
    db2.exec("INSERT INTO region VALUES ('rg_x','R','{}','h')");
    assert.throws(() => db2.exec("INSERT INTO pack_manifest VALUES ('p',1,'rg_x','b','c',NULL,NULL,180,'h',3,2,1,0,0,0)"), /CHECK/);
  } finally {
    db2.close();
  }
});

test("every shared negative fixture is caught by checkRecords/leakScan", () => {
  const grams = loadSourceNgrams(RAW);
  for (const m of MUTATIONS) {
    const t = clone(BASE);
    m.apply(t, { grams });
    const codes = [...checkRecords(t), ...leakScan(t, grams)].map((i) => i.code);
    assert.ok(codes.includes(m.expect), `${m.name}: expected ${m.expect}, got ${codes.join(",") || "none"}`);
  }
  assert.deepEqual(checkRecords(clone(BASE)), []);
});

test("acceptance (T16) passes on a good pack and fails on a tampered pack", () => {
  const { packPath } = runBuild();
  const result = runAcceptance({ packPath, rawDatasetPath: RAW });
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter((c) => !c.ok)));
  for (const g of ["integrity", "invalid-record", "ambiguity", "source-content"]) {
    assert.ok(result.checks.some((c) => c.group === g), g);
  }
  // Tamper: flip a ready leg's route to suspended after build; also breaks the external checksum.
  const db = new DatabaseSync(packPath);
  db.exec("UPDATE route SET service_status = 'suspended' WHERE route_id = 'rt_violet-loop'");
  db.close();
  const bad = runAcceptance({ packPath, rawDatasetPath: RAW });
  assert.equal(bad.ok, false);
  const failedCodes = bad.checks.filter((c) => !c.ok).flatMap((c) => c.issues.map((i) => i.code));
  assert.ok(failedCodes.includes("ready_on_inactive_route"));
  assert.ok(failedCodes.includes("pack_sha256_mismatch"));
});
