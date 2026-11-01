// Headless three.js playback of a hatch GLB: checks the clips the manifest
// names exist, then screenshots the hatch clip at every phase boundary and
// crack beat, plus both attention outcomes.
// usage: node playback.mjs <egg-id> <out-dir>   (needs `python3 -m http.server 8766` at the repo root)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const [egg = 'metro-egg', out = 'playback-out'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://127.0.0.1:8766/tooling/blender/hatching/playback/?egg=${egg}`);
await page.waitForFunction(() => document.title === 'ready' || false, null, { timeout: 120000 }).catch(() => {});
if ((await page.title()) !== 'ready') { console.log(JSON.stringify({ errors })); process.exit(1); }
const info = await page.evaluate(() => window.__info);
const shots = [];
const at = async (clip, t, label) => {
  const state = await page.evaluate(([c, s]) => window.__seek(c, s), [clip, t]);
  const file = `${out}/${egg}-${label}.png`;
  await page.screenshot({ path: file });
  shots.push({ label, clip, t, file, ...state });
};
const ps = info.manifest.phaseSeconds;
for (const [phase, [a]] of Object.entries(ps)) await at('hatch', a + 0.001, `${phase}-start`);
for (const [i, b] of info.manifest.crackBeatSeconds.entries()) await at('hatch', b + 0.25, `crack-beat-${i + 1}`);
await at('hatch', ps.burst[0] + 0.3, 'burst-mid');
await at('hatch', ps.emerge[1] - 0.001, 'emerge-end');
await at('attention_lean_in', 1.5, 'attention-lean-in');
await at('attention_hesitate', 2.0, 'attention-hesitate');
writeFileSync(`${out}/${egg}-playback.json`, JSON.stringify({ info, shots, errors }, null, 2));
console.log(JSON.stringify({ clips: info.clips, missing: info.missing, errors, shots: shots.map((s) => s.label) }));
await browser.close();
