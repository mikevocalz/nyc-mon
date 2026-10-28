// Downloads the Valdrada tiles covering the baked square into tooling/city/.cache/valdrada/.
//
//   node tooling/city/valdrada/fetch.mjs            # fetch what pins.json doesn't already have
//   node tooling/city/valdrada/fetch.mjs --refresh  # re-fetch every tile anyway
//
// Source: Hugging Face dataset mehmetkeremturkcan/valdrada at tag v0.4.0 (commit 2724c79),
// paths Content/tiles/manifest.json + Content/tiles/t_<x>_<z>.bin — the layout the upstream
// client fetches (client/src/world/streamer.js). Tile set is derived from the same constants
// the bake uses (EXTENT_METERS + the build's 40 m road-clip margin) — see decode.mjs and the
// P0 findings doc. Tile bytes are ODbL 1.0 — cache dir is git-ignored; the integrity record
// lands in committed pins.json.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTENT_METERS, tileIdsForSquare } from './decode.mjs';

const HF_REPO = 'datasets/mehmetkeremturkcan/valdrada';
export const PIN_TAG = 'v0.4.0';
export const PIN_COMMIT = '2724c79';
export const HF_BASE = `https://huggingface.co/${HF_REPO}/resolve/${PIN_TAG}`;
const USER_AGENT = 'nyc-mon-city-build/1.0 (offline tile bake)';
const ROAD_CLIP_MARGIN_M = 40; // build.mjs clips CSCL roads to extent +40

const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = join(HERE, '..', '.cache', 'valdrada');
export const PINS_PATH = join(HERE, 'pins.json');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function fetchBytes(path) {
  const res = await fetch(`${HF_BASE}/${path}`, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`fetch ${path}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function fetchTiles({ refresh = false } = {}) {
  const ids = tileIdsForSquare(EXTENT_METERS, ROAD_CLIP_MARGIN_M);
  await mkdir(CACHE_DIR, { recursive: true });

  let pins = { tag: PIN_TAG, commit: PIN_COMMIT, repo: `https://huggingface.co/${HF_REPO}`, files: {} };
  try {
    pins = { ...pins, ...JSON.parse(await readFile(PINS_PATH, 'utf8')) };
  } catch { /* first run */ }

  const manifestBuf = await fetchBytes('Content/tiles/manifest.json');
  await writeFile(join(CACHE_DIR, 'manifest.json'), manifestBuf);
  const manifest = JSON.parse(manifestBuf.toString('utf8'));

  const files = { 'Content/tiles/manifest.json': { sha256: sha256(manifestBuf), bytes: manifestBuf.length } };
  let fetched = 0;
  for (const id of ids) {
    const rel = `Content/tiles/${id}.bin`;
    const dest = join(CACHE_DIR, `${id}.bin`);
    if (!refresh) {
      try {
        const cached = await readFile(dest);
        const hash = sha256(cached);
        if (pins.files[rel]?.sha256 === hash) {
          files[rel] = pins.files[rel];
          continue;
        }
      } catch { /* missing or unreadable — fetch below */ }
    }
    const buf = await fetchBytes(rel);
    const hash = sha256(buf);
    if (pins.files[rel]?.sha256 && pins.files[rel].sha256 !== hash) {
      throw new Error(`pin mismatch for ${rel}: recorded ${pins.files[rel].sha256}, got ${hash}`);
    }
    await writeFile(dest, buf);
    files[rel] = { sha256: hash, bytes: buf.length, retrievedAt: new Date().toISOString() };
    fetched++;
  }

  pins = { ...pins, manifestTiles: manifest.tiles ? Object.keys(manifest.tiles).length : 0, files };
  await writeFile(PINS_PATH, `${JSON.stringify(pins, null, 2)}\n`);
  return { ids, files, manifest, fetched };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const refresh = process.argv.includes('--refresh');
  const { ids, files, fetched } = await fetchTiles({ refresh });
  const total = Object.values(files).reduce((a, f) => a + f.bytes, 0);
  console.log(`${ids.length} tiles covering the ${EXTENT_METERS} m square (+${ROAD_CLIP_MARGIN_M} m margin):`);
  console.log(`  ${ids.join(' ')}`);
  console.log(`downloaded ${fetched} file(s); ${total.toLocaleString('en-US')} bytes cached in ${CACHE_DIR}`);
  console.log(`pins recorded at ${PINS_PATH}`);
}
