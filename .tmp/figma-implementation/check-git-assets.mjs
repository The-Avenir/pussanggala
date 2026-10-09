import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const manifest = JSON.parse(fs.readFileSync('apps/mobile/assets/ui-manifest.json', 'utf8'));
for (const entry of manifest.assets) {
  const bytes = execFileSync('git', ['show', `HEAD:apps/mobile/${entry.path}`]);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Committed bytes differ: ${entry.path}`);
}
console.log(`PASS: all ${manifest.assets.length} committed asset objects match the UI manifest.`);
