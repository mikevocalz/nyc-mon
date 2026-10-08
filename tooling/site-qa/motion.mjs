// Motion ownership assertions (contract §10, §11):
//   1. ≤ 1 non-canvas RAF owner idle and while scrolling;
//   2. ≤ 1 canvas loop doing GPU work in any measurement window;
//   3. ScrollTrigger count returns to its post-mount value after client nav
//      to the away route and back (polled up to 8 s).
// Method from PREMIUM_SITE_BASELINE.md §2–§3: an init script wraps
// requestAnimationFrame before page scripts run and records, per frame, which
// callbacks executed, keyed by scheduling site (first stack frame) + source.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, CONFIG, launch, motionModes, outDir, table } from './lib.mjs';

const KEEPALIVE_COUNTS = process.env.SITE_QA_COUNT_KEEPALIVE === '1';
const POLL_MS = 8000;

function init() {
  const fnIds = new WeakMap();
  let nextId = 1;
  const state = { meta: {}, frames: new Map(), rec: false, cur: null, gpuSites: new Set() };
  window.__siteQaRaf = state;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function __siteQaRafWrap(cb) {
    let id = fnIds.get(cb);
    if (!id) {
      id = nextId++;
      fnIds.set(cb, id);
      const frames = (new Error().stack || '').split('\n').slice(1).filter((l) => !l.includes('__siteQaRafWrap'));
      const site = (frames[0] || '').trim().replace(/^at\s+/, '').replace(/https?:\/\/[^/]+\/_next\/static\/chunks\//, '');
      const src = String(cb).replace(/\s+/g, ' ');
      state.meta[id] = { key: `${site.replace(/^\S+\s+\(/, '(')}|${src.slice(0, 120)}`, site, src: src.slice(0, 140) };
    }
    const key = state.meta[id].key;
    return orig((ts) => {
      if (state.rec) {
        if (!state.frames.has(ts)) state.frames.set(ts, []);
        state.frames.get(ts).push(key);
      }
      const prev = state.cur;
      state.cur = key;
      try { return cb(ts); } finally { state.cur = prev; }
    });
  };
  const markGpu = () => { if (state.cur) state.gpuSites.add(state.cur); };
  const wrap = (proto, names) => {
    if (!proto) return;
    for (const n of names) {
      const o = proto[n];
      if (typeof o !== 'function') continue;
      proto[n] = function (...a) { markGpu(); return o.apply(this, a); };
    }
  };
  const draws = ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'clear'];
  wrap(window.WebGL2RenderingContext?.prototype, draws);
  wrap(window.WebGLRenderingContext?.prototype, draws);
  wrap(window.GPUQueue?.prototype, ['submit']);
  wrap(window.GPUCanvasContext?.prototype, ['getCurrentTexture']);
  // Without WebGPU (bundled chromium) the Skia fallback paints CanvasKit
  // frames through a 2D or bitmap context; count those as canvas draws too.
  wrap(window.CanvasRenderingContext2D?.prototype, ['drawImage', 'putImageData']);
  wrap(window.ImageBitmapRenderingContext?.prototype, ['transferFromImageBitmap']);
}

