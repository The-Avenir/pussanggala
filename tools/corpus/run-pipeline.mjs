#!/usr/bin/env node
// End-to-end Member 1 pipeline: T10 → T11 → T12 → T13 → T14 → T15 → T16.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const node = process.execPath;

function run(rel, args = []) {
  const script = path.join(ROOT, rel);
  console.log(`\n=== ${rel} ${args.join(" ")} ===`);
  const r = spawnSync(node, [script, ...args], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`FAILED ${rel} exit=${r.status}`);
    process.exit(r.status ?? 1);
  }
}

run("tools/corpus/freeze-reference.mjs");
run("tools/corpus/audit.mjs");
run("tools/corpus/extract.mjs");
run("tools/corpus/evidence.mjs");
// T12 part B (ai-apply) is skipped: committed ai-verdicts.json targets the
// historical 19,709-candidate extractor IDs. Re-sample after T11 stabilizes.
console.log("\n=== skip tools/corpus/ai-apply.mjs (verdicts stale vs new T11 IDs) ===");
run("tools/corpus/places.mjs");
run("tools/corpus/eligible.mjs");
run("tools/pack-builder/build.mjs", [
  "--eligible",
  "data/raw/t14/eligible",
  "--dispositions",
  "data/raw/t14/dispositions.json",
  "--run",
  "data/raw/t14/run.json",
  "--raw",
  "howtogetthereph_dataset/ncr_routes.json",
  "--out",
  "data/raw/out",
]);
run("tools/pack-builder/acceptance.mjs", [
  "--pack",
  "data/raw/out/pack.sqlite",
  "--raw",
  "howtogetthereph_dataset/ncr_routes.json",
]);
run("tools/corpus/promote-seed.mjs");
console.log("\nPipeline complete.");
