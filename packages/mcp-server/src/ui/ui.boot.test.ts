import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Frame } from 'playwright';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildUi } from './build.ts';
import { getUiResources, type UiResource } from './index.ts';
import { MON_MODEL_ORIGIN } from './model-origin.ts';

/**
 * Boots each built view in Playwright's bundled Chromium (never the system
 * Chrome) inside a sandboxed iframe on the ext-apps AppBridge, and checks that
 * it renders: the root has content, nothing throws, and the parts the screen
 * needs are there. Covers every starter tone in both themes, the room at the
 * Echo Show 8 canvas and in a small spec host (800×480, no deviceClass), and a
 * journal in a shape the adapter does not know.
 */

const here = dirname(fileURLToPath(import.meta.url));
const MONS_DIR = join(here, '../../../../apps/web/public/mons');
const now = Date.now();
const care = { energy: 0.7, fullness: 0.22, social: 0.55, activity: 'awake', sluggish: false, wantsFood: true, lastFedAt: null };
const monFor = (speciesId: string) => ({ monId: 'mon_demo', name: null, speciesId, stage: 'Baby' });

let browser: Browser;
/** Bundled Chromium with a software WebGPU adapter (SwiftShader). */
let gpuBrowser: Browser;
let hostScript: string;
/**
 * The host page is served from http://localhost, a secure context like the
 * https page a real host runs on. WebGPU (`navigator.gpu`) exists only in
 * secure contexts, and a setContent about:blank page is not one.
 */
let server: Server;
let hostUrl: string;
let resources: readonly UiResource[];

beforeAll(async () => {
  await buildUi();
  resources = getUiResources();
  const outDir = await mkdtemp(join(tmpdir(), 'nyc-mon-boot-host-'));
  await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir,
      lib: { entry: join(here, 'test-host', 'host.ts'), formats: ['iife'], name: 'bootHost', fileName: () => 'host.js' },
    },
  });
  hostScript = await readFile(join(outDir, 'host.js'), 'utf8');
  const page = `<!doctype html><html><body style="margin:0"><script>${hostScript.replaceAll('</script', '<\\/script')}</script></body></html>`;
  server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  hostUrl = `http://localhost:${(server.address() as AddressInfo).port}/`;
  browser = await chromium.launch();
  gpuBrowser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader'] });
}, 600_000);

afterAll(async () => {
  await browser?.close();
  await gpuBrowser?.close();
  server?.close();
});

interface Boot {
  frame: Frame;
  errors: string[];
  close: () => Promise<void>;
}

