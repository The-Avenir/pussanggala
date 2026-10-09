import { after, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import { build, BuildError, readEligibleDir, sha256File } from "./build.mjs";
import { checkCompanion, readPack, runAcceptance } from "./acceptance.mjs";
import { checkRecords, leakScan, loadSourceNgrams, sourceSnapshotSha256 } from "./lib/checks.mjs";
import { toRawPackTables } from "./lib/spec.mjs";
import { DatabaseSync } from "./lib/sqlite.mjs";

// Exercise the real TS loader with Node's type stripping and extensionless local imports.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && context.parentURL?.includes("/packages/core/src/")) {
    const url = new URL(specifier, context.parentURL);
    if (existsSync(new URL(`${url.href}.ts`))) return nextResolve(`${url.href}.ts`, context);
  }
  return nextResolve(specifier, context);
} });
const { loadPack } = await import("../../packages/core/src/pack/load.ts");
const { getGraph } = await import("../../packages/core/src/route/graph.ts");

const fixture = new URL("./fixtures/", import.meta.url);
const rawPath = new URL("raw-dataset.json", fixture);
const run = JSON.parse(readFileSync(new URL("run.json", fixture), "utf8"));
const dispositions = JSON.parse(readFileSync(new URL("dispositions.json", fixture), "utf8"));
const base = readEligibleDir(fileURLToPath(new URL("eligible/", fixture)));
const reddit = new Set(base.source.filter((s) => s.kind === "reddit_thread").map((s) => s.source_id));
for (const rs of base.record_source) if (reddit.has(rs.source_id)) rs.snapshot_sha256 = run.input_sha256;
const dirs = [];
const temp = () => { const dir = mkdtempSync(join(tmpdir(), "pg-acceptance-")); dirs.push(dir); return dir; };
after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });
const make = (overrides = {}) => build({ tables: structuredClone(base), dispositions, run, rawDatasetPath: rawPath, outDir: temp(), ...overrides });
const codes = (result) => result.checks.filter((c) => !c.ok).flatMap((c) => c.issues.map((i) => i.code));
const accept = (packPath, rawDatasetPath = rawPath) => runAcceptance({ packPath, rawDatasetPath });
function failsBuild(overrides, code) {
  assert.throws(() => make(overrides), (e) => e instanceof BuildError && e.issues.some((i) => i.code === code));
}
function tamper(packPath, sql) {
  const db = new DatabaseSync(packPath);
  try { db.exec(sql); } finally { db.close(); }
  // Update only checksum/size so record/provenance checks cannot rely on a stale hash rejection.
  const companionPath = join(packPath, "..", "pack.manifest.json");
  const companion = JSON.parse(readFileSync(companionPath, "utf8"));
  companion.pack_sha256 = sha256File(packPath);
  companion.assets[0].sha256 = companion.pack_sha256;
  writeFileSync(companionPath, JSON.stringify(companion));
}

test("built SQLite fixture loads through the actual core loader and excludes quarantined edges", () => {
  const { packPath } = make();
  const { tables, manifests } = readPack(packPath);
  const loaded = loadPack(toRawPackTables(tables, manifests[0]));
  assert.equal(loaded.ok, true, JSON.stringify(loaded.error));
  const graph = getGraph(loaded.value);
  const edges = [...graph.outByStop.values()].flat();
  assert.deepEqual(edges.filter((e) => e.kind === "leg").map((e) => e.leg.leg_id).sort(), tables.leg.filter((l) => l.eligibility === "ready").map((l) => l.leg_id).sort());
  assert.deepEqual(edges.filter((e) => e.kind === "walk").map((e) => e.walk.walk_id).sort(), tables.walk_link.filter((w) => w.eligibility === "ready").map((w) => w.walk_id).sort());
  for (const p of tables.place) assert.ok([...graph.originAccesses(p.place_id), ...graph.destinationAccesses(p.place_id)].every((a) => a.eligibility === "ready"));
  assert.equal(accept(packPath).ok, true);
});

