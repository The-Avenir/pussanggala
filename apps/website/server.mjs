import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const publicFiles = new Set(['index.html', 'styles.css', 'app.js', 'site-config.js', 'site.webmanifest']);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
    }
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(root, name);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative) ||
        (!publicFiles.has(name) && !name.startsWith('assets/'))) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const info = await stat(target);
    if (!info.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    if (req.method === 'HEAD') res.end(); else createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Pusang Gala website: http://127.0.0.1:${port}`));
