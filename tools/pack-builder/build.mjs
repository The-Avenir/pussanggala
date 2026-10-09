#!/usr/bin/env node
// T15 pack builder: eligible records -> pack.sqlite + pack.manifest.json + yield report.
// See README.md for the input format. Plain Node ESM, no dependencies (node:sqlite).
//
// Usage:
//   node tools/pack-builder/build.mjs --eligible <dir> --dispositions <file> --run <file> \
//        --raw howtogetthereph_dataset/ncr_routes.json --out data/raw/out [--no-verify-input]

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "./lib/sqlite.mjs";
import { SCHEMA_VERSION, TABLES, emptyTables } from "./lib/spec.mjs";
import {
  checkManifest, checkRecords, checkSourcePosts, checkSourceSnapshot, leakScan, loadSourceNgrams, sourceSnapshotSha256,
} from "./lib/checks.mjs";

export { leakScan } from "./lib/checks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_SQL_PATH = join(HERE, "schema.sql");
export const PACK_FILE = "pack.sqlite";
export const COMPANION_FILE = "pack.manifest.json";
export const REPORT_JSON = "yield-report.json";
export const REPORT_MD = "yield-report.md";

/**
 * Disposition precedence for posts whose candidates ended in more than one outcome.
 * A post counts once, under the highest-precedence outcome it produced:
 *   included > pending > rejected > filtered
 * "included": >= 1 record in the pack cites it. "pending": human review still open.
 * "rejected": candidates failed review/checks. "filtered": no route evidence.
 */
export const DISPOSITION_PRECEDENCE = Object.freeze(["included", "pending", "rejected", "filtered"]);

export class BuildError extends Error {
  constructor(message, issues) {
    super(message);
    this.name = "BuildError";
    this.issues = issues;
  }
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const sha256File = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

/** Normalize schema.sql newlines so CRLF vs LF checkouts do not change pack bytes. */
export function normalizeSchemaSql(sql) {
  return String(sql).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Read pack DDL with LF-normalized newlines before `db.exec`. */
export function readSchemaSql(path = SCHEMA_SQL_PATH) {
  return normalizeSchemaSql(readFileSync(path, "utf8"));
}

/** Read `<dir>/<table>.json` for each pack table; a missing file is an empty table. */
export function readEligibleDir(dir) {
  const tables = emptyTables();
  for (const t of TABLES) {
    const p = join(dir, `${t.name}.json`);
    if (existsSync(p)) tables[t.name] = readJson(p);
  }
  return tables;
}

/** Resolve {post_id: outcome | outcome[]} to one final outcome per post. */
export function resolveDispositions(raw) {
  const issues = [];
  const final = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { final, issues: [{ code: "dispositions_invalid", table: "dispositions", id: null, detail: "expected an object keyed by post_id" }] };
  }
  for (const postId of Object.keys(raw).sort()) {
    const values = Array.isArray(raw[postId]) ? raw[postId] : [raw[postId]];
    const bad = values.filter((v) => !DISPOSITION_PRECEDENCE.includes(v));
    if (values.length === 0 || bad.length > 0) {
      issues.push({ code: "dispositions_invalid", table: "dispositions", id: postId, detail: "unknown disposition value" });
      continue;
    }
    final[postId] = DISPOSITION_PRECEDENCE.find((d) => values.includes(d));
  }
  return { final, issues };
}

export function countDispositions(final) {
  const counts = Object.fromEntries(DISPOSITION_PRECEDENCE.map((d) => [d, 0]));
  for (const v of Object.values(final)) counts[v] += 1;
  return counts;
}

/** Audit a raw dataset file: post count, answered-post count and post IDs. */
export function auditRawDataset(path) {
  const posts = readJson(path);
  const ids = new Set();
  let answered = 0;
  for (const p of posts) {
    ids.add(String(p.id));
    if (Array.isArray(p.answers) && p.answers.length > 0) answered += 1;
  }
  return { inputPosts: posts.length, answeredPosts: answered, postIds: ids, answeredIds: new Set(posts.filter((p) => p.answers?.length).map((p) => String(p.id))) };
}

const dateOf = (v) => (typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null);

/** Source date range over sources cited by at least one record (posted_at; observed_at fallback). */
export function sourceDateRange(tables) {
  const cited = new Set(tables.record_source.map((r) => r.source_id));
  const dates = tables.source
    .filter((s) => cited.has(s.source_id))
    .map((s) => dateOf(s.posted_at) ?? dateOf(s.observed_at))
    .filter(Boolean)
    .sort();
  return { min: dates[0] ?? null, max: dates.at(-1) ?? null };
}

function sortRows(t, rows) {
  return [...rows].sort((a, b) => {
    const x = a[t.pk];
    const y = b[t.pk];
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0;
  });
}

/** Run PRAGMA integrity_check and foreign_key_check; return issues (empty when clean). */
export function sqliteChecks(db) {
  const issues = [];
  const integrity = db.prepare("PRAGMA integrity_check").all().map((r) => Object.values(r)[0]);
  if (!(integrity.length === 1 && integrity[0] === "ok")) {
    issues.push({ code: "sqlite_integrity", table: null, id: null, detail: `integrity_check reported ${integrity.length} problem(s)` });
  }
  for (const r of db.prepare("PRAGMA foreign_key_check").all()) {
    issues.push({ code: "sqlite_foreign_key", table: r.table, id: String(r.rowid), detail: `foreign key to ${r.parent} violated` });
  }
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version !== SCHEMA_VERSION) {
    issues.push({ code: "schema_version", table: null, id: null, detail: `user_version ${version} != ${SCHEMA_VERSION}` });
  }
  return issues;
}

