#!/usr/bin/env node
/**
 * T01 shipped-content allowlist check (INV-4).
 *
 * Scans the shippable source trees — apps/mobile, tools/map-pack, data/seed —
 * for leaked raw Reddit content (verbatim long comment text, Reddit usernames,
 * misplaced Reddit links, raw-dataset imports) and FAILS (exit 1) when found.
 * Canonical SOURCE.url thread provenance is metadata allowed by the documented SOURCE contract.
 *
 * The supplied `howtogetthereph_dataset/` snapshot at the repo root is
 * intentional off-device build input. It is NEVER scanned, so this check
 * MUST NOT fail merely because that directory exists. Only copies of its raw
 * wording/usernames inside the scanned trees are failures.
 *
 * Usage (from the repo root):
 *   node tools/eval/allowlist-check.mjs
 *   node tools/eval/allowlist-check.mjs --self-test-only   # positive+negative fixtures only
 *   node tools/eval/allowlist-check.mjs --no-self-test     # skip built-in fixtures
 *   node tools/eval/allowlist-check.mjs --root <repoRoot>  # scan another checkout
 *
 * Exit codes: 0 = clean tree and self-tests pass; 1 = leak found;
 * 2 = self-test failure or usage error.
 *
 * No secrets, no network: this script only reads local files. The bundled
 * verbatim phrases below are short distinctive build-input samples used as a
 * blocklist; this file lives in tools/eval/ (outside the scanned trees), so
 * the blocklist itself never trips the scan.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isPackagedPath, NON_SHIPPED_ASSET_DOCS } from "../../apps/mobile/src/assets/shipping-policy.mjs";

/** Shippable trees, relative to the repo root. `howtogetthereph_dataset/` is intentionally absent. */
export const SCAN_SUBDIRS = ["apps/mobile", "tools/map-pack", "data/seed"];

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".expo",
  "dist",
  "build",
  "__pycache__",
  ".android",
  ".ios",
]);

const SKIP_FILES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]);

const BINARY_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".pbf",
  ".pmtiles",
  ".mbtiles",
  ".sqlite",
  ".db",
  ".gguf",
  ".bin",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".zip",
  ".tgz",
  ".gz",
  ".map",
]);

/** Code/data files where raw-dataset import/schema references are also failures. Docs (.md) are exempt there. */
const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);

const MAX_SCAN_BYTES = 5 * 1024 * 1024;

/** Raw Reddit permalink / subreddit URL. */
export const REDDIT_URL_RE = /reddit\.com|\/r\/HowToGetTherePH/i;

