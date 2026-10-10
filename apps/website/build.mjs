import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = ['index.html', 'styles.css', 'app.js', 'site-config.js', 'site.webmanifest'];
async function collect(dir) {
  for (const e of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (e.isSymbolicLink()) throw new Error(`Asset symlink refused: ${e.name}`);
    const name = `${dir}/${e.name}`;
    if (e.isDirectory()) await collect(name);
    else if (e.isFile()) files.push(name);
  }
}
await collect('assets');
const manifest = [];
for (const file of files) {
  const source = path.join(root, file);
  const target = path.join(root, 'dist', file);
  const bytes = await readFile(source);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  manifest.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(path.join(root, 'dist', 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${files.length} local files (${manifest.reduce((n, f) => n + f.bytes, 0).toLocaleString()} bytes) in apps/website/dist.`);