function writeSqlite(path, tables, manifestRow) {
  rmSync(path, { force: true });
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(readSchemaSql());
    db.exec("BEGIN");
    try {
      for (const t of TABLES) {
        const cols = Object.keys(t.cols);
        const stmt = db.prepare(`INSERT INTO ${t.name} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`);
        for (const row of sortRows(t, tables[t.name])) {
          stmt.run(...cols.map((c) => row[c] ?? null));
        }
      }
      const mcols = Object.keys(manifestRow);
      db.prepare(`INSERT INTO pack_manifest (${mcols.join(", ")}) VALUES (${mcols.map(() => "?").join(", ")})`)
        .run(...mcols.map((c) => manifestRow[c]));
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw new BuildError("SQLite rejected a row", [{ code: "sqlite_constraint", table: null, id: null, detail: String(e.message).split("\n")[0] }]);
    }
    const issues = sqliteChecks(db);
    if (issues.length) throw new BuildError("SQLite checks failed", issues);
  } finally {
    db.close();
  }
}

function countBy(rows, key) {
  const out = {};
  for (const r of rows) out[r[key]] = (out[r[key]] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort());
}

/** Usable-record and coverage counts. Counts of records, not itineraries. */
export function recordReport(tables) {
  const records = Object.fromEntries(TABLES.map((t) => [t.name, tables[t.name].length]));
  const eligibility = {};
  for (const name of ["place_stop", "leg", "walk_link"]) {
    const rows = tables[name];
    eligibility[name] = { ready: rows.filter((r) => r.eligibility === "ready").length, excluded: rows.filter((r) => r.eligibility === "excluded").length };
  }
  const readyLegs = tables.leg.filter((r) => r.eligibility === "ready");
  const readyAccess = tables.place_stop.filter((r) => r.eligibility === "ready");
  const readyWalks = tables.walk_link.filter((r) => r.eligibility === "ready");
  const stopsInReady = new Set([
    ...readyLegs.flatMap((l) => [l.board_stop_id, l.alight_stop_id]),
    ...readyWalks.flatMap((w) => [w.from_stop_id, w.to_stop_id]),
    ...readyAccess.map((a) => a.stop_id),
  ]);
  const coverage = {
    places: tables.place.length,
    places_by_ncr_status: countBy(tables.place, "ncr_status"),
    places_by_mapping_status: countBy(tables.place, "mapping_status"),
    places_with_ready_access: new Set(readyAccess.map((a) => a.place_id)).size,
    stops: tables.stop.length,
    stops_in_ready_records: stopsInReady.size,
    routes: tables.route.length,
    routes_by_mode: countBy(tables.route, "mode"),
    routes_by_service_status: countBy(tables.route, "service_status"),
    routes_with_ready_legs: new Set(readyLegs.map((l) => l.route_id)).size,
    legs_with_fare_reports: new Set(tables.fare_report.map((f) => f.leg_id)).size,
    routes_with_hours_reports: new Set(tables.hours_report.map((h) => h.route_id)).size,
    unambiguous_aliases: tables.place_alias.length,
    ambiguous_aliases: new Set(tables.place_ambiguity.map((a) => a.alias_norm)).size,
    sources_by_kind: countBy(tables.source, "kind"),
  };
  return { records, eligibility, coverage };
}

