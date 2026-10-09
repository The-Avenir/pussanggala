#!/usr/bin/env node
// Fail-closed seed handoff: validate a deterministic rebuild before directory replacement.
import { isDeepStrictEqual } from "node:util";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, PACK_FILE, COMPANION_FILE, sha256File } from "../pack-builder/build.mjs";
import { checkCompanion, readPack } from "../pack-builder/acceptance.mjs";
import { TABLES } from "../pack-builder/lib/spec.mjs";
import { assertRegularFile, readSnapshotBytes, validateFrozenReference } from "./freeze-reference.mjs";
import { scanRoots } from "../eval/allowlist-check.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUN_KEYS = ["pack_id", "region_id", "bbox", "created_at", "stale_after_days", "input_sha256", "input_posts", "answered_posts"];
const fail = (msg) => { throw new Error(msg); };
const readJson = (file) => { assertRegularFile(file); return JSON.parse(readFileSync(file, "utf8")); };
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const inside = (parent, child) => {
  const rel = path.relative(parent, child);
  return !rel || (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel));
};

/**
 * Rebuild locally with the builder's actual API: this proves the pack corresponds to
 * these eligible rows, run, dispositions and frozen input without inventing companion
 * fields. The temporary raw input/build/reports are removed and never published.
 * Directory replacement removes all stale destination rows/checksums; a failed
 * validation leaves the previous seed untouched.
 */
