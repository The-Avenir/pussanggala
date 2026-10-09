import fs from 'node:fs';
import crypto from 'node:crypto';
const entries = [];
for (const dir of ['figma', 'fonts', 'licences']) {
  for (const file of fs.readdirSync(`apps/mobile/assets/${dir}`)) {
    const name = `assets/${dir}/${file}`;
    const bytes = fs.readFileSync(`apps/mobile/${name}`);
    const entry = { path: name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    if (file.endsWith('.svg')) {
      const root = bytes.toString('utf8').match(/<svg\b[^>]*>/)[0];
      entry.width = Number(root.match(/\bwidth="([^"]+)"/)[1]);
      entry.height = Number(root.match(/\bheight="([^"]+)"/)[1]);
      entry.nodeAsset = file.replace('.svg', '');
    }
    entries.push(entry);
  }
}
fs.writeFileSync('apps/mobile/assets/ui-manifest.json', JSON.stringify({
  source: 'Figma PmvJnBpOLKVXiQcQAajGt7 · nine requested nodes',
  note: 'Explicit UI asset allowlist. SVGs are exact exports; fonts are bundled local files. No pack/model/map readiness is implied.',
  assets: entries,
}, null, 2) + '\n');