export function renderReportMd(report) {
  const d = report.dispositions;
  const lines = [
    `# Yield report — ${report.pack_id}`,
    "",
    `- schema_version: ${report.schema_version}`,
    `- created_at: ${report.created_at}`,
    `- input_sha256: \`${report.input_sha256}\``,
    `- pack_sha256: \`${report.pack_sha256}\``,
    `- source dates (post dates, not verification dates): ${report.source_date_min ?? "unknown"} to ${report.source_date_max ?? "unknown"}`,
    "",
    "## Post dispositions",
    "",
    `Precedence: ${report.disposition_precedence.join(" > ")}. Mutually exclusive; sum = answered posts.`,
    "",
    "| input posts | answered | included | pending | rejected | filtered |",
    "|---|---|---|---|---|---|",
    `| ${report.input_posts} | ${report.answered_posts} | ${d.included} | ${d.pending} | ${d.rejected} | ${d.filtered} |`,
    "",
    "## Records per table",
    "",
    "| table | rows |",
    "|---|---|",
    ...Object.entries(report.records).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## Ready vs excluded",
    "",
    "| table | ready | excluded |",
    "|---|---|---|",
    ...Object.entries(report.eligibility).map(([k, v]) => `| ${k} | ${v.ready} | ${v.excluded} |`),
    "",
    "## Coverage",
    "",
    "Record counts only; a post may yield zero or several facts and these are not itinerary counts.",
    "",
    "| metric | value |",
    "|---|---|",
    ...Object.entries(report.coverage).map(([k, v]) => `| ${k} | ${typeof v === "object" ? Object.entries(v).map(([a, b]) => `${a}: ${b}`).join(", ") || "-" : v} |`),
    "",
    "## Checks",
    "",
    `- record checks, SQLite integrity_check and foreign_key_check: clean`,
    `- leak scan (${report.leak_scan.ngram}-word sequences and handles vs ${report.leak_scan.source_ngrams} source n-grams): ${report.leak_scan.hits} hit(s)`,
    "",
  ];
  return lines.join("\n");
}

/**
 * Build the pack.
 * @param {object} o
 * @param {string} [o.eligibleDir]  directory of <table>.json files (or pass o.tables)
 * @param {object} [o.tables]       {sqlTableName: rows[]}
 * @param {object|string} o.dispositions  object or path to JSON
 * @param {object|string} o.run           object or path to JSON (run metadata)
 * @param {string} o.rawDatasetPath  raw dataset JSON used for the leak scan and input audit
 * @param {string} o.outDir
 * @param {boolean} [o.verifyInput=true]  compare run metadata with the raw dataset (sha256, counts, post IDs)
 */
