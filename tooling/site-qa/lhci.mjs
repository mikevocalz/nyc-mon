// Lighthouse mobile (default config: Moto G Power emulation, simulated
// slow 4G, 4x CPU) run N times against BASE; prints the median of each
// category and metric independently, plus the LCP element, and fails below
// the contract §11 targets. Same method as PREMIUM_SITE_BASELINE.md §1.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { BASE, CONFIG, SYSTEM_CHROME, median, outDir, table } from './lib.mjs';

const require = createRequire(import.meta.url);
const LH_PKG = require.resolve('lighthouse/package.json');
const LH_VERSION = require(LH_PKG).version;
const LH_CLI = path.join(path.dirname(LH_PKG), 'cli', 'index.js');
const route = process.env.SITE_QA_ROUTE ?? '/';
const url = BASE + route;
const runs = Number(process.env.SITE_QA_LH_RUNS ?? CONFIG.lighthouse.runs);
const T = CONFIG.lighthouse;

// Bundled chromium by default. The installed Chrome on this machine uses the
// Meta XR Simulator as its OpenXR runtime, so launching it starts a Quest 3
// simulator session. Opt in with SITE_QA_BROWSER=system.
const chromePath = (process.env.SITE_QA_BROWSER === 'system' && SYSTEM_CHROME) || chromium.executablePath();
const dir = outDir('lhci');
console.log(`lighthouse ${LH_VERSION} · ${url} · ${runs} runs · chrome ${chromePath}`);
console.log(`node ${process.version} · ${os.type()} ${os.release()} ${os.arch()} · ${os.cpus()[0]?.model} ×${os.cpus().length} · load ${os.loadavg().map((n) => n.toFixed(2)).join(' ')}`);

const rows = [];
for (let i = 1; i <= runs; i++) {
  const out = path.join(dir, `lh-${i}.json`);
  const res = spawnSync(process.execPath, [LH_CLI, url, `--chrome-path=${chromePath}`,
    '--chrome-flags=--headless=new --no-first-run', '--output=json', `--output-path=${out}`, '--quiet'], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(`run ${i} failed (exit ${res.status}):\n${res.stderr.slice(-2000)}`);
    process.exit(2);
  }
  const r = JSON.parse(fs.readFileSync(out, 'utf8'));
  if (r.runtimeError) { console.error(`run ${i}: ${r.runtimeError.code} ${r.runtimeError.message}`); process.exit(2); }
  const a = r.audits;
  const c = r.categories;
  // Lighthouse 13 reports the LCP node in the lcp-breakdown insight (older
  // versions used largest-contentful-paint-element).
  const lcpItems = a['lcp-breakdown-insight']?.details?.items ?? [];
  const node = lcpItems.find((it) => it.type === 'node')
    ?? a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node;
  const phases = Object.fromEntries((lcpItems.find((it) => it.type === 'table')?.items ?? []).map((p) => [p.subpart, Math.round(p.duration)]));
  rows.push({
    run: i,
    perf: Math.round(c.performance.score * 100),
    a11y: Math.round(c.accessibility.score * 100),
    bp: Math.round(c['best-practices'].score * 100),
    seo: Math.round(c.seo.score * 100),
    fcp: Math.round(a['first-contentful-paint'].numericValue),
    lcp: Math.round(a['largest-contentful-paint'].numericValue),
    cls: Number(a['cumulative-layout-shift'].numericValue.toFixed(3)),
    tbt: Math.round(a['total-blocking-time'].numericValue),
    si: Math.round(a['speed-index'].numericValue),
    lcpEl: node ? `<${node.path?.split(',').pop()?.toLowerCase() ?? '?'}> ${(node.snippet?.match(/alt="([^"]{0,40})/)?.[1] ?? node.nodeLabel ?? '').slice(0, 40)}` : '?',
    phases,
    bench: r.environment.benchmarkIndex,
    env: { lh: r.lighthouseVersion, ua: r.environment.hostUserAgent, ff: r.configSettings.formFactor, method: r.configSettings.throttlingMethod, throttling: r.configSettings.throttling },
    snippet: node?.snippet,
  });
  console.log(`run ${i}: perf ${rows.at(-1).perf} lcp ${rows.at(-1).lcp} tbt ${rows.at(-1).tbt}`);
}

const keys = ['perf', 'a11y', 'bp', 'seo', 'fcp', 'lcp', 'cls', 'tbt', 'si', 'bench'];
const med = Object.fromEntries(keys.map((k) => [k, median(rows.map((r) => r[k]))]));
const lcpRun = [...rows].sort((x, y) => x.lcp - y.lcp)[rows.length >> 1];
console.log('\n' + table([...rows, { run: 'median', ...med, lcpEl: lcpRun.lcpEl }], ['run', ...keys, 'lcpEl']));
const e = rows[0].env;
console.log(`\nenv: ${e.ff}, ${e.method}, rtt ${e.throttling.rttMs} ms, ${e.throttling.throughputKbps} kbps, cpu ×${e.throttling.cpuSlowdownMultiplier} · ${e.ua}`);
console.log(`LCP element (median-LCP run ${lcpRun.run}): ${lcpRun.snippet ?? lcpRun.lcpEl}`);
console.log(`LCP subparts, observed trace (ms): ${JSON.stringify(lcpRun.phases)}`);
console.log('INP: not measured (navigation mode records no interactions); TBT is the lab proxy.');

const fails = [];
if (med.perf < T.perf) fails.push(`Performance ${med.perf} < ${T.perf}`);
if (med.a11y < T.a11y) fails.push(`Accessibility ${med.a11y} < ${T.a11y}`);
if (med.bp < T.bp) fails.push(`Best Practices ${med.bp} < ${T.bp}`);
if (med.seo < T.seo) fails.push(`SEO ${med.seo} < ${T.seo}`);
if (med.lcp >= T.lcpMs) fails.push(`LCP ${med.lcp} ms ≥ ${T.lcpMs}`);
if (med.cls >= T.cls) fails.push(`CLS ${med.cls} ≥ ${T.cls}`);
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ url, rows, median: med, fails }, null, 2));
if (fails.length) {
  console.log('\nFAIL\n' + fails.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('lhci: pass');
