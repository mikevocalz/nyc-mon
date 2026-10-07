// axe-core per section: scroll each section into view, let its reveal
// settle, scan that section, then scan the whole document once at the end
// (catches landmarks, header and anything outside a section). A single
// whole-page scan from the top misses content still at opacity 0.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { BASE, CONFIG, findSections, launch, motionModes, outDir, scrollToSection, settle, table } from './lib.mjs';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');
const AXE = fs.readFileSync(AXE_PATH, 'utf8');
const AXE_VERSION = require('axe-core/package.json').version;
const route = process.env.SITE_QA_ROUTE ?? '/';

const { browser, label } = await launch('bundled');
console.log(`axe-core ${AXE_VERSION} · ${label} · ${BASE}${route} · tags ${CONFIG.axeTags.join(',')}`);

const runs = [];
for (const width of CONFIG.axeViewports) {
  for (const motion of motionModes()) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: motion });
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: AXE });
    const sections = await findSections(page);
    const scan = (index) => page.evaluate(async ({ i, tags }) => {
      const ctxEl = i === null ? document : window.__siteQaSections[i];
      const r = await window.axe.run(ctxEl, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
      return r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        wcag: v.tags.filter((t) => /^wcag\d/.test(t)).join(','),
        nodes: v.nodes.map((n) => ({ target: n.target.join(' '), summary: n.failureSummary })),
      }));
    }, { i: index, tags: CONFIG.axeTags });

    const byKey = new Map();
    const unsettled = [];
    const add = (where, violations) => {
      for (const v of violations) for (const n of v.nodes) {
        const key = `${v.id}|${n.target}`;
        if (!byKey.has(key)) byKey.set(key, { rule: v.id, impact: v.impact, wcag: v.wcag, section: where, target: n.target, summary: n.summary });
      }
    };
    for (const s of sections) {
      if (!(await scrollToSection(page, s.index))) continue;
      await page.waitForTimeout(500);
      if (!(await settle(page))) unsettled.push(s.name);
      add(s.name, await scan(s.index));
    }
    add('document', await scan(null));
    const nodes = [...byKey.values()];
    runs.push({ width, motion, sections: sections.map((s) => s.name), unsettled, nodes, rules: [...new Set(nodes.map((n) => n.rule))] });
    await ctx.close();
  }
}
await browser.close();

const dir = outDir('axe');
fs.writeFileSync(path.join(dir, 'axe.json'), JSON.stringify({ base: BASE, route, axe: AXE_VERSION, browser: label, runs }, null, 2));

console.log(table(runs.map((r) => ({
  width: r.width, motion: r.motion, sections: r.sections.length, rules: r.rules.length, nodes: r.nodes.length,
  ruleIds: r.rules.join(',') || '-', unsettled: r.unsettled.join(',') || '-',
})), ['width', 'motion', 'sections', 'rules', 'nodes', 'ruleIds', 'unsettled']));

const all = runs.flatMap((r) => r.nodes.map((n) => ({ ...n, run: `${r.width}/${r.motion}` })));
if (all.length) {
  const grouped = new Map();
  for (const n of all) {
    const k = `${n.rule}|${n.target}`;
    const g = grouped.get(k) ?? { ...n, runs: [] };
    g.runs.push(n.run);
    grouped.set(k, g);
  }
  console.log('\nViolations:');
  console.log(table([...grouped.values()].map((g) => ({ ...g, runs: g.runs.length === runs.length ? 'all' : g.runs.join(' ') })),
    ['rule', 'impact', 'wcag', 'section', 'target', 'runs']));
  console.log(`\nDetails: ${path.join(dir, 'axe.json')}`);
  process.exit(1);
}
console.log('axe: no violations');
