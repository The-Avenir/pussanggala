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
run("tools/corpus/regenerate-heuristic-verdicts.mjs");
run("tools/corpus/ai-apply.mjs");
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
run("tools/eval/allowlist-check.mjs");
console.log("\nPipeline complete.");
