/* One-off verification script: screenshot the home page at the audit widths,
   capture console errors, and check the reduced-motion composition. */
import { createRequire } from 'module';

const require = createRequire(new URL('../apps/storybook/package.json', import.meta.url));
const { chromium } = require('playwright');

const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = new URL('./out/shots/', import.meta.url).pathname;

const widths = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'laptop-1024', width: 1024, height: 768 },
  { name: 'tablet-884', width: 884, height: 1104 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'phone-430', width: 430, height: 932 },
  { name: 'phone-390', width: 390, height: 844 },
];

const browser = await chromium.launch();
const errors = [];

async function waitForSettle(page, timeout = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const a = await page.evaluate(() =>
      [...document.querySelectorAll('[id^="mfx-"], [id^="mpx-"]')].map((el) => {
        const s = getComputedStyle(el);
        return `${el.id}:${s.opacity}:${s.transform}`;
      }).join('|'));
    await page.waitForTimeout(350);
    const b = await page.evaluate(() =>
      [...document.querySelectorAll('[id^="mfx-"], [id^="mpx-"]')].map((el) => {
        const s = getComputedStyle(el);
        return `${el.id}:${s.opacity}:${s.transform}`;
      }).join('|'));
    if (a === b) return;
  }
}

for (const vp of widths) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${vp.name}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${vp.name}] pageerror: ${e.message}`));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await waitForSettle(page);
  await page.screenshot({ path: `${OUT}/${vp.name}-top.png` });
  // mid-page: scroll to world + hlynk + hatch
  await page.evaluate(() => document.getElementById('trg-world')?.scrollIntoView());
  await page.waitForTimeout(900);
  await waitForSettle(page);
  await page.screenshot({ path: `${OUT}/${vp.name}-world.png` });
  await page.evaluate(() => document.getElementById('trg-hlynk')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(900);
  await waitForSettle(page);
  await page.screenshot({ path: `${OUT}/${vp.name}-hlynk.png` });
  await page.evaluate(() => document.getElementById('trg-starters')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(900);
  await waitForSettle(page);
  await page.screenshot({ path: `${OUT}/${vp.name}-starters.png` });
  await page.evaluate(() => document.getElementById('trg-hatch')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(900);
  await waitForSettle(page);
  await page.screenshot({ path: `${OUT}/${vp.name}-hatch.png` });
  // overflow check
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) errors.push(`[${vp.name}] horizontal overflow: ${overflow}px`);
  await ctx.close();
}

// reduced motion
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[reduced] pageerror: ${e.message}`));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const armed = await page.evaluate(() => document.documentElement.classList.contains('motion-armed'));
  if (armed) errors.push('[reduced] motion-armed leaked under prefers-reduced-motion');
  await page.screenshot({ path: `${OUT}/reduced-top.png` });
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'clean — no console errors, no overflow');