// Fallback when the app exposes no window.__nycmonMotion hook: patch the
// served GSAP/Lenis chunk in the test browser only (never on disk).
const ST_ANCHOR = /([A-Za-z_$][\w$]*)\.getAll=function\(\)\{return [A-Za-z_$][\w$]*\.filter\(function\(\w+\)\{return"ScrollSmoother"/;
const LENIS_ANCHOR = /this\.options\.autoRaf&&\(this\._rafId=requestAnimationFrame\(this\.raf\)\)\}(?=destroy\(\))/;

async function installPatch(ctx, patched) {
  await ctx.route('**/_next/static/chunks/*.js', async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    const st = body.match(ST_ANCHOR);
    if (st) {
      body = body.replace(ST_ANCHOR, (m, name) => `(window.__siteQaST=${name}),${m}`);
      patched.st = route.request().url().split('/').pop();
    }
    if (LENIS_ANCHOR.test(body)) {
      body = body.replace(LENIS_ANCHOR, '((window.__siteQaLenis=window.__siteQaLenis||[]).push(this),this.options.autoRaf&&(this._rafId=requestAnimationFrame(this.raf)))}');
      patched.lenis = route.request().url().split('/').pop();
    }
    await route.fulfill({ response: res, body });
  });
}

const readCounts = (page) => page.evaluate(() => {
  const hook = window.__nycmonMotion;
  if (hook && typeof hook.scrollTriggers === 'function') {
    return { source: 'hook', st: hook.scrollTriggers(), owners: hook.rafOwners?.() ?? null, canvas: hook.canvasLoops?.() ?? null };
  }
  return { source: 'patch', st: window.__siteQaST ? window.__siteQaST.getAll().length : null, owners: null, canvas: null };
});

async function pollStable(page, { until, timeout = POLL_MS } = {}) {
  const t0 = Date.now();
  let last = await readCounts(page);
  let stableSince = Date.now();
  while (Date.now() - t0 < timeout) {
    await page.waitForTimeout(250);
    const now = await readCounts(page);
    if (until && now.st === until) return { ...now, ms: Date.now() - t0 };
    if (now.st !== last.st) { last = now; stableSince = Date.now(); continue; }
    if (!until && now.st !== null && Date.now() - stableSince >= 1000) return { ...now, ms: Date.now() - t0 };
  }
  return { ...(await readCounts(page)), ms: Date.now() - t0, timedOut: true };
}

const KEEPALIVE = /^function (\w+)\(\)\{return \w+&&requestAnimationFrame\(\1\)\}$/;
const NAMES = [
  [KEEPALIVE, 'ScrollTrigger keep-alive (_rafBugFix)'],
  [/animate\.advance\(/, 'Lenis autoRaf'],
  // gsap/gsap-core.js _tick: `var elapsed = _getTime() - _lastUpdate, manual = v === true`
  [/^function [\w$]+\([\w$]+\)\{var [\w$,]+,[\w$]+=[\w$]+\(\)-[\w$]+,[\w$]+=!0===[\w$]+;/, 'GSAP ticker'],
  [/this\._requestId=this\._context\.requestAnimationFrame/, 'three.js Animation loop'],
];
const CANVAS_LIB = /this\._requestId=this\._context\.requestAnimationFrame/;

/** Records `ms` of frames, then classifies every site that ran in ≥ 30% of
 *  frames with a run of ≥ 10 consecutive frames as a loop. `instances` is the
 *  median number of callbacks per frame from that site (two GpuCanvas
 *  instances share a site). */
async function rafWindow(page, ms, during) {
  await page.evaluate(() => { const s = window.__siteQaRaf; s.frames.clear(); s.gpuSites.clear(); s.rec = true; });
  await Promise.all([page.waitForTimeout(ms), during?.()]);
  const raw = await page.evaluate(() => {
    const s = window.__siteQaRaf;
    s.rec = false;
    return { frames: [...s.frames.entries()].sort((a, b) => a[0] - b[0]).map(([, k]) => k), gpu: [...s.gpuSites], meta: Object.values(s.meta) };
  });
  const srcOf = new Map(raw.meta.map((m) => [m.key, m]));
  const stats = new Map();
  raw.frames.forEach((keys, fi) => {
    const counts = {};
    for (const k of keys) counts[k] = (counts[k] ?? 0) + 1;
    for (const [k, c] of Object.entries(counts)) {
      const s = stats.get(k) ?? { frames: 0, per: [], run: 0, best: 0, lastFi: -2 };
      s.frames++; s.per.push(c);
      s.run = s.lastFi === fi - 1 ? s.run + 1 : 1; s.best = Math.max(s.best, s.run); s.lastFi = fi;
      stats.set(k, s);
    }
  });
  const n = raw.frames.length;
  const loops = [];
  for (const [key, s] of stats) {
    if (s.frames < n * 0.3 || s.best < 10) continue;
    const m = srcOf.get(key);
    const src = m?.src ?? '';
    const per = s.per.sort((a, b) => a - b);
    const gpu = raw.gpu.includes(key);
    const kind = KEEPALIVE.test(src) ? 'keepalive' : gpu ? 'canvas' : CANVAS_LIB.test(src) ? 'canvas-idle' : 'owner';
    loops.push({ name: NAMES.find(([re]) => re.test(src))?.[1] ?? 'unnamed', kind, instances: per[per.length >> 1], frames: s.frames, of: n, site: m?.site ?? '?', src: src.slice(0, 70) });
  }
  const owners = loops.filter((l) => l.kind === 'owner' || (KEEPALIVE_COUNTS && l.kind === 'keepalive')).reduce((a, l) => a + l.instances, 0);
  const canvas = loops.filter((l) => l.kind === 'canvas').reduce((a, l) => a + l.instances, 0);
  // A canvas-library loop that draws nothing is three's internal Animation loop coming back (PS-010).
  const canvasIdle = loops.filter((l) => l.kind === 'canvas-idle').reduce((a, l) => a + l.instances, 0);
  return { frames: n, maxPerFrame: Math.max(0, ...raw.frames.map((f) => f.length)), owners, canvas, canvasIdle, loops };
}

async function scrollBurst(page, vp) {
  await page.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); }
}

// Lenis keeps animating toward its own target after wheel input and would
// overwrite an instant scrollTo; wait for scrollY to hold still first.
async function scrollIdle(page, timeout = 6000) {
  const t0 = Date.now();
  let last = await page.evaluate(() => window.scrollY);
  let since = Date.now();
  while (Date.now() - t0 < timeout) {
    await page.waitForTimeout(100);
    const y = await page.evaluate(() => window.scrollY);
    if (y !== last) { last = y; since = Date.now(); } else if (Date.now() - since >= 500) return;
  }
}

async function clickNav(page, href) {
  const link = page.locator(`a[href="${href}"]:visible`).first();
  await link.click();
  await page.waitForURL((u) => new URL(u).pathname === href, { timeout: 15000 });
}

const scenarios = [
  { label: 'desktop', vp: { width: 1280, height: 800 } },
  { label: 'mobile', vp: { width: 390, height: 844 } },
].filter((s) => !process.env.SITE_QA_VIEWPORTS || process.env.SITE_QA_VIEWPORTS.split(',').includes(String(s.vp.width)));

const { browser, label } = await launch();
console.log(`motion · ${label} · ${BASE}/ · away ${CONFIG.awayRoute} · keep-alive ${KEEPALIVE_COUNTS ? 'counted' : 'reported, not counted'}`);
const results = [];
for (const sc of scenarios) {
  for (const motion of motionModes()) {
    const ctx = await browser.newContext({ viewport: sc.vp, reducedMotion: motion });
    await ctx.addInitScript(init);
    const patched = {};
    await installPatch(ctx, patched);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const mount = await pollStable(page);
    const r = { scenario: sc.label, motion, mount, patched, errors, windows: {} };
    r.windows.idleTop = await rafWindow(page, 3000);
    r.windows.scrolling = await rafWindow(page, 5000, () => scrollBurst(page, sc.vp));
    await scrollIdle(page);
    const stage = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      return true;
    }, CONFIG.deviceStageSelector);
    if (stage) {
      await page.waitForTimeout(1500);
      r.deviceStageInView = await page.evaluate((sel) => {
        const b = document.querySelector(sel).getBoundingClientRect();
        return b.bottom > 0 && b.top < window.innerHeight;
      }, CONFIG.deviceStageSelector);
      r.windows.idleDeviceStage = await rafWindow(page, 3000);
    }
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(1500);
    r.windows.idleBottom = await rafWindow(page, 3000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(500);
    try {
      await clickNav(page, CONFIG.awayRoute);
      r.away = await pollStable(page, { until: 0 });
      r.sameDocument = await page.evaluate(() => !!window.__siteQaRaf && window.__siteQaRaf.frames instanceof Map);
      await clickNav(page, '/');
      r.back = await pollStable(page, { until: mount.st });
    } catch (e) {
      r.navError = e.message.split('\n')[0];
    }
    results.push(r);
    await ctx.close();
  }
}
await browser.close();

