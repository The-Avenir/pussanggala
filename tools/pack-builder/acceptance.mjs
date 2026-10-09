#!/usr/bin/env node
// T16 corpus acceptance: re-validate a built pack and run the invalid-record, ambiguity
// and source-content fixtures against it. Prints a pass/fail summary (IDs and codes only,
// never record text) and exits non-zero on any failure.
//
// Usage:
//   node tools/pack-builder/acceptance.mjs --pack data/raw/out/pack.sqlite \
//        [--companion data/raw/out/pack.manifest.json] [--raw howtogetthereph_dataset/ncr_routes.json] [--json]

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "./lib/sqlite.mjs";
import { MANIFEST_COLS, TABLES, emptyTables } from "./lib/spec.mjs";
import { ISSUE_GROUP, checkManifest, checkRecords, checkSourceSnapshot, leakScan, loadSourceNgrams } from "./lib/checks.mjs";
import { MUTATIONS, clone } from "./lib/mutations.mjs";
import { COMPANION_FILE, sha256File, sqliteChecks, sourceDateRange } from "./build.mjs";

/** Validate the existing v1 companion against the actual SQLite manifest and file. */
export function checkCompanion(companion, manifest, packPath) {
  const issues = [];
  const add = (code, detail) => issues.push({ code, table: null, id: null, detail });
  if (!companion || typeof companion !== "object" || Array.isArray(companion)) {
    return [{ code: "companion_invalid", table: null, id: null, detail: "companion must be an object" }];
  }
  const sha = sha256File(packPath);
  const bytes = statSync(packPath).size;
  if (companion.pack_sha256 !== sha) add("pack_sha256_mismatch", "companion pack_sha256 does not match pack file");
  for (const key of ["pack_id", "schema_version", "created_at", "input_sha256"]) {
    if (!manifest || companion[key] !== manifest[key]) add(key === "pack_id" ? "pack_id_mismatch" : "companion_metadata_mismatch", `companion ${key} differs from pack_manifest`);
  }
  if (!companion.manifest || typeof companion.manifest !== "object" || Array.isArray(companion.manifest)
    || Object.keys(companion.manifest).length !== MANIFEST_COLS.length
    || MANIFEST_COLS.some((key) => !manifest || companion.manifest[key] !== manifest[key])) {
    add("companion_manifest_mismatch", "companion manifest differs from the SQLite manifest");
  }
  if (companion.pack_file !== basename(packPath)) add("companion_file_mismatch", "pack_file differs from the actual filename");
  if (companion.pack_bytes !== bytes) add("companion_bytes_mismatch", "pack_bytes differs from the actual file size");
  const assets = companion.assets;
  if (!Array.isArray(assets) || assets.length !== 1 || !assets[0]
    || assets[0].kind !== "pack" || assets[0].path !== basename(packPath)
    || assets[0].sha256 !== sha || assets[0].bytes !== bytes) {
    add("companion_asset_mismatch", "assets must describe the built pack with its actual path, checksum and bytes");
  }
  return issues;
}

/** Read every pack table back out of SQLite as {sqlTableName: rows[]} plus the manifest row. */
export function readPack(packPath) {
  const db = new DatabaseSync(packPath, { readOnly: true });
  try {
    const tables = emptyTables();
    for (const t of TABLES) {
      const cols = Object.keys(t.cols);
      tables[t.name] = db.prepare(`SELECT ${cols.join(", ")} FROM ${t.name} ORDER BY ${t.pk}`).all()
        .map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
    }
    const manifests = db.prepare(`SELECT ${MANIFEST_COLS.join(", ")} FROM pack_manifest`).all()
      .map((r) => Object.fromEntries(MANIFEST_COLS.map((c) => [c, r[c]])));
    const integrity = sqliteChecks(db);
    return { tables, manifests, integrity };
  } finally {
    db.close();
  }
}

/**
 * Run acceptance checks.
 * @returns {{ok:boolean, checks:Array<{group:string,name:string,ok:boolean,issues:object[]}>}}
 */
