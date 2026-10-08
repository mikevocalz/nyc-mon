// Shared pieces for the site-qa scripts: config, browser launch, section
// discovery, reveal settling and table output.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

export const ROOT = path.dirname(new URL(import.meta.url).pathname);
export const OUT = path.join(ROOT, 'out');
export const BASE = (process.env.BASE ?? 'http://localhost:3100').replace(/\/$/, '');
export const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

export const SYSTEM_CHROME = process.env.CHROME_PATH
  ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']
    .find((p) => fs.existsSync(p));

export function outDir(...parts) {
  const dir = path.join(OUT, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** `prefer`: 'system' (installed Chrome, real GPU, WebGPU) or 'bundled'
 *  (Playwright's chromium headless shell). SITE_QA_BROWSER overrides. Keep
 *  'bundled' as the default: the installed Chrome here starts the Meta XR
 *  Simulator (its OpenXR runtime) when launched. */
export async function launch(prefer = 'bundled') {
  const want = process.env.SITE_QA_BROWSER ?? prefer;
  if (want === 'system' && SYSTEM_CHROME) {
    const browser = await chromium.launch({ executablePath: SYSTEM_CHROME, args: ['--headless=new'] });
    return { browser, label: `system Chrome ${browser.version()} (${SYSTEM_CHROME})` };
  }
  if (want === 'system') console.warn('[site-qa] system Chrome not found; using Playwright chromium.');
  const browser = await chromium.launch();
  return { browser, label: `Playwright chromium ${browser.version()}` };
}

export function motionModes() {
  const only = process.env.SITE_QA_MOTION;
  return ['no-preference', 'reduce'].filter((m) => !only || only === m);
}

/** Sections in DOM order. Pages that carry `[data-section]` use those names;
 *  otherwise each config fallback is tried (first matching selector wins). */
export async function findSections(page) {
  return page.evaluate((cfg) => {
    const tagged = [...document.querySelectorAll(cfg.sectionAttribute)];
    let found;
    if (tagged.length) {
      found = tagged.map((el, i) => ({ name: el.getAttribute('data-section') || `section-${i}`, el }));
    } else {
      found = [];
      for (const s of cfg.fallbackSections) {
        let el = null;
        for (const sel of s.selectors) {
          el = [...document.querySelectorAll(sel)].find((e) => !s.textIncludes || e.textContent?.includes(s.textIncludes)) ?? null;
          if (el) break;
        }
        if (el) found.push({ name: s.name, el });
      }
    }
    window.__siteQaSections = found.map((f) => f.el);
    return found.map((f, index) => ({ name: f.name, index }));
  }, CONFIG);
}

/** Scrolls section `index` (from findSections) under the sticky header. */
export async function scrollToSection(page, index) {
  return page.evaluate((i) => {
    const el = window.__siteQaSections?.[i];
    if (!el) return null;
    const hh = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, top - (el.tagName === 'FOOTER' ? 0 : hh)), behavior: 'instant' });
    return { top: Math.round(top), height: Math.round(el.getBoundingClientRect().height) };
  }, index);
}

/** Waits until reveal targets in the viewport stop changing (computed
 *  opacity + transform identical across 300 ms) and have reached opacity 1.
 *  Scroll-scrubbed targets can rest below 1 on purpose, so after `grace` ms a
 *  stable target below 1 is accepted. Returns true when settled. */
export async function settle(page, timeout = 4000, grace = 1500) {
  const read = () => page.evaluate((sel) => {
    const vh = window.innerHeight;
    let pending = 0;
    const sig = [...document.querySelectorAll(sel)].map((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh && r.height > 0 && Number(s.opacity) < 0.99) pending++;
      return `${el.id}:${s.opacity}:${s.transform}`;
    }).join('|');
    return { sig, pending };
  }, CONFIG.revealSelector);
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const a = await read();
    await page.waitForTimeout(300);
    const b = await read();
    if (a.sig === b.sig && (b.pending === 0 || Date.now() - t0 >= grace)) return true;
  }
  return false;
}

export function table(rows, cols) {
  if (!rows.length) return '(none)';
  const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  const line = (vals) => vals.map((v, i) => String(v ?? '').padEnd(w[i])).join(' | ');
  return [line(cols), w.map((n) => '-'.repeat(n)).join('-|-'), ...rows.map((r) => line(cols.map((c) => r[c])))].join('\n');
}

export function median(values) {
  const v = values.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}
