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
const types = { '.html': 'text/html', '.js': 'application/javascript', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!target.startsWith(dist + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', types[path.extname(target)] ?? 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
server.unref();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/ui-manifest.json'), 'utf8'));
const expected = new Map(manifest.assets.filter(asset => asset.nodeAsset).map(asset => [asset.nodeAsset, asset]));
const seen = new Set();
const geometry = [];
const runtimeErrors = [];
const externalRequests = [];

try {
  for (const width of [390, 320, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', error => runtimeErrors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(base) && !/^(data|blob):/.test(request.url())) externalRequests.push(request.url()); });
    const button = name => page.getByRole('button', { name, exact: true });
    const tab = name => page.getByRole('tab', { name, exact: true });
    async function capture(name) {
      await page.screenshot({ path: path.join(screenshots, `${width}-${name}.png`) });
      const measurements = await page.locator('svg[data-testid^="figma-"]').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { id: node.dataset.testid.replace('figma-', ''), width: rect.width, height: rect.height, x: rect.x };
      }));
      for (const actual of measurements) {
        const asset = expected.get(actual.id);
        assert.ok(asset, `Unallowlisted rendered asset: ${actual.id}`);
        assert.ok(actual.width > 0 && actual.height > 0, `${name}: empty asset ${actual.id}`);
        assert.ok(Math.abs(actual.width / actual.height - asset.width / asset.height) < 0.01, `${name}: distorted asset ${actual.id}`);
        assert.ok(actual.width <= asset.width + 0.1, `${name}: asset enlarged unexpectedly ${actual.id}`);
        assert.ok(actual.x >= -0.1 && actual.x + actual.width <= width + 0.1, `${name}: asset overflows phone ${actual.id}`);
        seen.add(actual.id); geometry.push({ screen: name, viewport: width, ...actual });
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`);
    }

    await page.goto(base);
    await button('Continue without an account →').waitFor();
    await page.evaluate(() => Promise.all(['NunitoBold', 'NunitoExtraBold', 'DMSans', 'DMSansBold'].map(font => document.fonts.load(`14px ${font}`))));
    const fontStatus = await page.evaluate(() => [...document.fonts].map(font => ({ family: font.family, status: font.status })));
    assert.ok(fontStatus.filter(font => font.status === 'loaded').length >= 4, `Bundled fonts not ready: ${JSON.stringify(fontStatus)}`);
    // Once files are loaded, every navigation/action below runs with networking disabled.
    await context.setOffline(true);
    await capture('welcome');
    await button('Continue without an account →').click();
    await button('Explore Monumento → One Ayala').click();
    await capture('ask');
    assert.ok(await page.getByRole('textbox', { name: 'Ask Pusang Gala' }).isVisible(), 'Ask composer must remain visible');
    await button('Cheapest').click();
    await capture('options');
    assert.equal(await page.getByRole('radio').count(), 3, 'Each itinerary should appear once');
    await button('Fastest').click(); // Cheapest and Fastest refer to the same itinerary.
    await page.getByRole('radio', { checked: true }).waitFor();
    assert.equal(await page.getByRole('radio', { checked: true }).count(), 1);
    await capture('options-fastest');
    await button('Fewest transfers').click();
    await page.getByRole('radio').first().click();
    await button('See directions →').click();
    assert.ok(await page.getByText('Step 1 of 2', { exact: true }).isVisible());
    await button('Start trip →').click();
    await tab('Saved').click();
    assert.ok(await page.getByRole('button', { name: 'On the way to One Ayala · Step 1 of 2 →', exact: true }).isVisible());
    await button('On the way to One Ayala · Step 1 of 2 →').click();
    await button('Stop trip').click();
    await button('Cancel').click();
    assert.ok(await page.getByText('Step 1 of 2', { exact: true }).isVisible());
    await button('Stop trip').click();
    await button('Stop trip').last().click();

    await button('Cheapest').click();
    await button('See directions →').click();
    await capture('steps');
    await button('Show step 2').click();
    assert.ok(await page.getByText('PITX', { exact: true }).isVisible());
    await button('← Previous').click();
    await button('Map / Schematic').click();
    await capture('schematic');
    await button('Map view').click();
    await capture('map');
    await button('Location').click();
    await button('Cancel').click();
    await button('Go back').click();
    await button('☆ Save').click();
    await button('Got it').click();
    await tab('Saved').click();
    await button('Rename').click();
    await page.getByRole('textbox', { name: 'Saved route name' }).fill('Papasok sa office');
    await button('Save name').click();
    assert.ok(await page.getByText('Papasok sa office', { exact: true }).isVisible());
    await button('View steps →').click();
    await button('Start trip →').click();
    await capture('active');
    await button('View design illustration').click();
    await capture('active-illustration');
    await button('Show stop diagram').click();
    assert.ok(await button('← Back').isDisabled());
    await button('I’m here — next step →').click();
    await button('← Back').click();
    assert.ok(await page.getByText('Step 1 of 4', { exact: true }).isVisible());
    await button('Open settings').click();
    await capture('settings');
    await page.getByRole('button', { name: /Offline data NCR/ }).click();
    await capture('offline');
    assert.equal(await page.getByText('Missing', { exact: true }).count(), 3);
    await button('Re-check files').click();
    assert.ok(await page.getByRole('alert').isVisible());
    await tab('Profile').click();
    await page.getByRole('button', { name: 'On the way to One Ayala · Step 1 of 4 →', exact: true }).click();
    for (let step = 0; step < 3; step += 1) await button('I’m here — next step →').click();
    await button('I’m here — finish trip →').click();
    assert.ok(await page.getByText('Nakarating ka!', { exact: true }).isVisible());
    await button('Plan return trip →').click();
    assert.ok(await page.getByRole('alert').isVisible());
    assert.equal(await page.getByRole('button', { name: 'See route steps', exact: true }).count(), 0, 'Reverse request must never reuse forward legs');
    const input = page.getByRole('textbox', { name: 'Ask Pusang Gala' });
    await input.fill('Pa-Masinag galing Cubao'); await button('Send question').click();
    assert.ok(await page.getByText(/outside Metro Manila/).isVisible());
    await input.fill('Paano pumunta sa Monumento galing One Ayala?'); await button('Send question').click();
    assert.equal(await page.getByRole('button', { name: 'See route steps', exact: true }).count(), 0);
    await button('Open settings').click();
    await page.getByRole('button', { name: /Storage & privacy/ }).click();
    await button('Delete all my data').click(); await button('Cancel').click();
    await tab('Saved').click(); assert.ok(await page.getByText('Papasok sa office', { exact: true }).isVisible());
    await button('Open settings').click(); await page.getByRole('button', { name: /Storage & privacy/ }).click();
    await button('Delete all my data').click(); await button('Delete all data').click();
    await tab('Saved').click();
    assert.equal(await button('View steps →').count(), 0);
    await context.close();
  }
  assert.deepEqual(runtimeErrors, [], 'Browser runtime errors');
  assert.deepEqual(externalRequests, [], 'App should never request external resources');
  assert.equal(seen.size, expected.size, `Unseen assets: ${[...expected.keys()].filter(key => !seen.has(key)).join(', ')}`);
  fs.writeFileSync(path.join(screenshots, 'asset-geometry.json'), JSON.stringify(geometry, null, 2));
  console.log(`PASS: offline screen flows at 320/390/430px; ${seen.size} exact SVG assets checked; no runtime errors or external requests.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
