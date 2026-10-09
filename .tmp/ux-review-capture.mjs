import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from '../apps/mobile/node_modules/playwright/index.mjs';
const root = path.resolve('docs');
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = path.resolve(root, '.' + pathname);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
  const type = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json' }[path.extname(target)];
  res.setHeader('Content-Type', type ?? 'text/plain; charset=utf-8');
  fs.createReadStream(target).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/ux-review.html');
  await page.getByRole('button', { name: 'Active trip', exact: true }).click();
  await page.locator('#preview').evaluate(img => img.decode());
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  assert.ok((await page.locator('#preview').getAttribute('src')).includes('ui-screens/390-active'));
  await page.getByRole('button', { name: 'Redesign', exact: true }).click();
  await page.getByLabel('Capture width').selectOption('320');
  await page.locator('#preview').evaluate(img => img.decode());
  await page.getByRole('button', { name: 'Home / Plan', exact: true }).click();
  await page.getByLabel('Capture width').selectOption('390');
  await page.locator('#preview').evaluate(img => img.decode());
  await page.screenshot({ path: path.join(root, 'ux-review-preview.png') });
  assert.deepEqual(errors, []);
  const frames = [
    ['welcome', '01 · Welcome'], ['plan', '02 · Plan'], ['chat', '03 · Conversation'],
    ['options', '04 · Compare'], ['directions', '05 · Directions'], ['active', '06 · Active trip'],
    ['schematic', '07 · Stop diagram'], ['offline', '08 · Offline resources'], ['settings', '09 · Settings'],
  ];
  for (const [id] of frames) assert.ok(fs.existsSync(path.join(root, 'ux-screens', '390-' + id + '.png')));
  await page.setViewportSize({ width: 1088, height: 1100 });
  await page.setContent('<html><head><style>*{box-sizing:border-box}body{margin:0;padding:40px;background:#fff0dd;color:#2e1c14;font:16px system-ui}h1{font-size:32px;margin:0 0 8px;letter-spacing:-1px}p{color:#756052;margin:0 0 32px}main{display:grid;grid-template-columns:repeat(3,320px);gap:32px 24px}figure{margin:0}figcaption{font-size:16px;font-weight:600;margin:0 0 12px}img{width:320px;border:1px solid #e8d3be;border-radius:14px;background:white}footer{color:#756052;font-size:14px;margin-top:32px}</style></head><body><h1>Pusang Gala</h1><p>Where to go? / Playful mascot-led commute chat · Existing sunset colors · Plan · Map · Trips</p><main>'
    + frames.map(([id, label]) => '<figure><figcaption>' + label + '</figcaption><img src="' + base + '/ux-screens/390-' + id + '.png" alt="' + label + '"></figure>').join('')
    + '</main><footer>Actual app previews · NCR scope · Example route data · Native integration and device acceptance pending</footer></body></html>');
  await page.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  await page.screenshot({ path: path.join(root, 'ux-overview.png'), fullPage: true });
  console.log('PASS: design review before/after and width controls; overview and review captures saved.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