export function build(o) {
  const tables = { ...emptyTables(), ...(o.tables ?? readEligibleDir(o.eligibleDir)) };
  const run = typeof o.run === "string" ? readJson(o.run) : o.run;
  const dispositionsRaw = typeof o.dispositions === "string" ? readJson(o.dispositions) : o.dispositions;
  if (!o.rawDatasetPath) throw new BuildError("rawDatasetPath is required for the leak scan", [{ code: "args", table: null, id: null, detail: "missing rawDatasetPath" }]);
  if (!o.outDir) throw new BuildError("outDir is required", [{ code: "args", table: null, id: null, detail: "missing outDir" }]);

  const issues = [];
  const { final, issues: dispIssues } = resolveDispositions(dispositionsRaw);
  issues.push(...dispIssues);
  const counts = countDispositions(final);
  const totalDisposed = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalDisposed !== run.answered_posts) {
    issues.push({ code: "dispositions_sum", table: "dispositions", id: null, detail: `dispositions sum to ${totalDisposed}, answered_posts is ${run.answered_posts}` });
  }

  if (o.verifyInput !== false) {
    const audit = auditRawDataset(o.rawDatasetPath);
    const sha = sourceSnapshotSha256(o.rawDatasetPath);
    if (sha !== run.input_sha256) issues.push({ code: "input_mismatch", table: "run", id: null, detail: "input_sha256 does not match raw dataset" });
    if (audit.inputPosts !== run.input_posts) issues.push({ code: "input_mismatch", table: "run", id: null, detail: `input_posts ${run.input_posts} != dataset ${audit.inputPosts}` });
    if (audit.answeredPosts !== run.answered_posts) issues.push({ code: "input_mismatch", table: "run", id: null, detail: `answered_posts ${run.answered_posts} != dataset ${audit.answeredPosts}` });
    for (const postId of Object.keys(final)) {
      if (!audit.answeredIds.has(postId)) issues.push({ code: "disposition_unknown_post", table: "dispositions", id: postId, detail: "post is not an answered post in the raw dataset" });
    }
  }

  const range = sourceDateRange(tables);
  const manifestRow = {
    pack_id: run.pack_id,
    schema_version: SCHEMA_VERSION,
    region_id: run.region_id,
    bbox: run.bbox,
    created_at: run.created_at,
    source_date_min: range.min,
    source_date_max: range.max,
    stale_after_days: run.stale_after_days ?? 180,
    input_sha256: run.input_sha256,
    input_posts: run.input_posts,
    answered_posts: run.answered_posts,
    included_posts: counts.included,
    filtered_posts: counts.filtered,
    pending_posts: counts.pending,
    rejected_posts: counts.rejected,
  };

  issues.push(...checkRecords(tables));
  issues.push(...checkManifest(manifestRow, tables));
  issues.push(...checkSourcePosts(tables, final));
  issues.push(...checkSourceSnapshot(tables, manifestRow, o.rawDatasetPath));
  const grams = loadSourceNgrams(o.rawDatasetPath);
  const leaks = leakScan(tables, grams, manifestRow);
  issues.push(...leaks);
  if (issues.length) throw new BuildError(`build failed with ${issues.length} issue(s)`, issues);

  mkdirSync(o.outDir, { recursive: true });
  const packPath = join(o.outDir, PACK_FILE);
  const tmpPath = `${packPath}.tmp`;
  try {
    writeSqlite(tmpPath, tables, manifestRow);
  } catch (e) {
    rmSync(tmpPath, { force: true });
    throw e;
  }
  renameSync(tmpPath, packPath);

  const packSha = sha256File(packPath);
  const packBytes = statSync(packPath).size;
  const companion = {
    pack_id: manifestRow.pack_id,
    schema_version: SCHEMA_VERSION,
    created_at: manifestRow.created_at,
    input_sha256: manifestRow.input_sha256,
    pack_file: PACK_FILE,
    pack_sha256: packSha,
    pack_bytes: packBytes,
    assets: [{ path: PACK_FILE, kind: "pack", sha256: packSha, bytes: packBytes }],
    manifest: manifestRow,
  };
  const rr = recordReport(tables);
  const report = {
    pack_id: manifestRow.pack_id,
    schema_version: SCHEMA_VERSION,
    created_at: manifestRow.created_at,
    input_sha256: manifestRow.input_sha256,
    pack_sha256: packSha,
    input_posts: run.input_posts,
    answered_posts: run.answered_posts,
    disposition_precedence: DISPOSITION_PRECEDENCE,
    dispositions: counts,
    source_date_min: range.min,
    source_date_max: range.max,
    ...rr,
    leak_scan: { ngram: 6, source_ngrams: grams.size, hits: 0 },
  };
  writeFileSync(join(o.outDir, COMPANION_FILE), `${JSON.stringify(companion, null, 2)}\n`);
  writeFileSync(join(o.outDir, REPORT_JSON), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(o.outDir, REPORT_MD), renderReportMd(report));
  return { packPath, companion, report };
}

export function formatIssues(issues) {
  return issues.map((i) => `  [${i.code}] ${i.table ?? "-"} ${i.id ?? "-"}: ${i.detail}`).join("\n");
}

function parseArgs(argv) {
  const args = { verifyInput: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--eligible") args.eligibleDir = resolve(next());
    else if (a === "--dispositions") args.dispositions = resolve(next());
    else if (a === "--run") args.run = resolve(next());
    else if (a === "--raw") args.rawDatasetPath = resolve(next());
    else if (a === "--out") args.outDir = resolve(next());
    else if (a === "--no-verify-input") args.verifyInput = false;
    else throw new Error(`unknown argument ${a}`);
  }
  for (const k of ["eligibleDir", "dispositions", "run", "rawDatasetPath", "outDir"]) {
    if (!args[k]) throw new Error(`missing --${{ eligibleDir: "eligible", rawDatasetPath: "raw", outDir: "out" }[k] ?? k}`);
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { packPath, companion, report } = build(parseArgs(process.argv.slice(2)));
    console.log(`built ${packPath}`);
    console.log(`pack_sha256 ${companion.pack_sha256} (${companion.pack_bytes} bytes)`);
    console.log(`dispositions ${JSON.stringify(report.dispositions)} answered=${report.answered_posts}`);
  } catch (e) {
    if (e instanceof BuildError) {
      console.error(`BUILD FAILED: ${e.message}\n${formatIssues(e.issues)}`);
      process.exitCode = 1;
    } else {
      console.error(e.message);
      process.exitCode = 2;
    }
  }
}
