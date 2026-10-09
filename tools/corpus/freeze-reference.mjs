#!/usr/bin/env node
// Freeze a pre-cleaned copy of howtogetthereph_dataset for reference.
// Large files are local (gitignored); README + SHA256SUMS are committed.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "howtogetthereph_dataset");
const DEST = path.join(ROOT, "data/reference/howtogetthereph_dataset-precleaned");

const sha256File = (filePath) => {
  const buf = readFileSync(filePath);
  const lf = Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
  return {
    bytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
    sha256_lf: createHash("sha256").update(lf).digest("hex"),
  };
};

mkdirSync(DEST, { recursive: true });
const files = readdirSync(SRC).filter((f) => statSync(path.join(SRC, f)).isFile()).sort();
const lines = [];
const frozenAt = new Date().toISOString();

for (const name of files) {
  const from = path.join(SRC, name);
  const to = path.join(DEST, name);
  copyFileSync(from, to);
  const h = sha256File(from);
  lines.push(`${h.sha256_lf}  ${name}  bytes=${h.bytes}  sha256_as_checked_out=${h.sha256}`);
  console.log(`copied ${name}`);
}

writeFileSync(path.join(DEST, "SHA256SUMS.txt"), lines.join("\n") + "\n");
writeFileSync(
  path.join(DEST, "README.md"),
  `# Pre-cleaned dataset reference (frozen)

This directory is a **byte copy** of \`howtogetthereph_dataset/\` taken before / beside
eligible-pack cleaning (Approach 1). It is the reference snapshot for audits.

- Frozen at: \`${frozenAt}\`
- Working input path (unchanged): \`howtogetthereph_dataset/\`
- Cleaned pack inputs live in \`data/seed/\` (no raw Reddit wording).
- Large JSON/CSV/DIGEST files here are **gitignored**; recreate with:

\`\`\`sh
node tools/corpus/freeze-reference.mjs
\`\`\`

Checksums below use LF-normalized bytes for text files where applicable
(\`ncr_routes.json\` contract sha256 \`d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3\`).

See \`SHA256SUMS.txt\` for per-file digests.
`,
);
console.log(`reference frozen → ${DEST}`);
