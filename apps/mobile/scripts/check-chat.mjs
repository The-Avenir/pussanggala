import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dist = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const target = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!target.startsWith(dist + path.sep) || !existsSync(target)) { response.writeHead(404).end(); return; }
  response.setHeader('Content-Type', target.endsWith('.js') ? 'application/javascript' : target.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  response.end(readFileSync(target));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button', { name: 'Plan a journey', exact: true }).click();
  await page.evaluate(() => {
    window.replyFrames = [];
    new MutationObserver(() => {
      const reply = document.querySelector('[data-testid="reply-1"]');
      if (reply) window.replyFrames.push(reply.textContent);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  async function send(query) {
    await page.getByRole('textbox', { name: 'Ask Pusang Gala', exact: true }).fill(query);
    await page.getByRole('button', { name: 'Send question', exact: true }).click();
  }
  await send('Who are you?');
  await page.waitForFunction(() => document.querySelector('[data-testid="reply-1"]')?.textContent.endsWith('Saan tayo pupunta?'));
  assert.match(await page.getByTestId('reply-1').innerText(), /I’m Gaile/);
  const frames = await page.evaluate(() => [...new Set(window.replyFrames)]);
  assert.ok(frames.length > 3, 'Identity reply appears progressively in the actual UI');
  assert.ok(frames.some(text => text.includes('▍')), 'Streaming cursor is visible');
  assert.ok(frames.every(text => !text.includes('"inserts"')), 'Raw model format never appears');
  await send('What do you know?');
  await page.waitForFunction(() => document.querySelector('[data-testid="reply-2"]')?.textContent.endsWith('I don’t have live traffic or service updates.'));
  const fullCapability = await page.getByTestId('reply-2').innerText();
  assert.match(fullCapability, /reported fares and hours/);
  await send('What can you do?');
  await page.getByRole('button', { name: 'Stop reply', exact: true }).click();
  const stopped = await page.getByTestId('reply-3').innerText();
  await page.waitForTimeout(200);
  assert.equal(await page.getByTestId('reply-3').innerText(), stopped, 'Stop drops all pending reply updates');
  assert.notEqual(stopped, fullCapability, 'Stopped reply does not finish in the background');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'New conversation', exact: true }).click();
  assert.equal(await page.locator('[data-testid^="reply-"]').count(), 0);
  await send('Hello!');
  await page.waitForFunction(() => document.querySelector('[data-testid="reply-4"]')?.textContent.endsWith('Try “Paano pumunta Recto to Cubao?”'));
  assert.match(await page.getByTestId('reply-4').innerText(), /Saan ka manggagaling/);
  assert.deepEqual(errors, []);
  console.log('PASS: identity, capabilities, progressive replies, Stop, conversation reset, and no runtime errors.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
