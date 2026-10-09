// Static server for the Pusang Gala Figma plugin.
// Serves the screen/token specs and the trimmed Gaile PNGs to the plugin
// iframe, and accepts POST /inventory (written to ./inventory.json).
// Usage: node serve.mjs   (listens on http://127.0.0.1:5577)

import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const MASCOT_DIR = join(ROOT, '..', '..', 'apps', 'mobile', 'assets', 'mascot', 'trimmed');
const PORT = 5577;

const TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/^\/+/, '');
  if (clean.includes('..') || clean.includes('\\')) return null;
  if (clean.startsWith('assets/')) {
    const name = clean.slice('assets/'.length);
    if (!/^gaile-[a-z]+\.png$/.test(name)) return null;
    return join(MASCOT_DIR, name);
  }
  if (/^spec\/[\w.-]+\.json$/.test(clean)) return join(ROOT, clean);
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(`${new Date().toISOString()} ${req.method} ${url.pathname}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && url.pathname === '/inventory') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      JSON.parse(body);
    } catch {
      res.writeHead(400); res.end('invalid JSON'); return;
    }
    const out = join(ROOT, 'inventory.json');
    await writeFile(out, body);
    console.log(`  wrote ${out} (${body.length} bytes)`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }

  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }

  const file = resolvePath(url.pathname);
  if (!file) { res.writeHead(404); res.end('not found'); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Content-Length': data.length,
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`figma-mockups server on http://127.0.0.1:${PORT}`);
  console.log(`  spec:    ${join(ROOT, 'spec')}`);
  console.log(`  assets:  ${MASCOT_DIR}`);
});
