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
import { getUiResources } from './index.ts';
import { MON_MODEL_ORIGIN } from './model-origin.ts';

/**
 * The hatch moment, booted in Playwright's bundled Chromium on the ext-apps
 * AppBridge (the same spec host as ui.boot.test.ts): hatch_egg's result plays
 * the Metro Egg cracking open, then the card ends on Squeaklet's own
 * MonModel3D with no console error. The touch path starts from a ready egg's
 * "Hatch your egg" button.
 */

const here = dirname(fileURLToPath(import.meta.url));
const MONS_DIR = join(here, '../../../../apps/web/public/mons');
const now = Date.now();

const hatchResult = {
  hatched: true,
  alreadyHatched: false,
  hatching: true,
  egg: { eggId: 'egg_metro', speciesId: 'dex-001' },
  mon: { monId: 'mon_new', name: null, speciesId: 'dex-002', stage: 'Baby', bond: 0, hatchedAt: now - 60_000 },
  care: { energy: 1, fullness: 1, social: 1, activity: 'awake', sluggish: false, wantsFood: false, lastFedAt: null },
  mood: 'content',
};
const readyEgg = {
  incubating: true,
  eggs: [{ eggId: 'egg_metro', speciesId: 'dex-001', incubationEndsAt: now - 60_000, minutesRemaining: 0, readyToHatch: true }],
};
const hostContext = { theme: 'dark', displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'], deviceClass: 'echo-show-8', maxWidth: 1280, maxHeight: 800 };

let browser: Browser;
let server: Server;
let hostUrl: string;
let cardHtml: string;

beforeAll(async () => {
  await buildUi();
  cardHtml = getUiResources().find((r) => r.id === 'mon-card')!.html;
  const outDir = await mkdtemp(join(tmpdir(), 'nyc-mon-hatch-host-'));
  await build({
    configFile: false,
    logLevel: 'warn',
    build: { outDir, lib: { entry: join(here, 'test-host', 'host.ts'), formats: ['iife'], name: 'bootHost', fileName: () => 'host.js' } },
  });
  const hostScript = await readFile(join(outDir, 'host.js'), 'utf8');
  const page = `<!doctype html><html><body style="margin:0"><script>${hostScript.replaceAll('</script', '<\\/script')}</script></body></html>`;
  server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  hostUrl = `http://localhost:${(server.address() as AddressInfo).port}/`;
  browser = await chromium.launch();
}, 600_000);

afterAll(async () => {
  await browser?.close();
  server?.close();
});

async function boot(opts: { result: Record<string, unknown>; callResult?: Record<string, unknown>; reducedMotion: 'reduce' | 'no-preference' }) {
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 840 }, reducedMotion: opts.reducedMotion });
  await ctx.route(`${MON_MODEL_ORIGIN}/mons/*.glb`, async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!;
    try {
      await route.fulfill({ status: 200, body: await readFile(join(MONS_DIR, name)), headers: { 'content-type': 'model/gltf-binary', 'access-control-allow-origin': '*' } });
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
  await page.evaluate((m) => window.mountView(m), { html: cardHtml, width: 1280, height: 800, hostContext, result: opts.result, ...(opts.callResult ? { callResult: opts.callResult } : {}) });
  const frame = (await (await page.waitForSelector('iframe')).contentFrame())!;
  return { page, frame, errors, close: () => ctx.close() };
}

/** Every hatch phase the stage's canvas reports, until the sequence is gone. */
async function watchPhases(frame: Frame, timeoutMs: number): Promise<string[]> {
  const seen: string[] = [];
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const p = await frame.evaluate(() => {
      const seq = document.querySelector('[data-testid="hatch-sequence"]');
      return seq === null ? null : ((seq.querySelector('canvas') as HTMLCanvasElement | null)?.dataset.hatchPhase ?? 'none');
    });
    if (p === null) {
      if (seen.length > 0) return seen;
    } else if (seen.at(-1) !== p) {
      seen.push(p);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`hatch did not finish; saw ${seen.join(' > ')}`);
}

const endsOnSqueaklet = (frame: Frame) =>
  frame.waitForFunction(
    () =>
      document.querySelector('[data-testid="hatch-sequence"]') === null &&
      document.querySelector('[role=img][aria-label="Squeaklet"][aria-busy="false"] canvas') !== null,
    null,
    { timeout: 30_000 },
  );

describe('the hatch moment (bundled Chromium)', { timeout: 180_000 }, () => {
  it("hatch_egg's result cracks the egg, then shows Squeaklet, with no console error", async () => {
    const b = await boot({ result: hatchResult, reducedMotion: 'no-preference' });
    try {
      const phases = await watchPhases(b.frame, 150_000);
      // Frames are slow in software GL, so a short phase may be skipped between samples.
      const order = ['loading', 'stir', 'pressure', 'crack', 'burst', 'emerge', 'done'];
      expect(phases.map((p) => order.indexOf(p))).toEqual([...phases.map((p) => order.indexOf(p))].sort((x, y) => x - y));
      expect(phases).toContain('crack');
      expect(phases).not.toContain('crossfade');
      await endsOnSqueaklet(b.frame);
      const text = await b.frame.evaluate(() => document.getElementById('root')!.innerText);
      expect(text).toContain('Squeaklet');
      expect(await b.frame.locator('[role=progressbar]').count()).toBe(3);
      expect(b.errors).toEqual([]);
    } finally {
      await b.close();
    }
  });

  it('reduced motion: a quick cross-fade, no clip, then Squeaklet', async () => {
    const b = await boot({ result: hatchResult, reducedMotion: 'reduce' });
    try {
      const phases = await watchPhases(b.frame, 120_000);
      expect(phases).not.toContain('crack');
      expect(phases.some((p) => p === 'crossfade' || p === 'done')).toBe(true);
      await endsOnSqueaklet(b.frame);
      expect(b.errors).toEqual([]);
    } finally {
      await b.close();
    }
  });

  it('touch: a ready egg has one Hatch button that calls hatch_egg with the egg, then plays the hatch', async () => {
    const b = await boot({ result: readyEgg, callResult: hatchResult, reducedMotion: 'reduce' });
    try {
      const button = b.frame.getByRole('button', { name: 'Hatch your egg' });
      await button.waitFor({ timeout: 15_000 });
      const buttons = await b.frame.evaluate(() => [...document.querySelectorAll('button, [role=button]')].map((e) => (e.textContent ?? '').trim()));
      expect(buttons).toEqual(['Hatch your egg']);
      await button.click();
      await b.frame.waitForSelector('[data-testid="hatch-sequence"]', { timeout: 10_000 });
      const calls = await b.page.evaluate(() => window.calls);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ name: 'hatch_egg', arguments: { eggId: 'egg_metro' } });
      await endsOnSqueaklet(b.frame);
      // No scroll: one screen.
      const scroll = await b.frame.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      expect(scroll).toBeLessThanOrEqual(0);
      expect(b.errors).toEqual([]);
    } finally {
      await b.close();
    }
  });
});