async function boot(view: 'mon-card' | 'mon-room', opts: {
  width: number;
  height: number;
  hostContext: Record<string, unknown>;
  result: Record<string, unknown>;
  gpu?: boolean;
  callFails?: boolean;
  /** Script run in the view's document before the view's own (to stub browser APIs). */
  preScript?: string;
}): Promise<Boot> {
  const built = resources.find((r) => r.id === view)!.html;
  const html = opts.preScript ? built.replace('<head>', `<head><script>${opts.preScript}</script>`) : built;
  const ctx = await (opts.gpu ? gpuBrowser : browser).newContext({ viewport: { width: opts.width + 40, height: opts.height + 40 } });
  // The view fetches Mon GLBs from the sim host. Serve them here so the suite
  // never depends on a dev server being up (it passed locally only because one was).
  await ctx.route(`${MON_MODEL_ORIGIN}/mons/*.glb`, async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!;
    try {
      const body = await readFile(join(MONS_DIR, name));
      await route.fulfill({ status: 200, body, headers: { 'content-type': 'model/gltf-binary', 'access-control-allow-origin': '*' } });
    } catch {
      await route.fulfill({ status: 404, body: 'No such model.' });
    }
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(hostUrl);
  const { gpu: _gpu, preScript: _pre, ...mount } = opts;
  await page.evaluate((m) => window.mountView(m), { html, ...mount });
  const handle = await page.waitForSelector('iframe');
  const frame = (await handle.contentFrame())!;
  await frame.waitForFunction(() => (document.getElementById('root')?.innerText ?? '').trim().length > 0, null, { timeout: 15_000 })
    .catch(() => undefined);
  return { frame, errors, close: () => ctx.close() };
}

const echoShow8 = (mode: 'inline' | 'fullscreen', theme: 'light' | 'dark') => ({
  width: 1280,
  height: 800,
  hostContext: { theme, displayMode: mode, availableDisplayModes: ['inline', 'fullscreen'], deviceClass: 'echo-show-8', maxWidth: 1280, maxHeight: 800 },
});

// boot() allows a view 15 s to render; the default 5 s test timeout undercut it.
// Headless Chromium draws the 3D Mon's WebGL in software, so a click waits on
// slow frames before the page counts as stable.
describe('built views boot in a spec host (bundled Chromium)', { timeout: 20_000 }, () => {
  for (const [speciesId, form] of [['dex-002', 'Squeaklet'], ['dex-009', 'Kittee Cee'], ['dex-062', 'Yotito']] as const) {
    for (const theme of ['light', 'dark'] as const) {
      it(`card: ${form}, ${theme}`, async () => {
        const b = await boot('mon-card', { ...echoShow8('inline', theme), result: { mon: monFor(speciesId), care } });
        try {
          const text = await b.frame.evaluate(() => document.getElementById('root')!.innerText);
          expect(text).toContain(form);
          expect(text).toContain('Asking for food');
          expect(text).toContain('Journal');
          expect(await b.frame.locator('[role=progressbar]').count()).toBe(3);
          expect(b.errors).toEqual([]);
        } finally {
          await b.close();
        }
      });
    }
  }

  it('room at Echo Show 8, dark, fills the canvas without scrolling', async () => {
    const b = await boot('mon-room', {
      ...echoShow8('fullscreen', 'dark'),
      result: { mon: monFor('dex-002'), care, journal: [{ at: now - 26 * 36e5, kind: 'fed', first: true }] },
    });
    try {
      const m = await b.frame.evaluate(() => ({
        text: document.getElementById('root')!.innerText,
        journal: document.querySelector('[aria-label="Squeaklet and you"]') !== null,
        rings: document.querySelectorAll('[role=progressbar]').length,
        scroll: document.documentElement.scrollHeight,
        inner: window.innerHeight,
      }));
      // The room shows the journal where the card has its rings, labelled with M18's heading.
      expect(m.journal).toBe(true);
      expect(m.rings).toBe(0);
      expect(m.text).toContain("Squeaklet's first meal");
      expect(m.text).toContain('Close');
      expect(m.scroll).toBeLessThanOrEqual(m.inner);
      expect(b.errors).toEqual([]);
    } finally {
      await b.close();
    }
  });

  it('room in a small spec host (800×480, no deviceClass) with an unknown journal shape', async () => {
    const b = await boot('mon-room', {
      width: 800,
      height: 480,
      hostContext: { theme: 'dark', displayMode: 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'] },
      result: {
        mon: { monId: 'mon_demo', name: 'Pip', speciesId: 'dex-002', stage: 'baby', bond: 0.42, hatchedAt: now - 3 * 864e5 },
        care,
        journal: [
          { at: now - 2 * 36e5, kind: 'play', text: 'Played catch on the stoop.' },
          { at: now - 26 * 36e5, kind: 'fed', text: 'Shared a meal.' },
          { at: 'yesterday', kind: 'fed' },
          null,
          { at: now - 3 * 864e5, kind: 'hatched', text: 'Hatched.' },
        ],
      },
    });
    try {
      const text = await b.frame.evaluate(() => document.getElementById('root')!.innerText);
      expect(text).toContain('Pip');
      expect(await b.frame.locator('[aria-label="Pip and you"]').count()).toBe(1);
      expect(text).toContain('Pip ate');
      expect(text).toContain('Feed');
      expect(b.errors).toEqual([]);
    } finally {
      await b.close();
    }
  });

  for (const view of ['mon-card', 'mon-room'] as const) {
    it(`${view} in a 400 px wide host stacks, clips nothing, and reports its height`, async () => {
      const mode = view === 'mon-room' ? 'fullscreen' : 'inline';
      const b = await boot(view, {
        width: 400,
        height: 300,
        hostContext: { theme: 'light', displayMode: mode, availableDisplayModes: ['inline', 'fullscreen'], deviceClass: 'echo-show-8', maxWidth: 400 },
        result: { mon: monFor('dex-009'), care, journal: [{ at: now - 26 * 36e5, kind: 'fed', first: true }] },
      });
      try {
        const m = await b.frame.evaluate(() => {
          const inner = window.innerWidth;
          const rights = [...document.querySelectorAll('button, [role=button], [role=progressbar]')].map((e) => e.getBoundingClientRect().right);
          return { inner, scrollW: document.documentElement.scrollWidth, maxRight: Math.max(...rights), count: rights.length };
        });
        expect(m.scrollW).toBeLessThanOrEqual(m.inner);
        expect(m.maxRight).toBeLessThanOrEqual(m.inner);
        expect(m.count).toBeGreaterThanOrEqual(7);
        await b.frame.page().waitForFunction(() => window.sizes.some((s) => (s.height ?? 0) > 300), null, { timeout: 5000 });
        const sizes = await b.frame.page().evaluate(() => window.sizes);
        const last = sizes[sizes.length - 1]!;
        expect(last.height).toBeGreaterThan(300);
        expect(b.errors).toEqual([]);
      } finally {
        await b.close();
      }
    });
  }

  describe('room backdrop (GridBand)', () => {
    const roomResult = { mon: monFor('dex-002'), care };
    const probe = (frame: Frame) =>
      frame.evaluate(() => ({
        // The 3D Mon's three.js canvas is not the backdrop.
        canvases: document.querySelectorAll('canvas:not([data-engine^="three.js"])').length,
        pause: [...document.querySelectorAll('[role=button], button')].some((e) => e.textContent?.includes('Pause animation')),
      }));

    it('without a WebGPU adapter: sky placeholder only, no CanvasKit fetch, no error, no Pause button', async () => {
      const b = await boot('mon-room', { ...echoShow8('fullscreen', 'dark'), result: roomResult });
      try {
        await b.frame.page().waitForTimeout(2500);
        expect(await probe(b.frame)).toEqual({ canvases: 0, pause: false });
        expect(b.errors).toEqual([]);
      } finally {
        await b.close();
      }
    }, 60_000);

    it('adapter but no device (requestDevice rejects): sky only, no Pause, no CanvasKit fetch, no page error', async () => {
      const b = await boot('mon-room', {
        ...echoShow8('fullscreen', 'dark'),
        result: roomResult,
        gpu: true,
        preScript:
          "const real = navigator.gpu; Object.defineProperty(navigator, 'gpu', { value: { getPreferredCanvasFormat: () => real.getPreferredCanvasFormat(), requestAdapter: async () => ({ requestDevice: () => Promise.reject(new Error('device unavailable')) }) } });",
      });
      const pageErrors: string[] = [];
      b.frame.page().on('pageerror', (e) => pageErrors.push(String(e)));
      try {
        await b.frame.page().waitForTimeout(3000);
        expect(await probe(b.frame)).toEqual({ canvases: 0, pause: false });
        const sky = await b.frame.evaluate(() => [...document.querySelectorAll<HTMLElement>('[style]')].some((e) => e.style.backgroundColor !== ''));
        expect(sky).toBe(true);
        expect(pageErrors).toEqual([]);
        expect(b.errors.filter((e) => /Aborted|canvaskit|wasm/i.test(e))).toEqual([]);
      } finally {
        await b.close();
      }
    }, 60_000);

    it('with the WebGPU flag: draws the grid when a device works, or displays a safe sky', async () => {
      const b = await boot('mon-room', { ...echoShow8('fullscreen', 'dark'), result: roomResult, gpu: true });
      try {
        // The Chromium flag and adapter are insufficient evidence of a usable
        // headless GPU: requestDevice/configure may still fail in CI.
        // Observe the actual rendered result and verify both supported paths.
        await b.frame.page().waitForTimeout(3000);
        const view = await probe(b.frame);
        if (view.canvases > 0) {
          expect(view).toEqual({ canvases: 1, pause: true });
        } else {
          expect(view).toEqual({ canvases: 0, pause: false });
          const sky = await b.frame.evaluate(() =>
            [...document.querySelectorAll<HTMLElement>('[style]')].some((el) => el.style.backgroundColor !== ''),
          );
          expect(sky).toBe(true);
        }
        expect(b.errors).toEqual([]);
      } finally {
        await b.close();
      }
    }, 60_000);
  });

  describe('egg (check_incubation result)', () => {
    const eggResult = (minutes: number) => ({
      incubating: true,
      eggs: [{ eggId: 'egg_demo', speciesId: 'dex-001', incubationEndsAt: now + minutes * 60_000, minutesRemaining: minutes, readyToHatch: minutes === 0 }],
    });
    const probe = (frame: Frame) =>
      frame.evaluate(() => ({
        text: document.getElementById('root')!.innerText,
        buttons: [...document.querySelectorAll('button, [role=button]')].map((e) => (e.textContent ?? '').trim()),
        rings: document.querySelectorAll('[role=progressbar]').length,
        model: document.querySelector('[role=img][aria-label*="Metro Egg"]')?.getAttribute('aria-label') ?? null,
        scrollW: document.documentElement.scrollWidth,
        scrollH: document.documentElement.scrollHeight,
        innerW: window.innerWidth,
        innerH: window.innerHeight,
      }));

    for (const theme of ['light', 'dark'] as const) {
      it(`card, ${theme}: the Metro Egg in 3D with its time left, no meters or care buttons, no overflow`, async () => {
        const b = await boot('mon-card', { ...echoShow8('inline', theme), result: eggResult(12) });
        try {
          const m = await probe(b.frame);
          expect(m.text).toContain('Metro Egg');
          expect(m.text).toContain('12 min left');
          expect(m.model).toBe('Metro Egg, incubating');
          expect(m.rings).toBe(0);
          expect(m.buttons).toEqual([]);
          expect(m.scrollW).toBeLessThanOrEqual(m.innerW);
          expect(m.scrollH).toBeLessThanOrEqual(m.innerH);
          expect(b.errors).toEqual([]);
        } finally {
          await b.close();
        }
      });
    }

    it('card: a ready egg says so', async () => {
      const b = await boot('mon-card', { ...echoShow8('inline', 'light'), result: eggResult(0) });
      try {
        const m = await probe(b.frame);
        expect(m.text).toContain('Ready to hatch');
        expect(m.model).toBe('Metro Egg, ready to hatch');
        expect(b.errors).toEqual([]);
      } finally {
        await b.close();
      }
    });

    it('room: only Close in the bar', async () => {
      const b = await boot('mon-room', { ...echoShow8('fullscreen', 'dark'), result: eggResult(12) });
      try {
        const m = await probe(b.frame);
        expect(m.buttons).toEqual(['Close']);
        expect(m.scrollH).toBeLessThanOrEqual(m.innerH);
      } finally {
        await b.close();
      }
    });
  });

  it('room in a short frame (348 px) shows whole journal rows instead of the rings, newest first', async () => {
    const journal = Array.from({ length: 12 }, (_, i) => ({ at: now - (i + 1) * 36e5, kind: i % 2 ? 'fed' : 'played', first: i === 11 }));
    const b = await boot('mon-room', {
      width: 1000,
      height: 348,
      hostContext: { theme: 'dark', displayMode: 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'], deviceClass: 'echo-show-8', maxWidth: 1000, maxHeight: 348 },
      result: { mon: monFor('dex-002'), care, journal },
    });
    try {
      const m = await b.frame.evaluate(() => {
        const all = [...document.querySelectorAll<HTMLElement>('[data-testid="journal-row"]')];
        const box = all[0]?.closest('[aria-label="Squeaklet and you"]')?.getBoundingClientRect();
        // Rows that did not fit wrap into a column past the box's right edge, clipped.
        const rows = all.filter((r) => box !== undefined && r.getBoundingClientRect().left < box.right);
        return {
          rings: document.querySelectorAll('[role=progressbar]').length,
          rows: rows.map((r) => r.innerText),
          cut: rows.filter((r) => box !== undefined && r.getBoundingClientRect().bottom > box.bottom + 0.5).length,
          text: document.getElementById('root')!.innerText,
          scrollH: document.documentElement.scrollHeight,
          innerH: window.innerHeight,
        };
      });
      expect(m.rings).toBe(0);
      expect(m.rows.length).toBeGreaterThan(0);
      expect(m.rows.length).toBeLessThan(12);
      expect(m.cut).toBe(0);
      // Newest first: the most recent entry (played, an hour ago) leads.
      expect(m.rows[0]).toContain('Squeaklet played Peek with you');
      expect(m.text).toContain('Close');
      expect(m.scrollH).toBeLessThanOrEqual(m.innerH);
      expect(b.errors).toEqual([]);
    } finally {
      await b.close();
    }
  });

  it('a failed care call shows and announces a plain-language notice', async () => {
    const b = await boot('mon-card', { ...echoShow8('inline', 'light'), result: { mon: monFor('dex-002'), care }, callFails: true });
    try {
      await b.frame.getByRole('button', { name: 'Feed' }).click();
      await b.frame.waitForFunction(() => (document.querySelector('[role=status]')?.textContent ?? '') !== '', null, { timeout: 5000 });
      const live = await b.frame.locator('[role=status]').textContent();
      expect(live).toBe("NYC-MON can't reach your Mon right now. Try again in a minute.");
      expect(await b.frame.evaluate(() => document.getElementById('root')!.innerText)).toContain("can't reach your Mon");
    } finally {
      await b.close();
    }
  });

  // "Hello Mon, wanna play?" as visemes over 1.6 s: open vowels, a closure, a pause.
  const helloCue = {
    kind: 'start',
    id: 'boot-1',
    elapsedMs: 0,
    durationMs: 1600,
    track: {
      kind: 'visemes',
      keys: [
        { v: 'mid', startMs: 0, endMs: 120 },
        { v: 'wide', startMs: 120, endMs: 300 },
        { v: 'round', startMs: 300, endMs: 520 },
        { v: 'closed', startMs: 520, endMs: 600 },
        { v: 'open', startMs: 600, endMs: 900 },
        { v: 'rest', startMs: 900, endMs: 1050 },
        { v: 'round', startMs: 1050, endMs: 1250 },
        { v: 'open', startMs: 1250, endMs: 1600 },
      ],
    },
  };

  it("Lil' Ratti lip-syncs a speech cue from the host context, then closes to rest", async () => {
    const b = await boot('mon-card', { ...echoShow8('inline', 'light'), result: { mon: monFor('dex-003'), care } });
    try {
      const canvas = b.frame.locator('canvas[data-engine^="three.js"]');
      await b.frame.waitForFunction(() => document.querySelector('[role=img][aria-busy="false"]') !== null, null, { timeout: 15_000 });
      // At rest the jaw is shut and the lips are closed (Lil' Ratti's neutral geometry is open-mouthed).
      await b.frame.waitForFunction(() => {
        const d = document.querySelector('canvas')?.dataset;
        return d?.mouthOpen === '0.00' && d.mouthClose === '1.00';
      }, null, { timeout: 5000 });
      await b.frame.page().evaluate((c) => window.sendHostContext({ nycMonSpeech: c }), helloCue);
      // Mid-utterance the jaw is open; read it a few times since frames are slow in software GL.
      await b.frame.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.mouthOpen ?? 0) > 0.15, null, { timeout: 2000 });
      // Speech opened the lips too.
      expect(Number(await canvas.getAttribute('data-mouth-close'))).toBeLessThan(1);
      // And the turntable has brought the face round to the viewer.
      await b.frame.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.facing ?? 9) < 0.2, null, { timeout: 2000 });
      // After the audio ends the face returns to the rest pose: jaw shut, lips closed.
      await b.frame.waitForFunction(() => {
        const d = document.querySelector('canvas')?.dataset;
        return Number(d?.mouthOpen ?? 1) < 0.02 && Number(d?.mouthClose ?? 0) > 0.98;
      }, null, { timeout: 5000 });
      expect(Number(await canvas.getAttribute('data-mouth-open'))).toBeLessThan(0.02);
      expect(Number(await canvas.getAttribute('data-mouth-close'))).toBeGreaterThan(0.98);
      expect(b.errors).toEqual([]);
    } finally {
      await b.close();
    }
  });

  it('Squeaklet lip-syncs a speech cue from the host context, then closes to rest', async () => {
    // Fed, so Squeaklet loops its idle clips. Hungry it plays jaw_chomp
    // (MON_CLIPS needs-fullness), which moves the jaw and so owns it over the rest pose.
    const fed = { ...care, fullness: 0.9, wantsFood: false };
    const b = await boot('mon-card', { ...echoShow8('inline', 'light'), result: { mon: monFor('dex-002'), care: fed } });
    try {
      const canvas = b.frame.locator('canvas[data-engine^="three.js"]');
      await b.frame.waitForFunction(() => document.querySelector('[role=img][aria-busy="false"]') !== null, null, { timeout: 15_000 });
      // Squeaklet binds with the mouth ajar. At rest the jaw sits on its mouth_close
      // pose (jawClosedRad 0.357 in MON_MODELS, where data-mouth-open reads 0) and
      // mouthClose holds its rest value of 1.
      await b.frame.waitForFunction(() => {
        const d = document.querySelector('canvas')?.dataset;
        return d?.mouthOpen === '0.00' && d.mouthClose === '1.00';
      }, null, { timeout: 5000 });
      await b.frame.page().evaluate((c) => window.sendHostContext({ nycMonSpeech: c }), { ...helloCue, id: 'boot-squeaklet' });
      await b.frame.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.mouthOpen ?? 0) > 0.15, null, { timeout: 2000 });
      expect(Number(await canvas.getAttribute('data-mouth-close'))).toBeLessThan(1);
      await b.frame.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.facing ?? 9) < 0.2, null, { timeout: 2000 });
      await b.frame.waitForFunction(() => {
        const d = document.querySelector('canvas')?.dataset;
        return Number(d?.mouthOpen ?? 1) < 0.02 && Number(d?.mouthClose ?? 0) > 0.98;
      }, null, { timeout: 5000 });
      expect(Number(await canvas.getAttribute('data-mouth-open'))).toBeLessThan(0.02);
      expect(Number(await canvas.getAttribute('data-mouth-close'))).toBeGreaterThan(0.98);
      expect(b.errors).toEqual([]);
    } finally {
      await b.close();
    }
  });

  it('a care button calls its tool through the bridge', async () => {
    const b = await boot('mon-card', { ...echoShow8('inline', 'light'), result: { mon: monFor('dex-002'), care } });
    try {
      await b.frame.getByRole('button', { name: 'Feed' }).click();
      await b.frame.page().waitForFunction(() => window.calls.length > 0);
      const calls = await b.frame.page().evaluate(() => window.calls);
      expect(calls[0]).toMatchObject({ name: 'feed_mon', arguments: { monId: 'mon_demo' } });
    } finally {
      await b.close();
    }
  });
});
