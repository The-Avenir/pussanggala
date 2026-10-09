import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, '.tmp/route-pack-build');
execFileSync(process.execPath, ['tools/pack-builder/build.mjs', '--eligible', 'data/seed/eligible',
  '--dispositions', 'data/seed/dispositions.json', '--run', 'data/seed/run.json',
  '--raw', 'howtogetthereph_dataset/ncr_routes.json', '--out', output], { cwd: root, stdio: 'inherit' });
const assetDir = path.join(root, 'apps/mobile/assets/pack');
mkdirSync(assetDir, { recursive: true });
for (const name of ['pack.sqlite', 'pack.manifest.json']) copyFileSync(path.join(output, name), path.join(assetDir, name));
const manifest = JSON.parse(readFileSync(path.join(assetDir, 'pack.manifest.json'), 'utf8'));
const catalog = [
  ['A1-pack-db', 'pack', 'assets/pack/pack.sqlite'],
  ['A2-pack-manifest', 'pack', 'assets/pack/pack.manifest.json'],
  ['A10-pack-notice', 'licence', 'assets/licences/PACK-NOTICE.txt'],
].map(([assetId, kind, bundlePath]) => {
  const bytes = readFileSync(path.join(root, 'apps/mobile', bundlePath));
  return { assetId, kind, bundlePath, sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length, version: manifest.pack_id, license: 'assets/licences/PACK-NOTICE.txt' };
});
writeFileSync(path.join(root, 'apps/mobile/src/routing/packCatalog.json'), JSON.stringify(catalog, null, 2) + '\n');