const dir = outDir('motion');
fs.writeFileSync(path.join(dir, 'motion.json'), JSON.stringify({ base: BASE, browser: label, results }, null, 2));

const rows = [];
const failures = [];
for (const r of results) {
  const id = `${r.scenario}/${r.motion}`;
  for (const [w, v] of Object.entries(r.windows)) {
    rows.push({ run: id, window: w, frames: v.frames, owners: v.owners, canvasActive: v.canvas, maxPerFrame: v.maxPerFrame,
      loops: v.loops.map((l) => `${l.kind}:${l.name}${l.instances > 1 ? `×${l.instances}` : ''}`).join(', ') });
    if (v.owners > 1) failures.push(`${id} ${w}: ${v.owners} non-canvas RAF owners`);
    if (v.canvas > 1) failures.push(`${id} ${w}: ${v.canvas} canvas loops drawing`);
    if (v.canvasIdle > 0) failures.push(`${id} ${w}: ${v.canvasIdle} idle canvas-library loop(s) running (three's internal Animation loop?)`);
  }
  if (r.deviceStageInView === false) failures.push(`${id}: DeviceStage was not in view for the idleDeviceStage window`);
  if (r.mount.st === null) failures.push(`${id}: ScrollTrigger count unreadable (no __nycmonMotion hook; chunk patch ${r.patched.st ? 'applied' : 'found no anchor'})`);
  if (r.navError) failures.push(`${id}: navigation failed: ${r.navError}`);
  else if (r.mount.st !== null && r.back?.st !== r.mount.st) failures.push(`${id}: ScrollTrigger ${r.mount.st} after mount, ${r.back?.st} after ${CONFIG.awayRoute} and back (${r.back?.ms} ms)`);
  if (r.mount.owners && r.mount.owners.length > 1) failures.push(`${id}: hook rafOwners() reports ${r.mount.owners.join(', ')}`);
}
console.log(table(rows, ['run', 'window', 'frames', 'owners', 'canvasActive', 'maxPerFrame', 'loops']));
console.log('\n' + table(results.map((r) => ({
  run: `${r.scenario}/${r.motion}`, source: r.mount.source, mount: r.mount.st, away: r.away?.st ?? '-', back: r.back?.st ?? '-',
  backMs: r.back?.ms ?? '-', hookOwners: r.mount.owners?.join(',') ?? '-', pageErrors: r.errors.length,
})), ['run', 'source', 'mount', 'away', 'back', 'backMs', 'hookOwners', 'pageErrors']));
console.log(`\nLoop sites and sources: ${path.join(dir, 'motion.json')}`);
if (failures.length) {
  console.log('\nFAIL\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('motion: pass');
