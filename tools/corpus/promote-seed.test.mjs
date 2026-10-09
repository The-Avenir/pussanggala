import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { build, COMPANION_FILE, PACK_FILE, sha256File } from "../pack-builder/build.mjs";
import { DatabaseSync } from "../pack-builder/lib/sqlite.mjs";
import { freezeReference } from "./freeze-reference.mjs";
import { promoteSeed, parseArgs } from "./promote-seed.mjs";

const FX = join(dirname(fileURLToPath(import.meta.url)), "../pack-builder/fixtures");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
function fixture(t) {
  const rootDir = mkdtempSync(join(tmpdir(), "pg-promote-test-"));
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const eligibleDir = join(rootDir, "data/raw/t14/eligible");
  cpSync(join(FX, "eligible"), eligibleDir, { recursive: true });
  const dispositionsPath = join(rootDir, "data/raw/t14/dispositions.json");
  const runPath = join(rootDir, "data/raw/t14/run.json");
  cpSync(join(FX, "dispositions.json"), dispositionsPath);
  cpSync(join(FX, "run.json"), runPath);
  // Materialize valid locators in temp inputs, preserving the legacy fixture files.
  const redditSources = new Set(readJson(join(eligibleDir, "source.json")).filter((s) => s.kind === "reddit_thread").map((s) => s.source_id));
  const links = readJson(join(eligibleDir, "record_source.json"));
  for (const row of links) if (redditSources.has(row.source_id)) row.snapshot_sha256 = readJson(runPath).input_sha256;
  writeJson(join(eligibleDir, "record_source.json"), links);
  const sourceDir = join(rootDir, "howtogetthereph_dataset");
  mkdirSync(sourceDir);
  const rawDatasetPath = join(sourceDir, "ncr_routes.json");
  // Make this fixture stable on Windows git checkouts as well as LF checkouts.
  writeFileSync(rawDatasetPath, readFileSync(join(FX, "raw-dataset.json"), "utf8").replace(/\r\n/g, "\n"));
  const referenceDir = join(rootDir, "data/reference/howtogetthereph_dataset-precleaned");
  freezeReference({ sourceDir, destDir: referenceDir });
  const packDir = join(rootDir, "data/raw/out");
  build({ eligibleDir, dispositions: dispositionsPath, run: runPath, rawDatasetPath, outDir: packDir });
  const outDir = join(rootDir, "data/seed");
  mkdirSync(join(outDir, "eligible"), { recursive: true });
  writeFileSync(join(outDir, "eligible/stale.json"), "private stale rows");
  writeFileSync(join(outDir, "pack.sqlite.sha256"), "stale checksum");
  writeFileSync(join(outDir, "sentinel.txt"), "prior valid seed");
  return { rootDir, eligibleDir, dispositionsPath, runPath, sourceDir, referenceDir, outDir, rawDatasetPath, packPath: join(packDir, PACK_FILE), companionPath: join(packDir, COMPANION_FILE) };
}
function tree(dir) {
  return Object.fromEntries(readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((f) => [f.name, f.isDirectory() ? tree(join(dir, f.name)) : readFileSync(join(dir, f.name)).toString("hex")]));
}

test("real builder promotion uses actual companion, cleans stale destination and rebuilds unchanged", (t) => {
  const f = fixture(t);
  const result = promoteSeed(f);
  assert.equal(result.handoff.source_snapshot_sha256, readJson(f.runPath).input_sha256);
  assert.deepEqual(readJson(join(f.outDir, COMPANION_FILE)), readJson(f.companionPath));
  assert.deepEqual(readdirSync(f.outDir).sort(), ["HANDOFF.json", "README.md", "dispositions.json", "eligible", "pack.manifest.json", "pack.sha256", "run.json"]);
  assert.deepEqual(readdirSync(join(f.outDir, "eligible")).sort(), readdirSync(f.eligibleDir).sort());
  const rebuilt = build({ eligibleDir: join(f.outDir, "eligible"), dispositions: join(f.outDir, "dispositions.json"), run: join(f.outDir, "run.json"), rawDatasetPath: f.rawDatasetPath, outDir: join(f.rootDir, "rebuild") });
  assert.equal(rebuilt.companion.pack_sha256, result.handoff.pack_sha256);
  const old = tree(f.outDir);
  promoteSeed({ ...f, promotedAt: result.handoff.promoted_at });
  assert.deepEqual(tree(f.outDir), old);
  assert.equal(readdirSync(join(f.rootDir, "data")).some((n) => n.startsWith(".seed-promote-")), false);
});

