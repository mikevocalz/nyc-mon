// Back-navigation regression check for the Skia/CanvasKit fallback.
// Next keeps a left route mounted inside a hidden React <Activity>
// (cacheComponents), which runs effect cleanups on hide and re-runs the
// effects on return. A background that frees GPU objects in a cleanup and
// reuses them on return crashes into the error boundary. This drives
// Playwright's bundled chromium (no WebGPU, so the Skia fallback draws the
// backgrounds): load `/`, client-navigate to each route, press Back, and fail
// on the error boundary text or any pageerror. Both motion modes, 390 and 1440.
import { BASE, launch, motionModes } from './lib.mjs';

const ROUTES = (process.env.SITE_QA_BACKNAV_ROUTES ?? '/how-it-works,/story,/mons').split(',');
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const ERROR_TEXT = 'Something went wrong';

const { browser, label } = await launch('bundled');
console.log(`[backnav] ${label} against ${BASE}`);
const failures = [];
let runs = 0;

for (const motion of motionModes()) {
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      runs++;
      const name = `${motion} ${viewport.width} ${route}`;
      const context = await browser.newContext({ viewport, reducedMotion: motion });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.split('\n')[0]}`));
      // React reports errors its boundary caught to the console, not as pageerrors.
      page.on('console', (m) => {
        if (m.type() === 'error' && /BindingError|deleted object/.test(m.text())) errors.push(`console: ${m.text().split('\n')[0]}`);
      });
      try {
        await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
        const webgpu = await page.evaluate(async () => !!(navigator.gpu && (await navigator.gpu.requestAdapter())));
        if (webgpu) throw new Error('WebGPU adapter present: this check needs the Skia fallback');
        await page.waitForTimeout(1000);
        await page.locator(`a[href="${route}"]:visible`).first().click();
        await page.waitForURL(`**${route}`);
        await page.waitForTimeout(800);
        await page.goBack();
        await page.waitForURL(`${BASE}/`);
        await page.waitForTimeout(2000);
        const body = await page.locator('body').innerText();
        if (body.includes(ERROR_TEXT)) errors.push(`error boundary: "${ERROR_TEXT}" after Back`);
      } catch (e) {
        errors.push(`run failed: ${e.message.split('\n')[0]}`);
      }
      const unique = [...new Set(errors)];
      console.log(`${unique.length ? 'FAIL' : 'ok  '} ${name}${unique.length ? `\n       ${unique.join('\n       ')}` : ''}`);
      if (unique.length) failures.push(name);
      await context.close();
    }
  }
}

await browser.close();
console.log(`[backnav] ${runs - failures.length}/${runs} passed`);
if (failures.length) process.exit(1);
