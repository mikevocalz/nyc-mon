#!/usr/bin/env node
// fetch-skies.mjs — downloads the Poly Haven puresky HDRIs this package's
// lighting JSONs are computed from, at BUILD TIME only. The .hdr payloads land
// in skies/.cache/ (gitignored); nothing large is committed.
//
//   node fetch-skies.mjs                 # fetch all SKIES at --resolution (default 2k)
//   node fetch-skies.mjs --resolution 4k # pick another size the API offers
//   node fetch-skies.mjs --out /tmp/sky  # write .hdr files elsewhere
//   node fetch-skies.mjs --check         # verify ids/URLs exist without downloading
//
// After downloading, the script rewrites manifest.json next to itself with the
// sha256, byte size and fetch date of each file, so the committed manifest pins
// exactly what scripts/precompute-skies.mjs consumed. Every listed asset is
// CC0 (https://polyhaven.com/license); the licence is recorded per asset anyway.

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The sky candidates lane R0 fetched (verified HDRI, type 0, via /assets?t=hdris).
 * `slot` is the time-of-day the asset competes for; `role` marks the original
 * three vs the alternates added after the first pass found dusk_1 has no sun
 * disc and night's brightest cluster is a star, not the moon.
 */
const SKIES = [
  { id: 'qwantani_morning_puresky', slot: 'morning', role: 'primary' },
  { id: 'qwantani_dusk_1_puresky', slot: 'dusk', role: 'primary' },
  { id: 'qwantani_night_puresky', slot: 'night', role: 'primary' },
  { id: 'qwantani_dusk_2_puresky', slot: 'dusk', role: 'alternate' },
  { id: 'qwantani_sunset_puresky', slot: 'dusk', role: 'alternate' },
  { id: 'qwantani_moonrise_puresky', slot: 'night', role: 'alternate' },
  { id: 'qwantani_moon_noon_puresky', slot: 'night', role: 'alternate' },
];

const LICENSE = {
  code: 'CC0-1.0',
  name: 'Creative Commons Zero (public domain dedication)',
  url: 'https://polyhaven.com/license',
};

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const RESOLUTION = flag('resolution', '2k');
const OUT_DIR = resolve(flag('out', join(HERE, '.cache')));
const CHECK_ONLY = args.includes('--check');

const apiGet = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'nyc-mon sky fetch (build-time)' } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.json();
};

const main = async () => {
  // One listing call verifies all three ids exist and are HDRIs (type 0).
  const listing = await apiGet('https://api.polyhaven.com/assets?t=hdris');
  await mkdir(OUT_DIR, { recursive: true });

  const assets = {};
  for (const sky of SKIES) {
    const meta = listing[sky.id];
    if (!meta) throw new Error(`${sky.id} is not in the Poly Haven HDRI listing`);
    if (meta.type !== 0) throw new Error(`${sky.id} is not an HDRI (type ${meta.type})`);

    const files = await apiGet(`https://api.polyhaven.com/files/${sky.id}`);
    const variant = files.hdri?.[RESOLUTION]?.hdr;
    if (!variant?.url) {
      throw new Error(`${sky.id} has no .hdr at ${RESOLUTION}; offered: ${Object.keys(files.hdri ?? {}).join(', ')}`);
    }

    const fileName = `${sky.id}_${RESOLUTION}.hdr`;
    const outPath = join(OUT_DIR, fileName);
    let sha256;
    let bytes;

    if (CHECK_ONLY) {
      const head = await fetch(variant.url, { method: 'HEAD' });
      if (!head.ok) throw new Error(`HEAD ${variant.url} -> HTTP ${head.status}`);
      console.log(`[check] ${sky.id}: ${RESOLUTION} .hdr available (${((variant.size ?? 0) / 1e6).toFixed(1)} MB)`);
    } else {
      // Skip the download if a cached file already matches the API's md5.
      let cached = false;
      try {
        const buf = await readFile(outPath);
        const md5 = createHash('md5').update(buf).digest('hex');
        cached = !variant.md5 || md5 === variant.md5;
        if (cached) {
          sha256 = createHash('sha256').update(buf).digest('hex');
          bytes = buf.length;
          console.log(`[cache] ${fileName} (${(bytes / 1e6).toFixed(1)} MB, md5 ok)`);
        }
      } catch {
        /* no cache */
      }
      if (!cached) {
        console.log(`[fetch] ${variant.url}`);
        const res = await fetch(variant.url);
        if (!res.ok) throw new Error(`GET ${variant.url} -> HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (variant.size && buf.length !== variant.size) {
          throw new Error(`${fileName}: size ${buf.length} != API size ${variant.size}`);
        }
        const md5 = createHash('md5').update(buf).digest('hex');
        if (variant.md5 && md5 !== variant.md5) {
          throw new Error(`${fileName}: md5 ${md5} != API md5 ${variant.md5}`);
        }
        await writeFile(outPath, buf);
        sha256 = createHash('sha256').update(buf).digest('hex');
        bytes = buf.length;
        console.log(`[saved] ${outPath} (${(bytes / 1e6).toFixed(1)} MB)`);
      }
    }

    assets[sky.id] = {
      id: sky.id,
      name: meta.name,
      timeOfDay: sky.slot,
      role: sky.role,
      authors: Object.keys(meta.authors ?? {}),
      assetPage: `https://polyhaven.com/a/${sky.id}`,
      apiInfoUrl: 'https://api.polyhaven.com/assets?t=hdris',
      apiFilesUrl: `https://api.polyhaven.com/files/${sky.id}`,
      file: {
        url: variant.url,
        resolution: RESOLUTION,
        format: 'hdr',
        bytes: bytes ?? variant.size ?? null,
        md5: variant.md5 ?? null,
        sha256: sha256 ?? null,
        path: outPath.startsWith(HERE) ? outPath.slice(HERE.length + 1) : outPath,
        fetchedAt: CHECK_ONLY ? null : new Date().toISOString(),
      },
      tonemappedPreview: `previews/${sky.id}.png`,
      license: { ...LICENSE, recordedAt: new Date().toISOString() },
    };
  }

  if (!CHECK_ONLY) {
    const manifest = {
      $schema: 'nyc-mon/sky-asset-manifest/v1',
      generatedBy: 'fetch-skies.mjs — build-time fetch; .hdr payloads are gitignored under .cache/',
      resolution: RESOLUTION,
      license: LICENSE,
      assets,
    };
    await writeFile(join(HERE, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`[manifest] wrote manifest.json for ${Object.keys(assets).length} assets`);
  }
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
