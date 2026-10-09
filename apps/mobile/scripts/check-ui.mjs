import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const screenshots = path.resolve(process.env.UI_SCREENSHOTS ?? path.join(dist, 'screenshots'));
fs.mkdirSync(screenshots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!target.startsWith(dist + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', types[path.extname(target)] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  fs.createReadStream(target).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
server.unref();
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const runtimeErrors = [];
const externalRequests = [];
const checks = [];
function luminance(hex) {
  const values = hex.replace('#', '').match(/../g).map(item => parseInt(item, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
const contrast = [];
for (const [foreground, background] of [['#2E1C14', '#FFF9EF'], ['#756052', '#FFF9EF'],
  ['#BA3B16', '#FFF9EF'], ['#FFFFFF', '#BA3B16'], ['#80531D', '#FBF2DD'], ['#E3EDE6', '#253C36'],
  ['#756052', '#FFF0DD'], ['#BA3B16', '#FFE9D8'], ['#756052', '#FFF0C6'], ['#BA3B16', '#FFF0C6']]) {
  const a = luminance(foreground), b = luminance(background);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(ratio >= 4.5, foreground + ' on ' + background + ': ' + ratio);
  contrast.push({ foreground, background, ratio: Number(ratio.toFixed(2)) });
}
try {
  for (const width of [390, 320, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', error => runtimeErrors.push(error.message));
    page.on('request', request => {
      if (!request.url().startsWith(base) && !/^(data|blob):/.test(request.url())) externalRequests.push(request.url());
    });
    const button = name => page.getByRole('button', { name, exact: true });
    const tab = name => page.getByRole('tab', { name, exact: true });
    async function capture(name) {
      await page.getByTestId('main-scroll').evaluate(node => { node.scrollTop = 0; });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: path.join(screenshots, width + '-' + name + '.png') });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ': horizontal page overflow');
      const narrowTargets = await page.locator('[role="button"], [role="tab"], [role="radio"]').evaluateAll(nodes => nodes
        .filter(node => node.getClientRects().length && !node.closest('[inert]')).map(node => {
          const r = node.getBoundingClientRect();
          return { label: node.getAttribute('aria-label') ?? node.textContent, width: r.width, height: r.height };
        }).filter(r => r.width < 43.9 || r.height < 43.9));
      assert.deepEqual(narrowTargets, [], name + ': touch targets below 44px');
      checks.push({ width, screen: name, horizontalOverflow: false, smallTargets: 0 });
    }
    async function send(query) {
      await page.getByRole('textbox', { name: 'Ask Pusang Gala', exact: true }).fill(query);
      await button('Send question').click();
    }
    async function largeText(name) {
      await page.evaluate(() => {
        for (const node of document.querySelectorAll('[dir="auto"]')) {
          node.dataset.originalFont = node.style.fontSize;
          node.dataset.originalLine = node.style.lineHeight;
          const size = parseFloat(getComputedStyle(node).fontSize);
          node.style.fontSize = size * 2 + 'px';
          node.style.lineHeight = size * 2.6 + 'px';
        }
      });
      await capture(name + '-text-200');
      const overflow = await page.locator('[dir="auto"]').evaluateAll(nodes => nodes.filter(node => {
        const r = node.getBoundingClientRect();
        return r.width && (r.left < -1 || r.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 2);
      }).map(node => node.textContent));
      assert.deepEqual(overflow, [], name + ': 200% text overflow');
      await page.evaluate(() => {
        for (const node of document.querySelectorAll('[data-original-font]')) {
          node.style.fontSize = node.dataset.originalFont;
          node.style.lineHeight = node.dataset.originalLine;
        }
      });
    }
    await page.goto(base);
    await button('Plan a journey').waitFor();
    assert.ok(await page.getByTestId('gaile-wave').isVisible(), 'Gaile welcomes first-time users');
    assert.equal(await page.getByRole('tab').count(), 0, 'Onboarding has one clear way into planning');
    // Warm browser assets before blocking networking. This is not native cold-start evidence.
    const assets = fs.readdirSync(path.join(dist, 'assets'), { recursive: true }).filter(file => file.endsWith('.png'));
    await page.evaluate(async urls => Promise.all(urls.map(url => new Promise(resolve => {
      const img = new Image(); img.onload = resolve; img.onerror = resolve; img.src = url;
    }))), assets.map(file => base + '/assets/' + file.replaceAll('\\', '/')));
    await context.setOffline(true);
    await capture('welcome');
    await largeText('welcome');
    await button('Plan a journey').click();
    assert.ok(await page.getByTestId('gaile-map').isVisible(), 'Gaile remains part of home');
    await capture('plan');
    await button('How Pusang Gala works').click();
    assert.ok(await page.getByTestId('gaile-wave').isVisible(), 'Onboarding can be revisited');
    await button('Plan a journey').click();
    assert.ok(await button('Find routes').isVisible(), 'Replaying onboarding returns to planning');
    await button('Find routes').click();
    await page.getByRole('textbox', { name: 'Landmark name' }).fill('Monumento');
    await button('Use this landmark').click();
    await button('Edit destination').click();
    await page.getByRole('textbox', { name: 'Landmark name' }).fill('One Ayala');
    await button('Use this landmark').click();
    await button('Find routes').click();
    assert.ok(await page.getByText(/Route data isn’t installed. Your endpoints/).isVisible(), 'Real manual query must not produce a fixture');
    await capture('route-unavailable');
    await button('Check offline resources').click();
    assert.equal(await page.getByText('Missing', { exact: true }).count(), 3);
    await button('Recheck local files').click();
    assert.ok(await page.getByText(/no resource was downloaded/).isVisible());
    await capture('offline');
    await button('Go back').click();
    await button('Try an example journey').click();
    await capture('options');
    assert.equal(await page.getByRole('radio').count(), 3);
    await button('Sort by transfers').click();
    await page.getByRole('radio', { name: 'Carousel direct', exact: true }).click();
    await tab('Trips').click();
    await capture('trips-empty');
    await tab('Plan').click();
    assert.ok(await page.getByRole('radio', { name: 'Carousel direct', checked: true }).isVisible(), 'Tab navigation must retain selection and stack');
    await button('See directions').click();
    await capture('directions-direct');
    assert.equal(await page.getByRole('button', { name: /^Show step / }).count(), 2, 'All directions remain in one timeline');
    await button('Show step 2').click();
    assert.ok(await page.getByText('PITX', { exact: true }).isVisible());
    await button('Save route').click();
    await button('Got it').click();
    await tab('Trips').click();
    await button('Manage route').click();
    await button('Rename').click();
    await page.getByRole('textbox', { name: 'Saved route name' }).fill('Office commute');
    await button('Save name').click();
    await capture('trips-saved');
    await button('Office commute').click();
    await button('Map / stop diagram').click();
    await capture('schematic');
    await button('Zoom in diagram').click();
    await button('Zoom out diagram').click();
    await button('Inspect step 2: One Ayala').click();
    assert.ok(await page.getByText('PITX', { exact: true }).isVisible());
    await button('Go back').click();
    await button('Map view').click();
    await capture('map-unavailable');
    assert.equal(await page.locator('svg[aria-label*="position"]').count(), 0);
    await button('Use stop diagram').click();
    await button('Location').click();
    await capture('location-unavailable');
    await button('Got it').click();
    await tab('Trips').click(); // Returns to this tab's stored route detail.
    await button('Start example trip').click();
    for (let index = 0; index < 6; index += 1) await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement)), 'Sheet traps keyboard focus');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0, 'Escape dismisses the focused sheet');
    await button('Start example trip').click();
    await button('Cancel').click();
    assert.equal(await button('Resume active trip').count(), 0);
    await button('Start example trip').click();
    await button('Start example trip').last().click();
    assert.ok(await button('Back a step').isDisabled());
    await button('I’m here · Next step').click();
    await capture('active-direct');
    await button('End trip').click();
    await button('Cancel').click();
    assert.ok(await page.getByText('Step 2 of 2', { exact: true }).isVisible());
    await button('I’m here · Finish trip').click();
    await capture('complete');
    await button('Plan return trip').click();
    assert.ok(await page.getByText(/Forward steps haven’t been reused/).isVisible());
    assert.equal(await button('Directions').count(), 0);
    await send('Paano pumunta sa Masinag from Cubao?');
    assert.ok(await page.getByText(/outside Metro Manila/).isVisible());
    await capture('chat-outside-ncr');
    await button('New').click();
    await button('New conversation').click();
    assert.ok(await page.getByTestId('gaile-think').isVisible(), 'Gaile introduces the conversation');
    await capture('chat-empty');
    await button('Try the example question').click();
    await capture('chat');
    await largeText('chat');
    await send('Saan ako bababa?');
    assert.ok(await page.getByText(/In the example, get off at One Ayala/).isVisible());
    await send('Anong oras last trip?');
    assert.ok(await page.getByText(/Operating hours aren’t reported/).isVisible());
    await button('Other options').click();
    await button('Sort by fare').click();
    await page.getByRole('radio', { name: 'Carousel + MRT-3', exact: true }).click();
    await button('See directions').click();
    assert.equal(await page.getByRole('button', { name: /^Show step / }).count(), 4);
    await button('Show step 2').click();
    await capture('directions');
    await largeText('directions');
    await button('Sources & limitations').click();
    await capture('source-limitations');
    await button('Got it').click();
    await button('Start example trip').click();
    await button('Start example trip').last().click();
    await button('I’m here · Next step').click();
    await capture('active');
    await largeText('active');
    await button('Ask about this trip').click();
    await send('Saan ako bababa?');
    assert.ok(await page.getByText(/In the example, get off at North Avenue/).isVisible(), 'Active-trip question uses current ride');
    await button('Resume active trip').click();
    await button('Open settings').click();
    await capture('settings');
    await largeText('settings');
    await button('Default route sort').click();
    await button('Sort by time').click();
    await button('Storage & privacy').click();
    await capture('privacy');
    await button('Delete all my data').click();
    await button('Cancel').click();
    await tab('Map').click();
    await button('Resume active trip').click();
    assert.ok(await page.getByText('Step 2 of 4', { exact: true }).isVisible());
    await button('Back a step').click();
    assert.ok(await page.getByText('Step 1 of 4', { exact: true }).isVisible());
    await button('End trip').click();
    await button('End trip').last().click();
    await tab('Trips').click();
    await button('Trip history').click();
    await capture('history');
    await button('Saved routes').click();
    await button('Open settings').click();
    await button('Storage & privacy').click();
    await button('Delete all my data').click();
    await button('Delete all data').click();
    await button('Go back').click();
    await button('Go back').click();
    assert.equal(await button('Office commute').count(), 0);
    await tab('Plan').click();
    assert.equal(await button('Start example trip').count(), 0, 'Cleared context cannot silently reopen a default fixture');
    while (await button('Go back').count()) await button('Go back').click();
    await button('Find routes').waitFor();
    // Text enlargement stress check. Native Dynamic Type/VoiceOver still requires a phone.
    await largeText('plan');
    await context.close();
  }
  assert.deepEqual(runtimeErrors, [], 'Browser runtime errors');
  assert.deepEqual(externalRequests, [], 'External resource requests');
  fs.writeFileSync(path.join(screenshots, 'validation.json'), JSON.stringify({ checks, contrast, runtimeErrors, externalRequests,
    scope: 'Warm offline browser UI, not native device acceptance' }, null, 2));
  console.log('PASS: travel flows at 320/390/430px; 200% text; >=44px targets; AA token contrast; no runtime errors or external requests.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
