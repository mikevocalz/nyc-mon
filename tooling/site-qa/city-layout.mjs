// Read-only browser regression for the actual City route, with motion reduced.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(new URL('../../apps/storybook/package.json', import.meta.url));
const { chromium } = require('playwright');
const base = process.env.BASE ?? 'http://127.0.0.1:3611';
const prefix = process.env.BASE_PATH ?? '/nyc-mon';
const results = [];
let browser;
try {
  browser = await chromium.launch();
  for (const width of [320, 390, 768, 1180, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 757 }, reducedMotion: 'reduce' });
    try {
      await page.goto(`${base}${prefix}/city/`);
      await page.locator('#w03-district-atlas').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.fonts.status === 'loaded', undefined, { timeout: 10000 });
      const layout = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#w03-district-atlas > li')];
        const rect = (element) => {
          if (!element) throw new Error('Missing City layout target');
          const { top, bottom, height } = element.getBoundingClientRect();
          return { top, bottom, height };
        };
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          cards: cards.map((card) => ({ alignContent: getComputedStyle(card).alignContent, panel: rect(card.firstElementChild) })),
          image: rect(document.getElementById('w03-photo-downtown')),
        };
      });
      assert.equal(layout.overflow, false, 'horizontal overflow');
      assert.equal(layout.cards.length, 4);
      for (const card of layout.cards) assert.equal(card.alignContent, 'stretch');
      if (width >= 768) {
        assert.ok(Math.abs(layout.cards[0].panel.bottom - layout.cards[2].panel.bottom) <= 2, 'leading panel must end beside Harlem');
        assert.ok(layout.image.height > 384, 'leading photo must fill beyond its minimum height');
      } else {
        for (let i = 1; i < layout.cards.length; i++) assert.ok(layout.cards[i].panel.top > layout.cards[i - 1].panel.bottom, 'mobile reading order');
      }
      results.push({ width, status: 'PASSED', layout });
    } catch (error) {
      results.push({ width, status: 'FAILED', error: String(error) });
    } finally {
      await page.close();
    }
  }
} catch (error) {
  results.push({ status: 'NOT RUN', error: String(error) });
} finally {
  await browser?.close();
  const destination = path.resolve('tooling/site-qa/out/city-layout.json');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify({ base, prefix, results }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => result.status !== 'PASSED')) process.exitCode = 1;
}
