// Screenshot matrix: every config viewport × prefers-reduced-motion
// {no-preference, reduce}. One viewport shot per section (scrolled under the
// sticky header, reveal settled) and a full-page shot at the configured
// widths. Also records horizontal overflow and console errors per run.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, CONFIG, findSections, launch, motionModes, outDir, scrollToSection, settle, table } from './lib.mjs';

const route = process.env.SITE_QA_ROUTE ?? '/';
const only = process.env.SITE_QA_VIEWPORTS?.split(',');
const viewports = CONFIG.viewports.filter((v) => !only || only.includes(v.name));
const dir = outDir('shots');
const { browser, label } = await launch('bundled');
console.log(`shots · ${label} · ${BASE}${route} → ${dir}`);

const runs = [];
for (const motion of motionModes()) {
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, reducedMotion: motion });
    const page = await ctx.newPage();
    const run = { vp: vp.name, motion, files: [], unsettled: [], console: [] };
    page.on('console', (m) => { if (m.type() === 'error') run.console.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => run.console.push(`pageerror: ${e.message.slice(0, 300)}`));
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await settle(page);
    const sections = await findSections(page);
    for (const s of sections) {
      if (!(await scrollToSection(page, s.index))) continue;
      await page.waitForTimeout(500);
      if (!(await settle(page))) run.unsettled.push(s.name);
      const file = `${vp.name}-${motion}-${s.name}.jpg`;
      await page.screenshot({ path: path.join(dir, file), type: 'jpeg', quality: 75 });
      run.files.push(file);
    }
    run.overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (CONFIG.fullPageViewports.includes(vp.name)) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(400);
      const file = `${vp.name}-${motion}-fullpage.jpg`;
      await page.screenshot({ path: path.join(dir, file), type: 'jpeg', quality: 65, fullPage: true, scale: 'css' });
      run.files.push(file);
    }
    runs.push(run);
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ base: BASE, route, browser: label, runs }, null, 2));
console.log(table(runs.map((r) => ({
  viewport: r.vp, motion: r.motion, shots: r.files.length, overflowPx: r.overflow,
  consoleErrors: r.console.length, unsettled: r.unsettled.join(',') || '-',
})), ['viewport', 'motion', 'shots', 'overflowPx', 'consoleErrors', 'unsettled']));
const bad = runs.filter((r) => r.overflow > 0 || r.console.length);
if (bad.length) console.warn(`\n${bad.length} run(s) with horizontal overflow or console errors; see report.json`);
if (process.env.SITE_QA_STRICT === '1' && bad.length) process.exit(1);