export function runAcceptance({ packPath, companionPath, rawDatasetPath }) {
  const checks = [];
  const push = (group, name, issues, ok = issues.length === 0) => checks.push({ group, name, ok, issues });

  const { tables, manifests, integrity } = readPack(packPath);
  push("integrity", "SQLite integrity_check, foreign_key_check, user_version", integrity);

  const manifestIssues = manifests.length === 1
    ? checkManifest(manifests[0], tables)
    : [{ code: "manifest_invalid", table: "pack_manifest", id: null, detail: `expected 1 row, found ${manifests.length}` }];
  if (manifests.length === 1) {
    const range = sourceDateRange(tables);
    if (manifests[0].source_date_min !== range.min || manifests[0].source_date_max !== range.max) manifestIssues.push({ code: "manifest_dates_mismatch", table: "pack_manifest", id: null, detail: "source date range differs from cited sources" });
  }
  push("invalid-record", "pack_manifest row and post-disposition reconciliation", manifestIssues);

  const recordIssues = checkRecords(tables);
  for (const group of ["invalid-record", "ambiguity"]) {
    push(group, `pack records: ${group} checks`, recordIssues.filter((i) => (ISSUE_GROUP[i.code] ?? "invalid-record") === group));
  }

  const cPath = companionPath ?? join(dirname(packPath), COMPANION_FILE);
  if (existsSync(cPath)) {
    let issues;
    try {
      issues = checkCompanion(JSON.parse(readFileSync(cPath, "utf8")), manifests[0], packPath);
    } catch {
      issues = [{ code: "companion_invalid", table: null, id: null, detail: "companion could not be read as JSON" }];
    }
    push("integrity", "companion manifest external checksum", issues);
  } else {
    push("integrity", "companion manifest external checksum", [{ code: "companion_missing", table: null, id: null, detail: "companion manifest not found" }]);
  }

  let grams = null;
  if (rawDatasetPath) {
    grams = loadSourceNgrams(rawDatasetPath);
    push("integrity", "raw snapshot identity, counts and evidence locators", checkSourceSnapshot(tables, manifests[0] ?? {}, rawDatasetPath));
    push("source-content", "pack text: no 6-word source copies or usernames", leakScan(tables, grams, manifests[0]));
  } else {
    push("source-content", "pack text: no 6-word source copies or usernames", [{ code: "raw_missing", table: null, id: null, detail: "--raw not given; leak scan not run" }]);
  }

  // Fixtures: each mutation of the pack's own records must be rejected with the expected code.
  for (const m of MUTATIONS) {
    if (m.needsGrams && !grams) {
      push(m.group, `fixture rejects: ${m.name}`, [{ code: "raw_missing", table: null, id: null, detail: "needs --raw" }]);
      continue;
    }
    let found = [];
    let applyError = null;
    try {
      const t = clone(tables);
      m.apply(t, { grams });
      found = [...checkRecords(t), ...(m.group === "source-content" ? leakScan(t, grams ?? new Set()) : [])];
    } catch (e) {
      applyError = e;
    }
    const caught = found.some((i) => i.code === m.expect);
    push(m.group, `fixture rejects: ${m.name}`,
      caught ? [] : [{ code: "fixture_not_rejected", table: null, id: null, detail: applyError ? `fixture not applicable: ${applyError.message}` : `expected ${m.expect}` }]);
  }

  return { ok: checks.every((c) => c.ok), checks };
}

export function formatSummary(result) {
  const lines = [];
  const groups = [...new Set(result.checks.map((c) => c.group))];
  for (const g of groups) {
    const cs = result.checks.filter((c) => c.group === g);
    lines.push(`${g}: ${cs.filter((c) => c.ok).length}/${cs.length} passed`);
    for (const c of cs) {
      lines.push(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
      for (const i of c.issues.slice(0, 20)) lines.push(`        [${i.code}] ${i.table ?? "-"} ${i.id ?? "-"}: ${i.detail}`);
      if (c.issues.length > 20) lines.push(`        ... ${c.issues.length - 20} more`);
    }
  }
  const total = result.checks.length;
  const passed = result.checks.filter((c) => c.ok).length;
  lines.push(`ACCEPTANCE ${result.ok ? "PASS" : "FAIL"} (${passed}/${total} checks)`);
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const opts = {};
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--pack") opts.packPath = resolve(argv[++i]);
    else if (argv[i] === "--companion") opts.companionPath = resolve(argv[++i]);
    else if (argv[i] === "--raw") opts.rawDatasetPath = resolve(argv[++i]);
    else if (argv[i] === "--json") json = true;
    else { console.error(`unknown argument ${argv[i]}`); process.exit(2); }
  }
  if (!opts.packPath || !existsSync(opts.packPath)) { console.error("--pack <pack.sqlite> is required"); process.exit(2); }
  const result = runAcceptance(opts);
  console.log(json ? JSON.stringify(result, null, 2) : formatSummary(result));
  process.exitCode = result.ok ? 0 : 1;
}
