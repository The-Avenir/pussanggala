import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(root, process.env.UI_DIST ?? 'dist');
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
    }
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
    // §0 readiness check: bundled assets verify, then report missing in this preview.
    await button('Continue').waitFor();
    assert.equal(await page.getByText('Missing', { exact: true }).count(), 3, 'Readiness reports each missing asset');
    assert.ok(await page.getByText(/nothing to download|ship inside the app/i).isVisible(), 'Readiness never offers a download');
    assert.equal(await page.getByRole('tab').count(), 0, 'Launch check has no tabs');
    await capture('readiness');
    await button('Continue').click();
    // §1 welcome: mascot, name, tagline, Continue only (accounts deferred).
    assert.ok(await page.getByTestId('gaile-wave').isVisible(), 'Gaile welcomes first-time users');
    assert.ok(await page.getByRole('heading', { name: 'Pusang Gala', exact: true }).isVisible());
    assert.ok(await page.getByText('Kahit saan ang lakbay, handang pumatnubay.').isVisible());
    assert.equal(await page.getByRole('tab').count(), 0, 'Onboarding has one clear way in');
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
    await button('Continue without an account').click();
    // §3 Ask tab is the home conversation.
    assert.ok(await page.getByRole('heading', { name: 'Saan tayo pupunta?', exact: true }).isVisible(), 'Ask leads with the destination question');
    assert.ok(await button('Monumento → One Ayala').isVisible(), 'Suggestion chips use pack-style places');
    assert.ok(await page.getByText('Your questions stay on this phone.').isVisible());
    assert.equal(await page.getByRole('tab').count(), 4, 'Four tabs: Ask, Map, Saved, Profile');
    assert.ok(await button('Plan with landmarks').isVisible(), 'Manual endpoint entry stays reachable');
    assert.ok(await button('Use my location').isVisible(), 'Composer offers location');
    await capture('ask-empty');
    await largeText('ask-empty');
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
    assert.equal(await page.getByText(keyboardQuery, { exact: true }).count(), 1, 'Enter sends the query exactly once');
    await send('How do I get to Masinag from Cubao?');
    await page.getByText(/outside Metro Manila|covers NCR only/i).waitFor();
    assert.ok(await page.getByText(/outside Metro Manila|covers NCR only/i).isVisible(), 'Out-of-scope destination gets a clear scope failure');
    assert.equal(await page.getByText(/ROUTE SUMMARY/i).count(), 0, 'A real query never silently produces synthetic route data');
    await capture('ask-out-of-scope');
    // §4a clarification: ambiguous alias opens the sheet; a tap chooses.
    await send('Paano pumunta sa SM?');
    await page.getByRole('dialog', { name: 'Which place?' }).waitFor();
    assert.ok(await page.getByRole('heading', { name: 'Which place?' }).isVisible(), 'Ambiguous place asks instead of guessing');
    await page.getByRole('button', { name: 'SM City Manila' }).click();
    await page.getByText(/Got it — SM City Manila/).waitFor();
    // §4c: a typed street address offers nearby supported landmarks.
    await send('Mula Blk 5 Lot 3 Mabini St papunta Monumento');
    await page.getByRole('dialog', { name: 'Nearby supported landmark' }).waitFor();
    assert.ok(await page.getByText(/don’t have routes from that exact address/).isVisible(), 'Unsupported address offers landmarks');
    await page.getByRole('button', { name: /Caloocan City Hall/ }).click();
    await page.getByText(/I’ll use Caloocan City Hall as the starting point/).waitFor();
    // Fresh conversation returns the empty state with the manual-entry row.
    await button('New trip').click();
    await button('New trip').last().click();
    // F1 manual entry via the Plan screen.
    await button('Plan with landmarks').click();
    assert.ok(await button('Find routes').isVisible(), 'Manual route form is visible');
    assert.ok(await page.getByRole('button', { name: 'Edit starting point', exact: true }).isVisible());
    await capture('plan');
    await button('Find routes').click();
    await page.getByRole('textbox', { name: 'Landmark name' }).fill('Monumento');
    await button('Use this landmark').click();
    await button('Edit destination').click();
    await page.getByRole('textbox', { name: 'Landmark name' }).fill('Masinag');
    await button('Use this landmark').click();
    await button('Find routes').click();
    assert.ok(await page.getByText(/outside NCR/).isVisible(), 'Out-of-NCR endpoint gets a recovery notice');
    await page.getByRole('alert').getByRole('button', { name: 'Edit destination' }).click();
    await page.getByRole('textbox', { name: 'Landmark name' }).fill('One Ayala');
    await button('Use this landmark').click();
    await button('Find routes').click();
    assert.ok(await page.getByText(/Route data isn’t installed. Your endpoints/).isVisible(), 'Real manual query must not produce a fixture');
    await capture('route-unavailable');
    await button('Check offline resources').click();
    assert.equal(await page.getByText('Missing', { exact: true }).count(), 3);
    await button('Re-check files').click();
    assert.ok(await page.getByText(/no resource was downloaded/).isVisible());
    await capture('offline');
    await button('Go back').click();
    assert.ok(await button('Find routes').isVisible(), 'Returning from resources preserves the manual form');
    // §6 options: four fixtures, honest badges, unknown-fare divider, footnote.
    await button('Try an example journey').click();
    await capture('options');
    assert.equal(await page.getByRole('radio').count(), 4, 'All options including the unreported one are listed');
    assert.ok(await page.getByText('Lowest reported fare', { exact: true }).first().isVisible(), 'Cheapest badge is qualified');
    assert.ok(await page.getByText('Fare not fully reported').isVisible(), 'Unknown fares sit below a divider');
    assert.ok(await page.getByText(/Compared among 3 of 4 options with full fare reports/).isVisible());
    await button('Sort by fewest transfers').click();
    assert.ok(await page.getByText(/ties break on the lowest reported fare/i).isVisible());
    await page.getByRole('radio', { name: 'Carousel direct', exact: true }).click();
    await tab('Saved').click();
    await capture('saved-empty');
    assert.ok(await page.getByText('Save a route with ☆ to find it here.').isVisible());
    await tab('Ask').click();
    assert.ok(await page.getByRole('radio', { name: 'Carousel direct', checked: true }).isVisible(), 'Tab navigation retains selection and stack');
    await button('See directions').click();
    await capture('directions-direct');
    assert.equal(await page.getByRole('button', { name: /^Show step / }).count(), 2, 'All directions remain in one timeline');
    await button('Show step 2').click();
    assert.ok(await page.getByText('PITX', { exact: true }).isVisible());
    assert.ok(await page.getByText(/Reported over 180 days ago/).isVisible(), 'Old reports carry an age warning');
    await button('Save route').click();
    await button('Got it').click();
    await tab('Saved').click();
    await button('Manage route').click();
    await button('Rename').click();
    await page.getByRole('textbox', { name: 'Saved route name' }).fill('Office commute');
    await button('Save name').click();
    await capture('saved-route');
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
    assert.ok(await page.getByText(/Map unavailable on this device/).isVisible());
    assert.equal(await page.locator('svg[aria-label*="position"]').count(), 0);
    await button('Use stop diagram').click();
    // §2 primer then §4b confirm sheet.
    await button('Location').click();
    await page.getByRole('dialog', { name: 'Use your location?' }).waitFor();
    assert.ok(await page.getByText(/only while the app is open/).isVisible(), 'Location use asks first');
    await button('Allow').click();
    await page.getByRole('radio', { name: /LRT-1 Monumento/ }).click();
    await button('Start from here').click();
    await button('Got it').click();
    await tab('Saved').click(); // Returns to this tab's stored route detail.
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
    await page.getByText(/Forward steps haven’t been reused/).waitFor();
    await send('Paano pumunta sa Masinag from Cubao?');
    await page.getByText(/outside Metro Manila/).last().waitFor();
    await capture('chat-outside-ncr');
    await button('New trip').click();
    await button('New trip').last().click();
    assert.ok(await page.getByTestId('gaile-wave').isVisible(), 'Gaile introduces the conversation');
    await capture('chat-empty');
    await button('Try the example question').click();
    await page.getByText(/ROUTE SUMMARY · EXAMPLE DATA/).waitFor();
    assert.ok(await page.getByText('₱31–44 reported').isVisible(), 'Summary card qualifies the fare');
    await button('Cheaper?').waitFor();
    await page.getByText(/Tara\. This example uses Carousel/).waitFor();
    await capture('chat');
    await largeText('chat');
    await send('Saan ako bababa?');
    await page.getByText(/In the example, get off at One Ayala/).waitFor();
    await send('Anong oras last trip?');
    await page.getByText(/Operating hours aren’t reported/).waitFor();
    await button('Other options').first().click();
    await button('Sort by cheapest').click();
    await page.getByRole('radio', { name: 'Carousel + MRT-3', exact: true }).click();
    await button('See directions').click();
    assert.equal(await page.getByRole('button', { name: /^Show step / }).count(), 4);
    await button('Show step 4').click();
    assert.ok(await page.getByText(/Fare reports differ: ₱12 \(Jul 2026\) · ₱24 \(Feb 2026\)/).isVisible(), 'Conflicting fares show both values with dates');
    assert.ok(await page.getByText(/Reported first\/last trip/).isVisible(), 'Ride steps show reported hours');
    await button('Show step 1').click();
    assert.ok(await page.getByText(/RIDER TIPS/).isVisible(), 'Steps carry paraphrased tips');
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
    await page.getByText(/In the example, get off at North Avenue/).waitFor();
    await button('Resume active trip').click();
    // §13 settings sections.
    await button('Open settings').click();
    await capture('settings');
    await largeText('settings');
    await button('Default preference').click();
    await button('Sort by fastest').click();
    assert.ok(await button('Reply language').isVisible());
    assert.ok(await button('Gaile\'s personality').isVisible());
    assert.ok(await button('Permission').isVisible());
    assert.ok(await button('Sign in with Google').isVisible());
    await button('Storage & privacy').click();
    await capture('privacy');
    await button('Delete all my data').click();
    await button('Cancel').click();
    await button('Go back').click();
    await tab('Map').click();
    await button('Resume active trip').click();
    assert.ok(await page.getByText('Step 2 of 4', { exact: true }).isVisible());
    await button('Back a step').click();
    assert.ok(await page.getByText('Step 1 of 4', { exact: true }).isVisible());
    await button('End trip').click();
    await button('End trip').last().click();
    // §12 profile.
    await tab('Profile').click();
    assert.ok(await page.getByRole('heading', { name: 'Commuter' }).isVisible());
    assert.ok(await page.getByText('Your trips and location never leave this phone.').isVisible());
    await button('Help & tips').click();
    assert.ok(await page.getByText(/WHAT “REPORTED” MEANS/).isVisible());
    await capture('help');
    await button('Go back').click();
    await tab('Saved').click();
    await button('Trip history').click();
    await capture('history');
    await button('Saved routes').click();
    await button('Open settings').click();
    await button('Storage & privacy').click();
    await button('Delete all my data').click();
    await button('Delete all data').click();
    while (await button('Go back').count()) await button('Go back').click();
    assert.equal(await button('Office commute').count(), 0);
    await tab('Ask').click();
    assert.equal(await button('Start example trip').count(), 0, 'Cleared context cannot silently reopen a default fixture');
    assert.ok(await page.getByRole('heading', { name: 'Saan tayo pupunta?', exact: true }).isVisible());
    // Text enlargement stress check. Native Dynamic Type/VoiceOver still requires a phone.
    await largeText('ask');
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
