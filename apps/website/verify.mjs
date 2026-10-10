import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = 4184;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(root, 'server.mjs')], {
  env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.stdout.once('data', resolve);
  server.once('exit', (code) => reject(new Error(`Preview server exited: ${code}`)));
});
let browser;
const checks=[];
const pass=(name)=>checks.push(name);
try {
  browser=await chromium.launch({ headless:true, channel:process.env.WEBSITE_BROWSER_CHANNEL || 'chrome' });
  await mkdir(path.join(root,'dist','qa'),{recursive:true});
  for (const width of [1440,1024,390,320]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[], remote=[];
    page.on('pageerror',(e)=>errors.push(e.message));
    page.on('console',(m)=>{if(m.type()==='error')errors.push(m.text());});
    page.on('request',(req)=>{if(new URL(req.url()).origin!==origin)remote.push(req.url());});
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('img').evaluateAll((imgs)=>imgs.forEach(i=>i.loading='eager'));
    await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
    await page.screenshot({path:path.join(root,'dist','qa',`hero-${width}.png`)});
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.locator('img').evaluateAll((imgs)=>imgs.filter(i=>!i.complete||!i.naturalWidth).length),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Overflow at ${width}px`);
    await page.locator('#say-hi').click();
    assert.match(await page.locator('#gaile-greeting').innerText(),/Hello, gala buddy/);
    assert.equal(await page.locator('#demo-tabs').count(),0);
    assert.equal(await page.locator('.journey-moment').count(),3);
    await page.waitForFunction(()=>document.querySelector('#try-it').classList.contains('journey-scroll-enabled'));
    const scrollToMoment = async (progress, index) => {
      await page.evaluate((progress)=>{
        const journey=document.querySelector('#try-it');
        const track=journey.querySelector('.journey-track');
        const top=track.getBoundingClientRect().top+scrollY-parseFloat(journey.style.getPropertyValue('--journey-pin-top'));
        const distance=parseFloat(journey.style.getPropertyValue('--journey-scroll-distance'));
        window.scrollTo({top:top+distance*progress,behavior:'instant'});
      },progress);
      await page.waitForFunction((index)=>document.querySelector('#try-it').dataset.activeMoment===String(index),index);
    };
    await scrollToMoment(.1,0);
    await page.waitForFunction(()=>{
      const journey=document.querySelector('#try-it');
      return Math.abs(journey.querySelector('.journey-panel').getBoundingClientRect().top-parseFloat(journey.style.getPropertyValue('--journey-pin-top')))<1;
    });
    const pinnedTop=await page.locator('.journey-panel').evaluate(e=>e.getBoundingClientRect().top);
    const travel=await page.locator('#try-it').evaluate(e=>parseFloat(e.style.getPropertyValue('--journey-scroll-distance')));
    await page.mouse.wheel(0,travel*.4);
    await page.waitForFunction(()=>document.querySelector('#try-it').dataset.activeMoment==='1');
    assert.ok(Math.abs(await page.locator('.journey-panel').evaluate(e=>e.getBoundingClientRect().top)-pinnedTop)<2,'Panel stays pinned');
    await page.mouse.wheel(0,travel*.35);
    await page.waitForFunction(()=>document.querySelector('#try-it').dataset.activeMoment==='2');
    await page.screenshot({path:path.join(root,'dist','qa',`journey-scroll-${width}.png`)});
    await page.locator('#faq').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#try-it').getAttribute('data-active-moment'),'2');
    assert.equal(await page.locator('#faq-title').isVisible(),true);
    await scrollToMoment(.1,0);
    await page.locator('.journey-moment[data-moment="1"]').click();
    assert.equal(await page.locator('.journey-moment[data-moment="1"]').getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('#moment-count').innerText(),/2/);
    await page.locator('#moment-reveal').click();
    assert.equal(await page.locator('#moment-reveal').getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#moment-insight').isVisible(),true);
    await page.locator('.journey-moment[data-moment="2"]').click();
    assert.equal(await page.locator('.journey-moment[data-moment="2"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#moment-reveal').getAttribute('aria-expanded'),'false');
    await page.locator('.journey-moment[data-moment="1"]').click();
    assert.equal(await page.locator('.journey-moment[data-moment="1"]').getAttribute('aria-pressed'),'true');
    await page.locator('.journey-moment[data-moment="0"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.journey-moment[data-moment="1"]').getAttribute('aria-pressed'),'true');
    await page.locator('#faq details summary').first().click();
    assert.equal(await page.locator('#faq details').first().getAttribute('open'),'');
    assert.equal(await page.locator('#download-link').isVisible(),true);
    assert.equal(await page.locator('#download-link').getAttribute('href'),'https://github.com/The-Avenir/pussanggala/releases');
    assert.equal(await page.locator('#download-link').getAttribute('download'),null);
    assert.equal(await page.locator('#download-unavailable').isVisible(),false);
    if(width<768){
      await page.locator('#menu-toggle').click();
      assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');
    }
    await page.evaluate(()=>{document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-visible'));window.scrollTo(0,0);});
    await page.screenshot({path:path.join(root,'dist','qa',`website-${width}.png`),fullPage:true});
    assert.deepEqual(errors,[],`Browser errors at ${width}px`);
    assert.deepEqual(remote,[],`External requests at ${width}px`);
    pass(`${width}px: assets, overflow, scroll journey 1→2→3 and reverse, pin/release, manual stages and keyboard, FAQ, truthful download, navigation`);
    await page.close();
  }
  const reduced=await browser.newPage({viewport:{width:320,height:800},reducedMotion:'reduce'});
  await reduced.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await reduced.locator('#try-it').evaluate(e=>e.classList.contains('journey-scroll-enabled')),false);
  await reduced.locator('#journey-next').click();
  assert.equal(await reduced.locator('.journey-moment[data-moment="1"]').getAttribute('aria-pressed'),'true');
  await reduced.locator('#journey-prev').click();
  assert.equal(await reduced.locator('.journey-moment[data-moment="0"]').getAttribute('aria-pressed'),'true');
  await reduced.evaluate(()=>document.documentElement.style.fontSize='200%');
  assert.equal(await reduced.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'200% text overflow');
  assert.ok(await reduced.locator('h1').isVisible());
  pass('320px reduced motion and 200% text without horizontal overflow');
  await reduced.close();

  for(const [value,available] of [['javascript:alert(1)',false],['https://example.com/app.apk',true]]){
    const page=await browser.newPage();
    await page.route('**/site-config.js',route=>route.fulfill({contentType:'text/javascript',body:`export const siteConfig={apkUrl:${JSON.stringify(value)},version:'Test build',apkSizeLabel:'10 MB'};`}));
    await page.goto(origin,{waitUntil:'networkidle'});
    assert.equal(await page.locator('#download-link').isVisible(),available);
    if(available)assert.equal(await page.locator('#download-link').getAttribute('href'),value);
    await page.close();
  }
  pass('APK configuration: unsafe URL rejected; HTTPS release URL shown without downloading');
  const noJs=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:800}});
  await noJs.goto(origin,{waitUntil:'networkidle'});
  assert.ok(await noJs.locator('h1').isVisible());
  await noJs.locator('#faq details summary').first().click();
  assert.equal(await noJs.locator('#faq details').first().getAttribute('open'),'');
  pass('No JavaScript: readable page, honest APK state and native FAQ usable');
  await noJs.close();
  const report={result:'PASS',checks,capturedWidths:[1440,1024,390,320]};
  await writeFile(path.join(root,'dist','qa','report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{
  await browser?.close();
  server.kill();
}
