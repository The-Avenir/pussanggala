#!/usr/bin/env node
// Copy T14 eligible tables + metadata into data/seed/ (INV-4: no raw posts).
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ELIGIBLE = path.join(ROOT, "data/raw/t14/eligible");
const OUT = path.join(ROOT, "data/seed");
const PACK = path.join(ROOT, "data/raw/out/pack.sqlite");
const COMPANION = path.join(ROOT, "data/raw/out/pack.sqlite.sha256");

if (!existsSync(ELIGIBLE)) {
  console.error("missing data/raw/t14/eligible — run eligible.mjs first");
  process.exit(1);
}

mkdirSync(path.join(OUT, "eligible"), { recursive: true });
cpSync(ELIGIBLE, path.join(OUT, "eligible"), { recursive: true });
cpSync(path.join(ROOT, "data/raw/t14/dispositions.json"), path.join(OUT, "dispositions.json"));
cpSync(path.join(ROOT, "data/raw/t14/run.json"), path.join(OUT, "run.json"));

let packSha = null;
if (existsSync(PACK)) {
  packSha = createHash("sha256").update(readFileSync(PACK)).digest("hex");
  writeFileSync(path.join(OUT, "pack.sha256"), `${packSha}  pack.sqlite\n`);
}
if (existsSync(COMPANION)) {
  cpSync(COMPANION, path.join(OUT, "pack.sqlite.sha256"));
}

const handoff = {
  promoted_at: new Date().toISOString(),
  source_snapshot_sha256: "d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3",
  eligible_dir: "data/seed/eligible",
  dispositions: "data/seed/dispositions.json",
  run: "data/seed/run.json",
  pack_sha256: packSha,
  notes: [
    "Eligible tables only — no raw Reddit wording or usernames (INV-4).",
    "needs_review candidates were never accepted by agents; they remain quarantined.",
    "No field-verified badge; source dates are post dates.",
    "Rebuild pack: node tools/pack-builder/build.mjs --eligible data/seed/eligible --dispositions data/seed/dispositions.json --run data/seed/run.json --raw howtogetthereph_dataset/ncr_routes.json --out data/raw/out",
  ],
};
writeFileSync(path.join(OUT, "HANDOFF.json"), JSON.stringify(handoff, null, 2) + "\n");

writeFileSync(
  path.join(OUT, "README.md"),
  `# data/seed — cleaned eligible pack inputs

**Owner:** Member 1. Promoted from T14 by \`tools/corpus/promote-seed.mjs\`.

## Contents

| Path | Purpose |
|------|---------|
| \`eligible/*.json\` | Pack tables (places, routes, legs, …) — paraphrases only |
| \`dispositions.json\` | Per-post disposition |
| \`run.json\` | Build run metadata |
| \`pack.sha256\` | Checksum of last built \`data/raw/out/pack.sqlite\` (file itself gitignored) |
| \`HANDOFF.json\` | Machine-readable handoff note |

## Guardrails

- No raw Reddit wording/usernames (INV-4).
- Unknown fares/times stay unknown; conflicts preserved (INV-5).
- Human \`needs_review\` queue is **not** auto-accepted.
- Pre-cleaned raw snapshot reference: \`data/reference/howtogetthereph_dataset-precleaned/\` (see freeze script).

## Rebuild

\`\`\`sh
node tools/corpus/run-pipeline.mjs
# or promote only after T14/T15:
node tools/corpus/promote-seed.mjs
\`\`\`
`,
);

console.log(`promoted eligible → ${OUT}`);
if (packSha) console.log(`pack_sha256 ${packSha}`);
