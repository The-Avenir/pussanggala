import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('.tmp/figma-web');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.ttf': 'font/ttf', '.json': 'application/json', '.png': 'image/png' };
http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(target)] ?? 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('Preview at http://127.0.0.1:4173'));
