import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { CreatureArt } from '@acme/assets/creatures';
import {
  ADMIN_STILLS_TTL_MS, adminStillsStore, currentAdminStills, loadAdminStills, monArtUrl, parseMonArt, resetAdminStills, stillFor,
  stillPlaceholder, type AdminStill,
} from './admin-stills.ts';

const GEN = { tool: 't', model: 'm', date: 'd' };
/** Bundled art stand-ins: a Baby still for #2, an egg still for #1, the hatch scene. */
const BUNDLED: readonly CreatureArt[] = [
  { id: 'squeaklet', kind: 'baby', dexId: 2, source: 1, alt: 'Squeaklet', width: 960, height: 1200, blurDataURL: 'data:blur', generatedWith: GEN },
  { id: 'metro-egg', kind: 'egg', dexId: 1, source: 2, alt: 'Metro Egg', width: 960, height: 1200, blurDataURL: 'data:blur', generatedWith: GEN },
  { id: 'hatch-night', kind: 'scene', source: 3, alt: 'Hatch night', width: 1536, height: 1024, blurDataURL: 'data:blur', generatedWith: GEN },
];
const FYE: AdminStill = { speciesId: 'dex-021', url: 'https://cdn.example/mon-art/dex-021.webp', width: 960, height: 1200, alt: 'Fye Dot' };
const SQUEAK: AdminStill = { speciesId: 'dex-002', url: 'https://cdn.example/mon-art/dex-002.webp', width: 800, height: 1000, alt: 'Squeaklet, console' };
const stills = (...list: AdminStill[]) => new Map(list.map((s) => [s.speciesId, s]));

describe('parseMonArt', () => {
  const good = { speciesId: 'dex-021', url: FYE.url, width: 960, height: 1200, alt: 'Fye Dot', status: 'approved' };

  it('keeps a valid doc with only the fields the app reads', () => {
    assert.deepEqual(parseMonArt({ docs: [good] }), [FYE]);
  });

  it('drops docs with a non-https url, a bad size, an empty alt or no species id', () => {
    const bad = [
      { ...good, url: 'http://cdn.example/x.webp' },
      { ...good, url: 42 },
      { ...good, width: 0 },
      { ...good, height: -5 },
      { ...good, width: Number.NaN },
      { ...good, height: '1200' },
      { ...good, alt: '   ' },
      { ...good, alt: undefined },
      { ...good, speciesId: 21 },
      { ...good, speciesId: '' },
      null,
      'dex-021',
    ];
    assert.deepEqual(parseMonArt({ docs: [...bad, good] }), [FYE]);
  });

  it('reads a missing or malformed body as no stills', () => {
    for (const body of [null, undefined, {}, { docs: null }, { docs: 'x' }, 'text', 7]) assert.deepEqual(parseMonArt(body), []);
  });
});

describe('stillFor resolution order', () => {
  it('prefers the approved console still over the bundled one', () => {
    const art = stillFor('baby', 2, 'dex-002', stills(SQUEAK), BUNDLED);
    assert.equal(art?.source, SQUEAK.url);
    assert.equal(art?.alt, SQUEAK.alt);
    assert.equal(art?.width, 800);
    assert.equal(art?.kind, 'baby');
    assert.equal(art?.dexId, 2);
    assert.equal(art?.blurDataURL, '');
  });

  it('falls back to the bundled still when the console has none for the form', () => {
    assert.equal(stillFor('baby', 2, 'dex-002', stills(FYE), BUNDLED)?.id, 'squeaklet');
    assert.equal(stillFor('egg', 1, 'dex-001', new Map(), BUNDLED)?.id, 'metro-egg');
  });

  it('returns undefined (Coming Soon) when neither exists', () => {
    assert.equal(stillFor('baby', 30, 'dex-030', stills(FYE), BUNDLED), undefined);
    assert.equal(stillFor('baby', null, null, stills(FYE), BUNDLED), undefined);
  });

  it('shows a console still for a form with no bundled art', () => {
    assert.equal(stillFor('baby', 21, 'dex-021', stills(FYE), BUNDLED)?.source, FYE.url);
  });

  it('matches the bundled kind, and never the hatch scene for the Dex', () => {
    assert.equal(stillFor('egg', 2, 'dex-002', new Map(), BUNDLED), undefined, 'no egg still for #2');
    assert.equal(stillFor('any', 1, 'dex-001', new Map(), BUNDLED)?.id, 'metro-egg');
    assert.equal(stillFor('any', 1, 'dex-001', stills({ ...SQUEAK, speciesId: 'dex-001' }), BUNDLED)?.kind, 'egg');
  });

  it('keys the console still by species id, so a missing species id skips it', () => {
    assert.equal(stillFor('baby', 2, undefined, stills(SQUEAK), BUNDLED)?.id, 'squeaklet');
  });

  it('asks for a blur placeholder only when the still has a blur preview', () => {
    assert.equal(stillPlaceholder(BUNDLED[0]!), 'blur');
    assert.equal(stillPlaceholder(stillFor('baby', 2, 'dex-002', stills(SQUEAK), BUNDLED)!), 'empty');
  });
});

describe('loadAdminStills', () => {
  afterEach(() => resetAdminStills());

  const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;

  it('builds the approved-only REST read under the Payload origin', () => {
    assert.equal(monArtUrl('https://admin.example/'), 'https://admin.example/payload-api/mon-art?where[status][equals]=approved&depth=0&limit=200');
  });

  it('loads approved stills into the store', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ docs: [FYE, { ...SQUEAK, url: 'ftp://x' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    await loadAdminStills('https://admin.example', { fetchImpl, now: () => 1000 });
    assert.deepEqual([...currentAdminStills().keys()], ['dex-021']);
    assert.equal(urls.length, 1);
    assert.equal(adminStillsStore.getState().loadedAt, 1000);
  });

  it('does not refetch inside the TTL, and refetches after it', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ docs: [FYE] }), { status: 200 });
    }) as unknown as typeof fetch;
    let t = 0;
    await loadAdminStills('https://a', { fetchImpl, now: () => t });
    t = ADMIN_STILLS_TTL_MS - 1;
    await loadAdminStills('https://a', { fetchImpl, now: () => t });
    assert.equal(calls, 1);
    t = ADMIN_STILLS_TTL_MS + 1;
    await loadAdminStills('https://a', { fetchImpl, now: () => t });
    assert.equal(calls, 2);
  });

  it('shares one request between concurrent callers', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ docs: [FYE] }), { status: 200 });
    }) as unknown as typeof fetch;
    await Promise.all([loadAdminStills('https://a', { fetchImpl }), loadAdminStills('https://a', { fetchImpl })]);
    assert.equal(calls, 1);
  });

  it('swallows a network failure or bad status and keeps the last good list', async () => {
    await loadAdminStills('https://a', { fetchImpl: ok({ docs: [FYE] }), now: () => 0 });
    const throwing = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    await assert.doesNotReject(loadAdminStills('https://a', { fetchImpl: throwing, now: () => ADMIN_STILLS_TTL_MS * 2 }));
    assert.equal(currentAdminStills().get('dex-021')?.url, FYE.url);
    const failing = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    await loadAdminStills('https://a', { fetchImpl: failing, now: () => ADMIN_STILLS_TTL_MS * 4 });
    assert.equal(currentAdminStills().size, 1);
    assert.equal(adminStillsStore.getState().loading, false);
  });

  it('starts empty, so the bundled stills show before any load', () => {
    assert.equal(currentAdminStills().size, 0);
    assert.equal(stillFor('baby', 2, 'dex-002', currentAdminStills(), BUNDLED)?.id, 'squeaklet');
  });
});