const mutations = {
  "missing pack": (f) => rmSync(f.packPath),
  "missing companion": (f) => rmSync(f.companionPath),
  "corrupt pack": (f) => writeFileSync(f.packPath, "not SQLite"),
  "tampered companion hash": (f) => writeJson(f.companionPath, { ...readJson(f.companionPath), pack_sha256: "0".repeat(64) }),
  "tampered companion manifest": (f) => { const c = readJson(f.companionPath); c.manifest.pending_posts = 10; writeJson(f.companionPath, c); },
  "tampered companion asset": (f) => { const c = readJson(f.companionPath); c.assets[0].bytes++; writeJson(f.companionPath, c); },
  "stale eligible rows": (f) => { const p = join(f.eligibleDir, "note.json"); const rows = readJson(p); rows[0].body = "Changed eligible paraphrase"; writeJson(p, rows); },
  "stale run identity": (f) => writeJson(f.runPath, { ...readJson(f.runPath), pack_id: "pack_different" }),
  "stale dispositions": (f) => { const d = readJson(f.dispositionsPath); d.fx002 = "rejected"; writeJson(f.dispositionsPath, d); },
  "unknown run raw field": (f) => writeJson(f.runPath, { ...readJson(f.runPath), raw_post: "private source" }),
  "unexpected eligible file": (f) => writeFileSync(join(f.eligibleDir, "raw-posts.json"), "private source"),
  "unexpected eligible directory": (f) => mkdirSync(join(f.eligibleDir, "nested")),
  "missing eligible table": (f) => rmSync(join(f.eligibleDir, "note.json")),
  "missing run": (f) => rmSync(f.runPath),
  "missing dispositions": (f) => rmSync(f.dispositionsPath),
  "changed source snapshot": (f) => writeFileSync(f.rawDatasetPath, "[]\n"),
  "missing frozen metadata": (f) => rmSync(join(f.referenceDir, "SHA256SUMS.txt")),
  "corrupt frozen bytes": (f) => writeFileSync(join(f.referenceDir, "raw/ncr_routes.json"), "corrupt"),
  "run snapshot mismatch": (f) => writeJson(f.runPath, { ...readJson(f.runPath), input_sha256: "f".repeat(64) }),
  "corrupt SQLite with rehashed companion": (f) => {
    const db = new DatabaseSync(f.packPath);
    db.exec("UPDATE note SET body = 'Changed pack paraphrase'");
    db.close();
    // Even a replacement checksum cannot prove identity with supplied eligible tables.
    const c = readJson(f.companionPath);
    c.pack_sha256 = sha256File(f.packPath);
    c.assets[0].sha256 = c.pack_sha256;
    writeJson(f.companionPath, c);
  },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`reject ${name} and preserve all previous seed files`, (t) => {
    const f = fixture(t);
    const before = tree(f.outDir);
    mutate(f);
    assert.throws(() => promoteSeed(f));
    assert.deepEqual(tree(f.outDir), before);
    assert.equal(readdirSync(join(f.rootDir, "data")).some((n) => n.startsWith(".seed-promote-")), false);
  });
}

test("failed first promotion leaves no partially published seed", (t) => {
  const f = fixture(t);
  rmSync(f.outDir, { recursive: true });
  rmSync(f.companionPath);
  assert.throws(() => promoteSeed(f));
  assert.equal(existsSync(f.outDir), false);
});

test("publication rename failure restores the previous seed directory", (t) => {
  const f = fixture(t);
  const before = tree(f.outDir);
  let calls = 0;
  const rename = (from, to) => {
    if (++calls === 2) throw new Error("injected publication failure");
    renameSync(from, to);
  };
  assert.throws(() => promoteSeed({ ...f, rename }), /injected publication failure/);
  assert.deepEqual(tree(f.outDir), before);
  assert.equal(calls, 3, "rollback must restore the original directory");
  assert.equal(readdirSync(join(f.rootDir, "data")).some((n) => n.startsWith(".seed-promote-")), false);
});

test("CRLF input shares the builder's logical snapshot hash with LF input", (t) => {
  const f = fixture(t);
  const previous = readJson(f.companionPath);
  // Start a separate baseline for CRLF byte identity, with the same logical snapshot.
  rmSync(f.referenceDir, { recursive: true });
  writeFileSync(f.rawDatasetPath, readFileSync(f.rawDatasetPath, "utf8").replace(/\n/g, "\r\n"));
  freezeReference({ sourceDir: f.sourceDir, destDir: f.referenceDir });
  build({ eligibleDir: f.eligibleDir, dispositions: f.dispositionsPath, run: f.runPath, rawDatasetPath: f.rawDatasetPath, outDir: dirname(f.packPath) });
  assert.equal(readJson(f.companionPath).pack_sha256, previous.pack_sha256);
  const result = promoteSeed(f);
  assert.equal(result.handoff.source_snapshot_sha256, previous.input_sha256);
  assert.notEqual(result.handoff.source_snapshot_sha256_bytes, result.handoff.source_snapshot_sha256);
});

test("CLI paths support fixture-only runs, output cannot consume inputs", (t) => {
  const f = fixture(t);
  const cli = spawnSync(process.execPath, ["tools/corpus/promote-seed.mjs", "--eligible", f.eligibleDir, "--dispositions", f.dispositionsPath, "--run", f.runPath, "--pack", f.packPath, "--source", f.sourceDir, "--reference", f.referenceDir, "--out", f.outDir], { encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr);
  assert.throws(() => promoteSeed({ ...f, outDir: f.rootDir }), /separate/);
  assert.throws(() => parseArgs(["--pack"]));
});
