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
export const FAR_REV = '09b583662e760b5976d636d341d0e5f81a7c7fcf';
export const HF_BASE = `https://huggingface.co/${HF_REPO}/resolve/${PIN_TAG}`;
export const HF_FAR_BASE = `https://huggingface.co/${HF_REPO}/resolve/${FAR_REV}`;
const HF_TREE = `https://huggingface.co/api/${HF_REPO}/tree/${FAR_REV}`;
const USER_AGENT = 'nyc-mon-city-build/1.0 (offline tile bake)';
const ROAD_CLIP_MARGIN_M = 40; // build.mjs clips CSCL roads to extent +40

const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = join(HERE, '..', '.cache', 'valdrada');
export const PUBLIC_DIR = join(HERE, '..', '.cache', 'valdrada-public');
export const TEXTURES_DIR = join(HERE, '..', '.cache', 'valdrada-textures');
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

  const files = { ...pins.files, 'Content/tiles/manifest.json': { sha256: sha256(manifestBuf), bytes: manifestBuf.length } };
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

async function hfTree(dirPath) {
  const out = [];
  let url = `${HF_TREE}/${dirPath}?recursive=true&expand=false`;
  while (url) {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    if (!res.ok) throw new Error(`tree ${dirPath}: HTTP ${res.status}`);
    out.push(...(await res.json()));
    const link = res.headers.get('link') || '';
    url = null;
    for (const part of link.split(',')) {
      const m = part.match(/<([^>]+)>;\s*rel="next"/);
      if (m) url = m[1];
    }
  }
  return out;
}

const FAR_RULES = [
  [/^Content\/tiles\/(manifest\.json|bridges\.json|(?:t|far)_.+\.bin)$/, (m) => join(CACHE_DIR, m[1])],
  [/^Content\/data\/(landmarks\.json|landmark_meshes\.json)$/, (m) => join(PUBLIC_DIR, 'data', m[1])],
  [/^Content\/models\/landmarks\/(liberty_statue_l\d\.glb|liberty_statue\.json|NOTICE_liberty\.md)$/, (m) => join(PUBLIC_DIR, 'models', 'landmarks', m[1])],
  [/^Content\/textures\/(far_windows_fw14\.png)$/, (m) => join(TEXTURES_DIR, m[1])],
];

const FAR_DIRS = ['Content/tiles', 'Content/data', 'Content/models/landmarks', 'Content/textures'];

export async function fetchFar({ refresh = false, concurrency = 12 } = {}) {
  await mkdir(CACHE_DIR, { recursive: true });
  let pins = { tag: PIN_TAG, commit: PIN_COMMIT, repo: `https://huggingface.co/${HF_REPO}`, files: {} };
  try {
    pins = { ...pins, ...JSON.parse(await readFile(PINS_PATH, 'utf8')) };
  } catch { /* first run */ }

  const wanted = new Map();
  for (const dir of FAR_DIRS) {
    for (const e of await hfTree(dir)) {
      if (e.type !== 'file') continue;
      for (const [re, dest] of FAR_RULES) {
        const m = e.path.match(re);
        if (!m) continue;
        wanted.set(e.path, { dest: dest(m), sha256: e.lfs ? e.lfs.oid : null, bytes: e.size });
        break;
      }
    }
  }

  const files = { ...pins.files };
  const jobs = [...wanted.entries()];
  let fetched = 0, done = 0;
  const errors = [];
  const worker = async () => {
    for (;;) {
      const job = jobs.pop();
      if (!job) return;
      const [rel, w] = job;
      if (!refresh) {
        try {
          const cached = await readFile(w.dest);
          const hash = sha256(cached);
          const pinned = files[rel]?.sha256 ?? w.sha256;
          if (pinned && hash === pinned) {
            files[rel] = { sha256: hash, bytes: cached.length, ...(files[rel]?.retrievedAt ? { retrievedAt: files[rel].retrievedAt } : {}) };
            if (++done % 100 === 0) console.log(`  ${done}/${wanted.size} (${fetched} fetched)`);
            continue;
          }
        } catch { /* missing or unreadable — fetch below */ }
      }
      let buf = null;
      for (let attempt = 0; attempt < 8 && !buf; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, Math.min(30000, 2000 * 2 ** attempt)));
        const res = await fetch(`${HF_FAR_BASE}/${rel}`, { headers: { 'user-agent': USER_AGENT } });
        if (res.status === 429 || res.status >= 500) continue;
        if (!res.ok) { errors.push(`${rel}: HTTP ${res.status}`); break; }
        buf = Buffer.from(await res.arrayBuffer());
      }
      if (!buf) { errors.push(`${rel}: retries exhausted`); continue; }
      const hash = sha256(buf);
      const pinned = files[rel]?.sha256 ?? w.sha256;
      if (pinned && pinned !== hash) { errors.push(`pin mismatch for ${rel}: recorded ${pinned}, got ${hash}`); continue; }
      await mkdir(dirname(w.dest), { recursive: true });
      await writeFile(w.dest, buf);
      files[rel] = { sha256: hash, bytes: buf.length, retrievedAt: new Date().toISOString() };
      fetched++;
      if (++done % 100 === 0) console.log(`  ${done}/${wanted.size} (${fetched} fetched)`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (errors.length) throw new Error(`far fetch failed:\n${errors.slice(0, 20).join('\n')}`);

  pins = { ...pins, farRevision: FAR_REV, files };
  await writeFile(PINS_PATH, `${JSON.stringify(pins, null, 2)}\n`);
  return { wanted, files, fetched };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const refresh = process.argv.includes('--refresh');
  if (process.argv.includes('--far')) {
    const { wanted, files, fetched } = await fetchFar({ refresh });
    const total = Object.values(files).reduce((a, f) => a + f.bytes, 0);
    console.log(`${wanted.size} files at revision ${FAR_REV}: downloaded ${fetched}; ${total.toLocaleString('en-US')} bytes pinned`);
    console.log(`pins recorded at ${PINS_PATH}`);
  } else {
    const { ids, files, fetched } = await fetchTiles({ refresh });
    const total = Object.values(files).reduce((a, f) => a + f.bytes, 0);
    console.log(`${ids.length} tiles covering the ${EXTENT_METERS} m square (+${ROAD_CLIP_MARGIN_M} m margin):`);
    console.log(`  ${ids.join(' ')}`);
    console.log(`downloaded ${fetched} file(s); ${total.toLocaleString('en-US')} bytes cached in ${CACHE_DIR}`);
    console.log(`pins recorded at ${PINS_PATH}`);
  }
}