for (const [label, mutate, expected] of [
  ["top-level schema", (c) => c.schema_version = 2, "companion_metadata_mismatch"],
  ["top-level created date", (c) => c.created_at = "2020-01-01", "companion_metadata_mismatch"],
  ["top-level source hash", (c) => c.input_sha256 = "0".repeat(64), "companion_metadata_mismatch"],
  ["pack identity", (c) => c.pack_id = "other", "pack_id_mismatch"],
  ["staleness policy", (c) => c.manifest.stale_after_days = 999, "companion_manifest_mismatch"],
  ["dispositions", (c) => c.manifest.included_posts = 1, "companion_manifest_mismatch"],
  ["source dates", (c) => c.manifest.source_date_min = null, "companion_manifest_mismatch"],
  ["manifest extra fields", (c) => c.manifest.extra = true, "companion_manifest_mismatch"],
  ["missing manifest", (c) => delete c.manifest, "companion_manifest_mismatch"],
  ["filename", (c) => c.pack_file = "other.sqlite", "companion_file_mismatch"],
  ["bytes", (c) => c.pack_bytes += 1, "companion_bytes_mismatch"],
  ["asset hash", (c) => c.assets[0].sha256 = "0".repeat(64), "companion_asset_mismatch"],
  ["asset bytes", (c) => c.assets[0].bytes += 1, "companion_asset_mismatch"],
  ["asset path", (c) => c.assets[0].path = "../pack.sqlite", "companion_asset_mismatch"],
  ["missing assets", (c) => c.assets = [], "companion_asset_mismatch"],
]) test(`acceptance rejects companion disagreement: ${label}`, () => {
  const { packPath, companion } = make();
  mutate(companion);
  assert.ok(checkCompanion(companion, readPack(packPath).manifests[0], packPath).some((i) => i.code === expected));
  writeFileSync(join(packPath, "..", "pack.manifest.json"), JSON.stringify(companion));
  assert.ok(codes(accept(packPath)).includes(expected));
});

test("malformed or missing companion fails as an acceptance issue", () => {
  const { packPath } = make();
  const path = join(packPath, "..", "pack.manifest.json");
  for (const value of ["{", "null", "[]"]) {
    writeFileSync(path, value);
    assert.ok(codes(accept(packPath)).includes("companion_invalid"));
  }
  rmSync(path);
  assert.ok(codes(accept(packPath)).includes("companion_missing"));
});

test("raw snapshot hashes normalize CRLF only and acceptance rejects changed source content", () => {
  const text = readFileSync(rawPath, "utf8").replace(/\r\n/g, "\n");
  const lf = join(temp(), "raw.json");
  const crlf = join(temp(), "raw.json");
  writeFileSync(lf, text);
  writeFileSync(crlf, text.replace(/\n/g, "\r\n"));
  assert.equal(sourceSnapshotSha256(lf), run.input_sha256);
  assert.equal(sourceSnapshotSha256(crlf), run.input_sha256);
  const a = make({ rawDatasetPath: lf });
  const b = make({ rawDatasetPath: crlf });
  assert.equal(a.companion.pack_sha256, b.companion.pack_sha256);
  const posts = JSON.parse(text);
  posts[0].title = "Changed synthetic question title";
  writeFileSync(lf, JSON.stringify(posts));
  assert.ok(codes(accept(a.packPath, lf)).includes("input_mismatch"));
  failsBuild({ rawDatasetPath: lf }, "input_mismatch");
});

for (const [label, mutate, expected, sql] of [
  ["snapshot hash", (t, r) => r.snapshot_sha256 = "0".repeat(64), "snapshot_mismatch", "UPDATE record_source SET snapshot_sha256 = 'bad' WHERE source_id = 'src_fx001'"],
  ["missing snapshot hash", (t, r) => r.snapshot_sha256 = null, "snapshot_mismatch", "UPDATE record_source SET snapshot_sha256 = NULL WHERE source_id = 'src_fx001'"],
  ["comment bounds", (t, r) => r.comment_index = 999, "source_locator_invalid", "UPDATE record_source SET comment_index = 999 WHERE source_id = 'src_fx001'"],
  ["missing post", (t) => t.source.find((s) => s.source_id === "src_fx001").post_id = "absent", "source_locator_invalid", "UPDATE source SET post_id = 'absent' WHERE source_id = 'src_fx001'"],
]) test(`builder and acceptance reject forged ${label}`, () => {
  const tables = structuredClone(base);
  mutate(tables, tables.record_source.find((r) => r.source_id === "src_fx001"));
  failsBuild({ tables }, expected);
  const { packPath } = make();
  tamper(packPath, sql);
  assert.ok(codes(accept(packPath)).includes(expected));
});