export function promoteSeed(o = {}) {
  const rename = o.rename ?? renameSync; // Injectable only for deterministic rollback tests.
  const root = path.resolve(o.rootDir ?? ROOT);
  const eligibleDir = path.resolve(o.eligibleDir ?? path.join(root, "data/raw/t14/eligible"));
  const dispositionsPath = path.resolve(o.dispositionsPath ?? path.join(root, "data/raw/t14/dispositions.json"));
  const runPath = path.resolve(o.runPath ?? path.join(root, "data/raw/t14/run.json"));
  const packPath = path.resolve(o.packPath ?? path.join(root, "data/raw/out", PACK_FILE));
  const companionPath = path.resolve(o.companionPath ?? path.join(path.dirname(packPath), COMPANION_FILE));
  const sourceDir = path.resolve(o.sourceDir ?? path.join(root, "howtogetthereph_dataset"));
  const referenceDir = path.resolve(o.referenceDir ?? path.join(root, "data/reference/howtogetthereph_dataset-precleaned"));
  const outDir = path.resolve(o.outDir ?? path.join(root, "data/seed"));
  // Never allow the replace/cleanup path to consume input data or an input ancestor.
  for (const input of [eligibleDir, dispositionsPath, runPath, packPath, companionPath, sourceDir, referenceDir]) {
    if (inside(outDir, input) || inside(input, outDir)) fail("promotion output must be separate from inputs");
  }
  if (existsSync(outDir) && !lstatSync(outDir).isDirectory()) fail("seed destination must be a regular directory");
  if (!lstatSync(eligibleDir).isDirectory()) fail("eligible must be a regular directory");
  const names = TABLES.map((t) => t.name + ".json").sort();
  if (!isDeepStrictEqual(readdirSync(eligibleDir).sort(), names)) fail("eligible directory must contain exactly the allowlisted pack tables");
  const tables = Object.fromEntries(TABLES.map((t) => [t.name, readJson(path.join(eligibleDir, t.name + ".json"))]));
  const run = readJson(runPath);
  if (!run || typeof run !== "object" || Array.isArray(run) || Object.keys(run).some((k) => !RUN_KEYS.includes(k))) fail("unexpected run metadata fields");
  const dispositions = readJson(dispositionsPath);
  const baseline = validateFrozenReference({ sourceDir, destDir: referenceDir, sourceId: o.sourceId ?? "howtogetthereph_dataset" });
  const snapshot = baseline.files.find((f) => f.name === "ncr_routes.json");
  if (!snapshot || run.input_sha256 !== (snapshot.sha256_lf ?? snapshot.sha256)) fail("run input does not match frozen snapshot text digest");
  const rawBytes = readSnapshotBytes(path.join(sourceDir, snapshot.name), snapshot);
  assertRegularFile(packPath);
  const packHash = sha256File(packPath);
  const companion = readJson(companionPath);
  const { manifests, integrity } = readPack(packPath);
  if (integrity.length || manifests.length !== 1) fail("pack integrity or manifest invalid");
  const companionIssues = checkCompanion(companion, manifests[0], packPath);
  if (companionIssues.length) fail("pack companion validation failed: " + companionIssues.map((i) => i.code).join(", "));

  mkdirSync(path.dirname(outDir), { recursive: true });
  const work = mkdtempSync(path.join(path.dirname(outDir), ".seed-promote-"));
  let keepBackup = false;
  try {
    const rawPath = path.join(work, "input.json");
    writeFileSync(rawPath, rawBytes);
    const rebuilt = build({ tables, dispositions, run, rawDatasetPath: rawPath, outDir: path.join(work, "build") });
    if (rebuilt.companion.pack_sha256 !== packHash) fail("pack is stale, corrupt, or inconsistent with eligible inputs");
    if (!isDeepStrictEqual(companion, rebuilt.companion)) fail("companion is stale or inconsistent with pack/run inputs");
    // A concurrent builder replacing either artifact also fails before publication.
    if (sha256File(packPath) !== packHash || !isDeepStrictEqual(readJson(companionPath), companion)) fail("build artifacts changed during promotion");
    const stage = path.join(work, "seed");
    mkdirSync(path.join(stage, "eligible"), { recursive: true });
    for (const t of TABLES) writeJson(path.join(stage, "eligible", t.name + ".json"), tables[t.name]);
    writeJson(path.join(stage, "dispositions.json"), dispositions);
    writeJson(path.join(stage, "run.json"), run);
    writeJson(path.join(stage, COMPANION_FILE), companion);
    writeFileSync(path.join(stage, "pack.sha256"), packHash + "  " + PACK_FILE + "\n");
    const handoff = {
      promoted_at: o.promotedAt ?? new Date().toISOString(),
      source_snapshot_sha256: run.input_sha256,
      source_snapshot_sha256_bytes: snapshot.sha256,
      source_snapshot_sha256_lf: snapshot.sha256_lf,
      eligible_dir: "data/seed/eligible",
      dispositions: "data/seed/dispositions.json",
      run: "data/seed/run.json",
      companion: "data/seed/" + COMPANION_FILE,
      pack_sha256: packHash,
      notes: [
        "Allowlisted eligible tables validated against the built pack and frozen input.",
        "No raw source URLs, Reddit wording, usernames or dataset imports; offline provenance is retained.",
        "Human needs_review items remain quarantined; no automatic acceptance or physical verification.",
        "Source dates are post dates, not field-verification dates.",
      ],
    };
    writeJson(path.join(stage, "HANDOFF.json"), handoff);
    writeFileSync(path.join(stage, "README.md"), [
      "# data/seed - cleaned eligible pack inputs", "",
      "Promoted by tools/corpus/promote-seed.mjs after a deterministic builder validation.", "",
      "eligible/*.json contains only pack tables; dispositions.json and run.json describe",
      "the same build. pack.manifest.json is the builder companion. pack.sha256 is the",
      "checksum of data/raw/out/pack.sqlite (the pack itself is not shipped here).", "",
      "No raw source URLs, Reddit wording, usernames or dataset imports.",
      "Source IDs, post IDs, dates, snapshot hashes and comment indices retain offline provenance.",
      "Raw permalinks remain in the build-input snapshot outside shipped assets.",
      "Unknowns remain unknown; conflicts are preserved.",
      "Human needs_review items are not auto-accepted. Source dates are post dates.",
      "Ignored raw reference bytes are audit inputs only, outside shipped assets.", "",
      "Rebuild: node tools/corpus/run-pipeline.mjs",
      "Promote after a successful build: node tools/corpus/promote-seed.mjs", "",
    ].join("\n"));
    const shipped = scanRoots([stage]);
    if (shipped.findings.length) fail("seed shipped-content validation failed: " + shipped.findings.map((f) => `${path.relative(stage, f.file)}:${f.line} [${f.rule}]`).join(", "));
    const backup = path.join(work, "previous-seed");
    const hadSeed = existsSync(outDir);
    if (hadSeed) rename(outDir, backup);
    try {
      rename(stage, outDir);
    } catch (error) {
      if (hadSeed) {
        try { rename(backup, outDir); }
        catch (rollbackError) {
          keepBackup = true;
          throw new Error("seed rollback failed; preserved backup at " + backup, { cause: rollbackError });
        }
      }
      throw error;
    }
    return { outDir, handoff, companion };
  } finally {
    if (!keepBackup) rmSync(work, { recursive: true, force: true });
  }
}

export function parseArgs(argv) {
  const opts = {};
  const flags = {
    "--eligible": "eligibleDir", "--dispositions": "dispositionsPath", "--run": "runPath",
    "--pack": "packPath", "--companion": "companionPath", "--source": "sourceDir",
    "--reference": "referenceDir", "--source-id": "sourceId", "--out": "outDir",
  };
  for (let i = 0; i < argv.length; i++) {
    const key = flags[argv[i]];
    if (!key || !argv[i + 1] || argv[i + 1].startsWith("--")) fail("invalid argument: " + argv[i]);
    opts[key] = argv[++i];
  }
  return opts;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const r = promoteSeed(parseArgs(process.argv.slice(2)));
    console.log("promoted eligible: " + r.outDir);
    console.log("pack_sha256 " + r.handoff.pack_sha256);
  } catch (e) { console.error("PROMOTION FAILED: " + e.message); process.exitCode = 1; }
}
