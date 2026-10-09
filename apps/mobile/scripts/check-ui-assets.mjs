import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/ui-manifest.json'), 'utf8'));
const allowed = new Set(manifest.assets.map(asset => asset.path));
for (const asset of manifest.assets) {
  const file = path.join(root, asset.path);
  const bytes = fs.readFileSync(file);
  assert.ok(bytes.length > 0, `${asset.path} is empty`);
  assert.equal(bytes.length, asset.bytes, `${asset.path} byte count changed`);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256, `${asset.path} no longer matches the export`);
  if (asset.path.endsWith('.svg')) {
    const svgRoot = bytes.toString('utf8').match(/<svg\b[^>]*>/)[0];
    assert.equal(Number(svgRoot.match(/\bwidth="([^"]+)"/)[1]), asset.width);
    assert.equal(Number(svgRoot.match(/\bheight="([^"]+)"/)[1]), asset.height);
  }
}
for (const dir of ['figma', 'fonts', 'licences']) {
  for (const file of fs.readdirSync(path.join(root, 'assets', dir))) {
    assert.ok(allowed.has(`assets/${dir}/${file}`), `UI asset missing from allowlist: ${file}`);
  }
}
const registry = fs.readFileSync(path.join(root, 'src/ui/assets.ts'), 'utf8');
for (const asset of manifest.assets.filter(asset => asset.path.endsWith('.svg'))) {
  assert.ok(registry.includes(`../../${asset.path}`), `${asset.path} missing from asset registry`);
}
assert.ok(!registry.includes('https://'), 'Temporary asset URLs must not ship');
console.log(`PASS: ${manifest.assets.length} UI assets are local, nonempty, allowlisted and match their SHA-256/root dimensions.`);