/** Reddit username mention: u/<name> (also matches /u/<name> via the "/" prefix class). */
export const USERNAME_RE = /(?:^|[\s([>"'/:])u\/[A-Za-z0-9_-]{3,}/;

/**
 * Distinctive verbatim samples of raw build-input comment text (long comment
 * leak blocklist). Compared case-insensitively on whitespace-collapsed text so
 * wrapped copies are still caught. Kept to three short samples: enough to
 * prove verbatim leakage is rejected without redistributing the corpus here.
 */
export const RAW_PHRASES = [
  "there are jeepneys going to sta. maria bulacan that traverses mc. arthur highway and passes infront of sm marilao",
  "puwede kang sumakay ng jeep na biyaheng pa-malinta or malanday from smgc",
  "since you have a huge luggage i'd reco aseana/redemptorist station, 2 stations away lang",
];

/** Single long natural-language commute paragraph flags as comment-like text. */
export const LONG_LINE_MIN_LEN = 280;
export const LONG_LINE_MIN_SIGNALS = 2;

/** Longer signals match as substrings (catches sumakay/pagbaba-style affixes). */
const SIGNAL_SUBSTR = [
  "sakay",
  "sumakay",
  "bumaba",
  "jeep",
  "jeepney",
  "tricycle",
  "multicab",
  "terminal",
  "station",
  "biyahe",
  "biyaheng",
  "papunta",
  "papuntang",
  "monumento",
  "commute",
  "pamasahe",
  "transfer",
  "footbridge",
  "overpass",
  "cubao",
  "baclaran",
  "aseana",
];

/** Short signals match on word boundaries only (avoids "business" -> "bus"). */
const SIGNAL_WORDS = [
  "baba",
  "bus",
  "lrt",
  "mrt",
  "uv",
  "sm",
  "edsa",
  "taft",
  "pitx",
  "ayala",
];
const SIGNAL_WORD_RES = SIGNAL_WORDS.map((w) => new RegExp(`\\b${w}\\b`, "i"));

function normalize(text) {
  return text.toLowerCase().replace(/\s+/g, " ");
}

export function countSignals(line) {
  const lower = line.toLowerCase();
  let n = 0;
  for (const s of SIGNAL_SUBSTR) {
    if (lower.includes(s)) n += 1;
  }
  for (const re of SIGNAL_WORD_RES) {
    if (re.test(line)) n += 1;
  }
  return n;
}

/** import/from/require/read/open/load/fetch ... howtogetthereph_dataset (same line). */
export const RAW_IMPORT_RE =
  /\b(import|from|require|readfile|readfilesync|open|load|fetch)\b[^\n;]{0,200}howtogetthereph_dataset/i;
/** A concrete raw file pulled in as an asset: howtogetthereph_dataset/...csv|json|md */
export const RAW_FILE_RE = /howtogetthereph_dataset\/[^\s"'`]*\.(csv|json|md)/i;
/** Raw JSON/CSV schema fields that only exist in the uncurated snapshot. */
export const RAW_SCHEMA_RE = /\b(top_answer|answer_count|num_comments|created_utc)\b/;

/**
 * Rules fired by one line. `isCodeFile` enables the raw-import/schema rules
 * (docs may discuss the pipeline without importing it).
 */
export function checkLine(line, isCodeFile) {
  const rules = [];
  if (REDDIT_URL_RE.test(line)) rules.push("reddit-url");
  if (USERNAME_RE.test(line)) rules.push("reddit-username");
  if (isCodeFile) {
    if (RAW_IMPORT_RE.test(line) || RAW_FILE_RE.test(line)) rules.push("raw-import");
    if (RAW_SCHEMA_RE.test(line)) rules.push("raw-schema");
  }
  if (line.length >= LONG_LINE_MIN_LEN && countSignals(line) >= LONG_LINE_MIN_SIGNALS) {
    rules.push("long-comment");
  }
  return rules;
}

/** Rules fired by whole-file text: verbatim blocklist first, then per-line checks. */
export function checkContent(text, isCodeFile) {
  const findings = [];
  const norm = normalize(text);
  for (const phrase of RAW_PHRASES) {
    const at = norm.indexOf(phrase);
    if (at !== -1) {
      const line = text.slice(0, text.toLowerCase().indexOf(phrase.slice(0, 24))).split("\n").length;
      findings.push({
        rule: "raw-phrase",
        line: Number.isFinite(line) ? line : 1,
        snippet: `verbatim raw comment sample: "${phrase.slice(0, 80)}..."`,
      });
    }
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((content, idx) => {
    for (const rule of checkLine(content, isCodeFile)) {
      findings.push({ rule, line: idx + 1, snippet: content.trim().slice(0, 160) });
    }
  });
  return findings;
}

export function isScannableFile(absPath) {
  const base = path.basename(absPath);
  if (SKIP_FILES.has(base)) return false;
  if (BINARY_EXTS.has(path.extname(base).toLowerCase())) return false;
  return true;
}

export function collectFiles(scanDirs) {
  const out = [];
  const visit = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        visit(full);
      } else if (entry.isFile()) {
        if (isScannableFile(full)) out.push(full);
      }
    }
  };
  for (const dir of scanDirs) visit(dir);
  return out.sort();
}

/** SOURCE.url is citation metadata; all other seed fields retain the leak rules. */
function maskSeedThreadLinks(text) {
  let rows;
  try { rows = JSON.parse(text); } catch { return text; }
  if (!Array.isArray(rows)) return text;
  return JSON.stringify(rows.map(row => {
    if (!row || row.kind !== "reddit_thread" || typeof row.url !== "string"
      || typeof row.post_id !== "string" || USERNAME_RE.test(row.url)) return row;
    let url;
    try { url = new URL(row.url); } catch { return row; }
    const match = url.pathname.match(new RegExp("^/r/HowToGetTherePH/comments/([a-z0-9]+)/(?:[^/]+/?)?$"));
    if (url.protocol !== "https:" || !["reddit.com", "www.reddit.com"].includes(url.host)
      || url.username || url.password || url.search || url.hash || match?.[1] !== row.post_id) return row;
    return { ...row, url: "[source thread citation]" };
  }), null, 2);
}

export function scanFile(absPath) {
  let stat;
  try {
    stat = fs.statSync(absPath);
  } catch {
    return [];
  }
  if (stat.size > MAX_SCAN_BYTES) return [];
  let text;
  try {
    text = fs.readFileSync(absPath, "utf8");
  } catch {
    return [];
  }
  if (text.includes("\0")) return [];
  if (absPath.split(path.sep).join("/").endsWith("/data/seed/eligible/source.json")) text = maskSeedThreadLinks(text);
  const isCodeFile = CODE_EXTS.has(path.extname(absPath).toLowerCase());
  return checkContent(text, isCodeFile).map((f) => ({ file: absPath, ...f }));
}

export function scanRoots(scanDirs) {
  const files = collectFiles(scanDirs);
  const findings = [];
  for (const file of files) findings.push(...scanFile(file));
  return { filesScanned: files.length, findings };
}

/** Validate every asset input, including binaries the wording scan cannot read. */
export function scanAssetInventory(repoRoot) {
  const appRoot = path.join(repoRoot, "apps/mobile");
  const assetRoot = path.join(appRoot, "assets");
  const findings = [];
  let filesScanned = 0;
  const report = (file, rule) => findings.push({ file, line: 1, rule, snippet: "Asset input rejected by explicit packaging policy." });
  const visit = (file) => {
    let stat;
    try { stat = fs.lstatSync(file); } catch { report(file, "asset-unreadable"); return; }
    if (stat.isSymbolicLink()) { report(file, "asset-symlink"); return; }
    if (stat.isDirectory()) {
      let names;
      try { names = fs.readdirSync(file); } catch { report(file, "asset-unreadable"); return; }
      for (const name of names) visit(path.join(file, name));
      return;
    }
    if (!stat.isFile()) { report(file, "asset-not-file"); return; }
    filesScanned += 1;
    const relative = path.relative(appRoot, file).split(path.sep).join("/");
    if (!NON_SHIPPED_ASSET_DOCS.includes(relative) && !isPackagedPath(relative)) report(file, "asset-not-allowlisted");
  };
  if (fs.existsSync(assetRoot)) visit(assetRoot);
  return { filesScanned, findings };
}

// ---------------------------------------------------------------------------
// Built-in fixtures: positive (leak rejected) + negative (clean tree passes).
// These run on every invocation so CI's single check command covers both.
// ---------------------------------------------------------------------------

const FIXTURE_LONG_LEAK =
  "Synthetic fixture leak (not real data): sumakay ako ng jeep sa monumento biyaheng malinta " +
  "tapos bumaba ako sa terminal malapit sa sm hypermarket at sumakay ulit ng bus papuntang " +
  "pitx station bago mag-transfer sa lrt para hindi ma-late sa trabaho kaninang umaga sa " +
  "gitna ng edsa traffic na sobrang haba ng pila ngayong araw.";

export function runSelfTests() {
  const results = [];
  const expectFail = (name, text, isCode) => {
    const issues = checkContent(text, isCode);
    results.push({
      name,
      kind: "positive",
      ok: issues.length > 0,
      detail: issues.length > 0 ? issues.map((i) => i.rule).join(",") : "NOT FLAGGED",
    });
  };
  const expectPass = (name, text, isCode) => {
    const issues = checkContent(text, isCode);
    results.push({
      name,
      kind: "negative",
      ok: issues.length === 0,
      detail:
        issues.length === 0
          ? "clean"
          : issues.map((i) => `${i.rule}@${i.line}:${i.snippet.slice(0, 60)}`).join(" | "),
    });
  };

  // Positive: each leak class must be rejected.
  expectFail(
    "reddit permalink rejected",
    "see https://www.reddit.com/r/HowToGetTherePH/comments/1sp0fnw/sm_grand_to_sm_marilao/ for details",
    false,
  );
  expectFail("reddit username rejected", "thanks u/commuter123 for the tip", false);
  expectFail(
    "verbatim long comment rejected",
    "There are jeepneys going to Sta. Maria Bulacan that traverses Mc. Arthur Highway and passes infront of SM Marilao",
    false,
  );
  expectFail("long comment-like paragraph rejected", FIXTURE_LONG_LEAK, false);
  expectFail(
    "raw dataset import rejected",
    'import data from "../../../howtogetthereph_dataset/ncr_routes.json";',
    true,
  );
  expectFail("raw snapshot schema field rejected", "const top = row.top_answer;", true);

  // Negative: clean-tree idioms must pass.
  expectPass(
    "synthetic placeholder passes",
    "Real route cards land in T45. Synthetic text only - not pack data.",
    true,
  );
  expectPass(
    "guard comment passes",
    "Never imports `howtogetthereph_dataset/` (INV-4).",
    true,
  );
  expectPass("guard marker entry passes", '  "howtogetthereph_dataset",', true);
  expectPass(
    "dataset-exists note passes",
    "howtogetthereph_dataset/ exists at the repo root as intentional build input and is not scanned.",
    false,
  );
  expectPass(
    "generic reddit-policy note passes",
    "no raw Reddit wording or usernames in the shipped pack or app prompts.",
    false,
  );
  expectPass(
    "ordinary code vocabulary passes",
    "This business logic handles station readiness states for the loader.",
    true,
  );

  // Integrity: the dataset directory itself is never a scan root.
  results.push({
    name: "dataset dir excluded from scan roots",
    kind: "negative",
    ok: !SCAN_SUBDIRS.some((d) => d.includes("howtogetthereph_dataset")),
    detail: `scan roots: ${SCAN_SUBDIRS.join(", ")}`,
  });

  // End-to-end on temp dirs: clean passes, planted fixture leak fails.
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "allowlist-selftest-"));
    const cleanDir = path.join(tmp, "clean");
    const leakDir = path.join(tmp, "leak");
    fs.mkdirSync(cleanDir, { recursive: true });
    fs.mkdirSync(leakDir, { recursive: true });
    fs.writeFileSync(path.join(cleanDir, "ok.ts"), "export const ready = true;\n");
    const cleanRes = scanRoots([cleanDir]);
    results.push({
      name: "clean fixture tree passes",
      kind: "negative",
      ok: cleanRes.findings.length === 0,
      detail: `${cleanRes.filesScanned} file(s) scanned`,
    });
    fs.writeFileSync(
      path.join(leakDir, "seed.json"),
      JSON.stringify({ note: RAW_PHRASES[0] }),
    );
    const leakRes = scanRoots([leakDir]);
    results.push({
      name: "planted fixture leak rejected",
      kind: "positive",
      ok: leakRes.findings.length > 0,
      detail:
        leakRes.findings.length > 0
          ? leakRes.findings.map((f) => f.rule).join(",")
          : "NOT FLAGGED",
    });
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (err) {
    results.push({
      name: "temp-dir fixture round-trip",
      kind: "positive",
      ok: false,
      detail: String(err),
    });
  }

  const passed = results.filter((r) => r.ok).length;
  return { ok: passed === results.length, passed, total: results.length, results };
}

function printUsage() {
  console.log(`usage: node tools/eval/allowlist-check.mjs [--root <repoRoot>] [--self-test-only] [--no-self-test]`);
}

function main() {
  const args = process.argv.slice(2);
  let root = null;
  let selfTestOnly = false;
  let noSelfTest = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--root" && i + 1 < args.length) {
      root = args[(i += 1)];
    } else if (arg === "--self-test-only") {
      selfTestOnly = true;
    } else if (arg === "--no-self-test") {
      noSelfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.error(`unknown argument: ${arg}`);
      printUsage();
      process.exit(2);
    }
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = root ? path.resolve(root) : path.resolve(scriptDir, "..", "..");

  if (!noSelfTest) {
    const self = runSelfTests();
    const positives = self.results.filter((r) => r.kind === "positive");
    const negatives = self.results.filter((r) => r.kind === "negative");
    console.log(
      `self-test: ${self.passed}/${self.total} passed ` +
        `(${positives.filter((r) => r.ok).length}/${positives.length} positive, ` +
        `${negatives.filter((r) => r.ok).length}/${negatives.length} negative)`,
    );
    for (const r of self.results) {
      console.log(`  [${r.ok ? "ok" : "FAIL"}] (${r.kind}) ${r.name} -- ${r.detail}`);
    }
    if (!self.ok) {
      console.error("SELF-TEST FAILURE: leak detector is broken; refusing to trust the scan.");
      process.exit(2);
    }
    if (selfTestOnly) {
      console.log("PASS: self-tests only; repo scan skipped (--self-test-only).");
      return;
    }
  }

  const scanDirs = SCAN_SUBDIRS.map((d) => path.join(repoRoot, d)).filter((d) => {
    if (!fs.existsSync(d)) {
      console.log(`note: scan dir missing, skipped: ${path.relative(repoRoot, d)}`);
      return false;
    }
    return true;
  });
  const datasetDir = path.join(repoRoot, "howtogetthereph_dataset");
  console.log(
    `note: howtogetthereph_dataset/ at the repo root is intentional build input and is not scanned ` +
      `(${fs.existsSync(datasetDir) ? "present" : "absent"}).`,
  );

  const content = scanRoots(scanDirs);
  const inventory = scanAssetInventory(repoRoot);
  const filesScanned = content.filesScanned;
  const findings = [...content.findings, ...inventory.findings];
  console.log(`asset inventory: ${inventory.filesScanned} input file(s) checked against explicit paths (including binaries).`);
  console.log(
    `scanned ${filesScanned} file(s) in ${scanDirs.map((d) => path.relative(repoRoot, d)).join(", ")}.`,
  );
  if (findings.length > 0) {
    for (const f of findings) {
      const rel = path.relative(repoRoot, f.file);
      console.error(`${rel}:${f.line} [${f.rule}] ${f.snippet}`);
    }
    console.error(
      `FAIL: ${findings.length} raw-content finding(s) in shipped trees (INV-4). ` +
        `Remove the leaked wording/usernames/imports; do not delete howtogetthereph_dataset/ (it is build input).`,
    );
    process.exit(1);
  }
  console.log("PASS: no raw Reddit leak in apps/mobile, tools/map-pack, data/seed (INV-4).");
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) main();
