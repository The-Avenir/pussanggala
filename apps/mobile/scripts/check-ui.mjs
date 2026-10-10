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
const travelSource = fs.readFileSync(path.join(root, 'src/ui/travel.tsx'), 'utf8');
const shellSource = fs.readFileSync(path.join(root, 'src/screens/MobileShell.tsx'), 'utf8');
assert.doesNotMatch(shellSource, /\bCatMark\b/, 'The app shell uses Gaile artwork instead of a custom SVG cat brand mark');
assert.doesNotMatch(travelSource, /\b(?:export\s+)?function\s+CatMark\b/, 'The custom SVG cat brand mark is removed while functional SVG icons remain available');
const paletteBody = travelSource.match(/export const palette = \{([\s\S]*?)\} as const;/)?.[1];
assert.ok(paletteBody, 'Read the live UI color tokens for contrast checks');
const palette = Object.fromEntries([...paletteBody.matchAll(/(\w+):\s*'(#[\da-fA-F]{6})'/g)].map(([, name, value]) => [name, value]));
function luminance(hex) {
  const values = hex.replace('#', '').match(/../g).map(item => parseInt(item, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
const contrast = [];
for (const [foregroundToken, backgroundToken] of [['ink', 'paper'], ['secondary', 'paper'], ['accent', 'paper'], ['white', 'accent'],
  ['warning', 'warningSoft'], ['white', 'dark'], ['secondary', 'background'], ['accent', 'accentSoft'],
  ['secondary', 'goldSoft'], ['accent', 'goldSoft'], ['ink', 'gold']]) {
  const foreground = palette[foregroundToken], background = palette[backgroundToken];
  assert.ok(foreground && background, `Contrast tokens ${foregroundToken}/${backgroundToken} exist in the live palette`);
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
      await settleReply();
    }
    async function settleReply() { await page.waitForFunction(() => !document.querySelector('[aria-label="Stop reply"]')); }
    async function largeText(name) {
      await page.evaluate(() => {
        for (const node of document.querySelectorAll('[dir="auto"], input, textarea')) {
          node.dataset.originalFont = node.style.fontSize;
          node.dataset.originalLine = node.style.lineHeight;
          const size = parseFloat(getComputedStyle(node).fontSize);
          node.style.fontSize = size * 2 + 'px';
          node.style.lineHeight = size * 2.6 + 'px';
        }
      });
      await capture(name + '-text-200');
      const overflow = await page.locator('[dir="auto"], input, textarea').evaluateAll(nodes => nodes.filter(node => {
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
    await page.waitForFunction(() => [...document.fonts].some(font => font.family === 'NunitoExtraBold' && font.status === 'loaded')
      && [...document.fonts].some(font => font.family === 'DMSans' && font.status === 'loaded'));
    await page.evaluate(() => document.fonts.ready);
    await context.setOffline(true);
    await capture('welcome');
    await largeText('welcome');
    await button('Plan a journey').click();
    assert.ok(await page.getByRole('heading', { name: 'Where to go?', exact: true }).isVisible(), 'Home leads with the destination question');
    const homeGaile = page.locator('[data-testid^="gaile-"]');
    assert.ok(await homeGaile.count() > 0 && await homeGaile.first().isVisible(), 'Home uses the supplied Gaile artwork');
    assert.ok(await page.getByRole('textbox', { name: 'Ask Pusang Gala', exact: true }).isVisible(), 'Home has a conversational entry');
    assert.ok(await button('Enter landmarks').isVisible(), 'Manual endpoint entry is available as a disclosure');
    assert.equal(await button('Enter landmarks').getAttribute('aria-expanded'), 'false', 'Manual entry announces its collapsed state');
    assert.equal(await button('Find routes').count(), 0, 'Manual controls are initially collapsed');
    await capture('home');
    await capture('plan');
    await largeText('home');
    const composer = page.getByRole('textbox', { name: 'Ask Pusang Gala', exact: true });
    await composer.fill('Paano pumunta');
    await composer.press('Shift+Enter');
    await page.keyboard.type('sa Cubao?');
    assert.equal(await composer.inputValue(), 'Paano pumunta\nsa Cubao?', 'Shift+Enter inserts a newline without sending');
    assert.equal(await page.getByText('Paano pumunta', { exact: true }).count(), 0, 'A newline does not send the draft');
    const keyboardQuery = 'Paano pumunta sa Cubao from Monumento?';
    await composer.fill(keyboardQuery);
    await composer.press('Enter');
    await page.getByText(keyboardQuery, { exact: true }).waitFor();
    await settleReply();
    assert.equal(await page.getByText(keyboardQuery, { exact: true }).count(), 1, 'Enter sends the home query exactly once');
    await button('Go back').click();
    const homeQuery = 'How do I get to Masinag from Cubao?';
    await page.getByRole('textbox', { name: 'Ask Pusang Gala', exact: true }).fill(homeQuery);
    await button('Send question').click();
    await page.getByText(homeQuery, { exact: true }).waitFor();
    await settleReply();
    assert.equal(await page.getByText(homeQuery, { exact: true }).count(), 1, 'Home sends the exact question once');
    assert.ok(await page.getByText(/outside (Metro Manila|NCR)|covers NCR only|NCR-only/i).isVisible(), 'Out-of-scope destination gets a clear scope failure');
    assert.equal(await page.getByText(/ROUTE INFORMATION · EXAMPLE/i).count(), 0, 'A real query never silently produces synthetic route data');
    await capture('home-query-out-of-scope');
    await button('Go back').click();
    await button('Enter landmarks').click();
    assert.equal(await button('Enter landmarks').getAttribute('aria-expanded'), 'true', 'Manual entry announces its expanded state');
    assert.ok(await button('Find routes').isVisible(), 'Enter landmarks reveals the existing manual route form');
    assert.ok(await page.getByRole('button', { name: 'Edit starting point', exact: true }).isVisible());
    assert.ok(await page.getByRole('button', { name: 'Edit destination', exact: true }).isVisible());
    await capture('home-landmarks-open');
    await button('How Pusang Gala works').click();
    assert.ok(await page.getByTestId('gaile-wave').isVisible(), 'Onboarding can be revisited');
    await button('Plan a journey').click();
    assert.equal(await button('Enter landmarks').getAttribute('aria-expanded'), 'true', 'Onboarding replay retains the manual disclosure');
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
    assert.equal(await page.getByText('Missing', { exact: true }).count(), 1, 'Only the basemap is missing on web');
    assert.ok(await page.getByText('unsupported', { exact: true }).isVisible(), 'Bundled route data requires a native build');
    assert.ok(await page.getByText('Requires Android or iOS', { exact: true }).isVisible());
    assert.equal(await button('Recheck local files').isDisabled(), true, 'Web cannot validate native model files');
    assert.ok(await page.getByText('Use a native development or release build to install the assistant.', { exact: true }).isVisible());
    await capture('offline');
    await button('Go back').click();
    assert.ok(await button('Find routes').isVisible(), 'Returning from resources preserves the open manual form');
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
    await settleReply();
    assert.ok(await page.getByText(/Forward steps haven’t been reused/).isVisible());
    assert.equal(await button('Directions').count(), 0);
    await send('Paano pumunta sa Masinag from Cubao?');
    assert.equal(await page.getByText('Paano pumunta sa Masinag from Cubao?', { exact: true }).count(), 1);
    assert.ok(await page.getByText(/outside Metro Manila/).last().isVisible());
    await capture('chat-outside-ncr');
    await button('New').click();
    await button('New conversation').click();
    assert.ok(await page.getByTestId('gaile-think').isVisible(), 'Gaile introduces the conversation');
    await capture('chat-empty');
    await button('Try the example question').click();
    await settleReply();
    await capture('chat');
    await largeText('chat');
    await send('Saan ako bababa?');
    assert.ok(await page.getByText(/In the example, get off at One Ayala/).isVisible());
    await send('Anong oras last trip?');
    assert.ok(await page.getByText(/I don’t have the operating hours/).isVisible());
    await button('Other options').click();
    await button('Sort by fare').click();
    await page.getByRole('radio', { name: 'Carousel + MRT-3', exact: true }).click();
    await button('See directions').click();
    assert.equal(await page.getByRole('button', { name: /^Show step / }).count(), 4);
    await button('Show step 2').click();
    await capture('directions');
    await largeText('directions');
    assert.equal(await button('Sources & limitations').count(), 0, 'Directions keep source metadata out of the traveler flow');
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