test("included post count is checked against distinct cited Reddit posts after build", () => {
  const { packPath } = make();
  tamper(packPath, "UPDATE pack_manifest SET included_posts = 1, pending_posts = 2");
  assert.ok(codes(accept(packPath)).includes("manifest_counts_mismatch"));
});

test("source dates are checked against cited sources after build", () => {
  const { packPath } = make();
  tamper(packPath, "UPDATE pack_manifest SET source_date_min = '2000-01-01'");
  assert.ok(codes(accept(packPath)).includes("manifest_dates_mismatch"));
});

test("privacy scan covers geometry properties, license, locator text and pack manifest", () => {
  const gram = loadSourceNgrams(rawPath).values().next().value;
  for (const [table, col, value, expected] of [
    ["region", "boundary_geojson", JSON.stringify({ type: "Polygon", properties: { copied: gram } }), "leak_ngram"],
    ["shape", "geojson", JSON.stringify({ type: "LineString", properties: { copied: gram } }), "leak_ngram"],
    ["source", "license", gram, "leak_ngram"],
    ["source", "license", "u/synthetic_author", "leak_handle"],
    ["source", "post_id", "u/synthetic_author", "leak_handle"],
    ["record_source", "snapshot_sha256", "u/synthetic_author", "leak_handle"],
  ]) {
    const tables = structuredClone(base);
    tables[table][0][col] = value;
    const issues = leakScan(tables, rawPath);
    assert.ok(issues.some((i) => i.table === table && i.code === expected), `${table}.${col}`);
    assert.ok(!JSON.stringify(issues).includes(gram), "diagnostics must not echo raw text");
    failsBuild({ tables }, expected);
  }
  failsBuild({ run: { ...run, bbox: gram } }, "leak_ngram");
});

test("bare source author identities are rejected without rejecting unrelated substrings", () => {
  const posts = JSON.parse(readFileSync(rawPath, "utf8"));
  posts[0].author = "synthetic_author";
  posts[0].answers[0].username = "second_author";
  const path = join(temp(), "raw.json");
  writeFileSync(path, JSON.stringify(posts));
  const tables = structuredClone(base);
  for (const name of ["synthetic_author", "second_author"]) {
    tables.note[0].body = `Thanks ${name} for helping`;
    assert.ok(leakScan(tables, path).some((i) => i.code === "leak_handle"));
  }
  tables.note[0].body = "A synthetic_authority location";
  assert.deepEqual(leakScan(tables, path), []);
});

test("unsafe integer rows rejected by core are rejected by builder before SQLite", () => {
  const tables = structuredClone(base);
  tables.place_alias[0].alias_id = Number.MAX_SAFE_INTEGER + 1;
  assert.equal(loadPack(toRawPackTables(tables, make().companion.manifest)).ok, false);
  assert.ok(checkRecords(tables).some((i) => i.code === "row_invalid"));
  failsBuild({ tables }, "row_invalid");
});

test("outside or ambiguous endpoints cannot become ready access, walking or ride facts", () => {
  for (const status of ["outside", "ambiguous"]) {
    for (const table of ["place_stop", "leg", "walk_link"]) {
      const tables = structuredClone(base);
      const row = tables[table].find((r) => r.eligibility === "ready");
      const stopId = row.stop_id ?? row.board_stop_id ?? row.from_stop_id;
      const placeId = tables.stop.find((s) => s.stop_id === stopId).place_id;
      tables.place.find((p) => p.place_id === placeId).ncr_status = status;
      failsBuild({ tables }, "ready_outside_ncr");
    }
  }
});
