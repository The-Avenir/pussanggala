/**
 * T01 allowlist-check tests (INV-4). No dependencies, no network.
 *
 * Positive: every leak class is rejected. Negative: the clean tree passes.
 * Run locally with:
 *   node --test tools/eval/allowlist-check.test.mjs
 * CI also exercises these paths via `node tools/eval/allowlist-check.mjs`,
 * which runs the same fixtures as built-in self-tests on every invocation.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCAN_SUBDIRS,
  RAW_PHRASES,
  checkContent,
  scanRoots,
  runSelfTests,
  scanAssetInventory,
} from "./allowlist-check.mjs";

const LEAKS = {
  url: "see https://www.reddit.com/r/HowToGetTherePH/comments/1sp0fnw/x/ for details",
  username: "thanks u/commuter123 for the tip",
  verbatim:
    "There are jeepneys going to Sta. Maria Bulacan that traverses Mc. Arthur Highway and passes infront of SM Marilao",
  long:
    "Synthetic fixture leak (not real data): sumakay ako ng jeep sa monumento biyaheng malinta " +
    "tapos bumaba ako sa terminal malapit sa sm hypermarket at sumakay ulit ng bus papuntang " +
    "pitx station bago mag-transfer sa lrt para hindi ma-late sa trabaho kaninang umaga sa " +
    "gitna ng edsa traffic na sobrang haba ng pila ngayong araw.",
  rawImport: 'import data from "../../../howtogetthereph_dataset/ncr_routes.json";',
  rawSchema: "const top = row.top_answer;",
};

const CLEAN = {
  placeholder: "Real route cards land in T45. Synthetic text only - not pack data.",
  guardComment: "Never imports `howtogetthereph_dataset/` (INV-4).",
  guardMarker: '  "howtogetthereph_dataset",',
  datasetNote:
    "howtogetthereph_dataset/ exists at the repo root as intentional build input and is not scanned.",
  policyNote: "no raw Reddit wording or usernames in the shipped pack or app prompts.",
  codeVocab: "This business logic handles station readiness states for the loader.",
};

describe("allowlist-check positive fixtures (leak rejected)", () => {
  it("rejects reddit permalinks", () => {
    assert.ok(checkContent(LEAKS.url, false).some((f) => f.rule === "reddit-url"));
  });
  it("rejects reddit usernames", () => {
    assert.ok(checkContent(LEAKS.username, false).some((f) => f.rule === "reddit-username"));
  });
  it("rejects verbatim long comment text", () => {
    assert.ok(checkContent(LEAKS.verbatim, false).some((f) => f.rule === "raw-phrase"));
  });
  it("rejects long comment-like paragraphs", () => {
    assert.ok(checkContent(LEAKS.long, false).some((f) => f.rule === "long-comment"));
  });
  it("rejects raw dataset imports in code", () => {
    assert.ok(checkContent(LEAKS.rawImport, true).some((f) => f.rule === "raw-import"));
  });
  it("rejects raw snapshot schema fields in code", () => {
    assert.ok(checkContent(LEAKS.rawSchema, true).some((f) => f.rule === "raw-schema"));
  });
  it("rejects a planted fixture file on disk", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "allowlist-test-"));
    try {
      fs.writeFileSync(path.join(tmp, "seed.json"), JSON.stringify({ note: RAW_PHRASES[0] }));
      const res = scanRoots([tmp]);
      assert.ok(res.findings.length > 0, "expected the planted leak to be rejected");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("allowlist-check negative fixtures (clean tree passes)", () => {
  it("passes clean placeholder and guard idioms", () => {
    for (const [name, text] of Object.entries(CLEAN)) {
      const isCode = name !== "datasetNote" && name !== "policyNote";
      assert.deepEqual(checkContent(text, isCode), [], `expected clean: ${name}`);
    }
  });
  it("does not scan howtogetthereph_dataset/ itself", () => {
    assert.ok(
      !SCAN_SUBDIRS.some((d) => d.includes("howtogetthereph_dataset")),
      `scan roots must exclude the build-input dir: ${SCAN_SUBDIRS.join(", ")}`,
    );
  });
  it("passes a clean fixture tree", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "allowlist-test-"));
    try {
      fs.writeFileSync(path.join(tmp, "ok.ts"), "export const ready = true;\n");
      const res = scanRoots([tmp]);
      assert.deepEqual(res.findings, []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
  it("passes the real clean trees", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "..", "..");
    const dirs = SCAN_SUBDIRS.map((d) => path.join(repoRoot, d)).filter((d) =>
      fs.existsSync(d),
    );
    const res = scanRoots(dirs);
    assert.equal(res.findings.length, 0, `clean tree must pass: ${JSON.stringify(res.findings)}`);
  });
  it("built-in self-tests pass", () => {
    const self = runSelfTests();
    assert.ok(self.ok, `self-tests failed: ${JSON.stringify(self.results)}`);
  });
});

describe("explicit asset inventory includes binary inputs", () => {
  const withTree = (create, check) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "t41-inventory-"));
    const assetDir = path.join(root, "apps/mobile/assets");
    fs.mkdirSync(assetDir, { recursive: true });
    try { create(assetDir, root); check(scanAssetInventory(root)); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
  };
  it("rejects an unlisted SQLite input without needing to decode it", () => {
    withTree(dir => fs.writeFileSync(path.join(dir, "raw-copy.sqlite"), Buffer.from([0, 1, 2])),
      result => assert.equal(result.findings[0]?.rule, "asset-not-allowlisted"));
  });
  it("rejects raw-input paths even when the content has an allowed binary extension", () => {
    withTree(dir => {
      const raw = path.join(dir, "HOWTOGETTHEREPH_DATASET"); fs.mkdirSync(raw);
      fs.writeFileSync(path.join(raw, "pack.sqlite"), Buffer.from([0]));
    }, result => assert.equal(result.findings[0]?.rule, "asset-not-allowlisted"));
  });
  it("accepts the exact pack path and per-file glyph paths", () => {
    withTree(dir => {
      fs.mkdirSync(path.join(dir, "pack")); fs.writeFileSync(path.join(dir, "pack/pack.sqlite"), Buffer.from([0]));
      fs.mkdirSync(path.join(dir, "map/glyphs/Fixture Font"), { recursive: true });
      fs.writeFileSync(path.join(dir, "map/glyphs/Fixture Font/0-255.pbf"), Buffer.from([0]));
    }, result => { assert.equal(result.filesScanned, 2); assert.deepEqual(result.findings, []); });
  });
  it("rejects an asset symlink/junction instead of silently skipping it", () => {
    withTree((dir, root) => {
      const target = path.join(root, "raw-source"); fs.mkdirSync(target);
      fs.symlinkSync(target, path.join(dir, "source-link"), "junction");
    }, result => assert.equal(result.findings[0]?.rule, "asset-symlink"));
  });
});
