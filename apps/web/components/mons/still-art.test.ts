import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Node can't load .webp; stand in a Next-style StaticImageData for each import.
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.webp')) return nextLoad(url, context);
    const data = { src: new URL(url).pathname, width: 960, height: 1200 };
    return { format: 'module', source: `export default ${JSON.stringify(data)};`, shortCircuit: true };
  },
});

// React's cache() memoises per server request; outside one it is a plain call, so
// the holder is stubbed with one shared map for these tests.
const stills = new Map<string, unknown>();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react' && context.parentURL?.endsWith('still-art.ts')) return { url: 'stub:react', shortCircuit: true };
    // The art maps import siblings without an extension, as Next resolves them.
    if (/^\.\.?\//.test(specifier) && !/\.[a-z]+$/.test(specifier)) {
      try { return nextResolve(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url !== 'stub:react') return nextLoad(url, context);
    return { format: 'module', source: 'const holder = { stills: globalThis.__stills }; export const cache = () => () => holder;', shortCircuit: true };
  },
});
(globalThis as { __stills?: unknown }).__stills = stills;

const { provideAdminStills, adminStill, starterSpeciesId } = await import('./still-art.ts');
const { starterArt, artHref } = await import('../home/art.ts');
const { babyArt, eggArt } = await import('../how-it-works/art.ts');
const { monsArt } = await import('./art.ts');
const { parseMonArt } = await import('../../lib/mon-art-parse.ts');

const FYE = { speciesId: 'dex-021', src: 'https://cdn.example.test/mon-art/dex-021-a.webp', width: 960, height: 1200, alt: 'Fye Dot, from the console.' };
const SIGNAL = { speciesId: 'dex-020', src: 'https://cdn.example.test/mon-art/dex-020-a.webp', width: 960, height: 1200, alt: 'The Signal Egg, from the console.' };

test('starter slots name their Egg and Baby species', () => {
  assert.equal(starterSpeciesId(4, 'Baby'), 'dex-021');
  assert.equal(starterSpeciesId(4, 'Egg'), 'dex-020');
  assert.equal(starterSpeciesId(1, 'Baby'), 'dex-002');
});

test('with no console stills, every slot shows the bundled still', () => {
  provideAdminStills([]);
  assert.match(artHref(starterArt(4)!), /fye-dot\.webp$/);
  assert.match((eggArt(4).src as { src: string }).src, /signal-egg\.webp$/);
  assert.match((monsArt(4).egg.src as { src: string }).src, /signal-egg\.webp$/);
});

test('an approved console still wins over the bundled one, on every surface', () => {
  provideAdminStills([FYE, SIGNAL]);
  assert.equal(adminStill('dex-021')?.src, FYE.src);
  assert.equal(starterArt(4)?.src, FYE.src);
  assert.equal(starterArt(4)?.alt, FYE.alt);
  assert.equal(babyArt(4, '100vw')?.src, FYE.src);
  assert.equal(monsArt(4).baby?.src, FYE.src);
  assert.equal(eggArt(4).src, SIGNAL.src);
  assert.equal(monsArt(4).egg.src, SIGNAL.src);
  // Other slots keep their bundled art.
  assert.match(artHref(starterArt(1)!), /squeaklet\.webp$/);
  provideAdminStills([]);
});

test('the REST answer is filtered to usable approved stills', () => {
  const docs = [
    { speciesId: 'dex-021', url: FYE.src, width: 960, height: 1200, alt: FYE.alt },
    { speciesId: 'dex-020', url: 'http://insecure.example.test/a.webp', width: 960, height: 1200, alt: 'x' },
    { speciesId: 'dex-002', url: FYE.src, width: 0, height: 1200, alt: 'x' },
    { speciesId: 'dex-009', url: FYE.src, width: 960, height: 1200, alt: ' ' },
    { url: FYE.src, width: 960, height: 1200, alt: 'x' },
  ];
  assert.deepEqual(parseMonArt({ docs }), [FYE]);
  assert.deepEqual(parseMonArt(null), []);
  assert.deepEqual(parseMonArt({ errors: [] }), []);
});
