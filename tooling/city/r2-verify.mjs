// Verifies a live cell release over its public URL — needs only R2_PUBLIC_BASE_URL (no signing, no creds):
// HEAD + GET every manifest cell under the base, re-hash vs the pinned sha256/byteLength, assert the immutable
// Cache-Control, then a CORS Origin probe and a Range request probe on the first key. Per-file PASS/FAIL,
// non-zero exit on any FAIL.
//
//   R2_PUBLIC_BASE_URL=https://city-assets.nyc-mon.city/releases/<release-id>/ node tooling/city/r2-verify.mjs
//   R2_PUBLIC_BASE_URL=https://pub-<id>.r2.dev/releases/<release-id>/ node tooling/city/r2-verify.mjs --head-only
//
// The base is a literal release root. R2 has no releases/current/<path> resolution (it 404s), so a base ending in
// /releases/current is refused.
//
//   --head-only        skip the GET bodies (headers + pins on Content-Length only)
//   --concurrency N    parallel checks (default 8)
//   --limit N          check only the first N manifest cells (probes still run on the first)
//   --origin <o>       Origin for the CORS probe (default https://nyc-mon.city)
//   --manifest <path>  manifest.ts override (default the repo's vd-cells-manifest.ts)
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCellsManifest } from './r2-publish.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');
const MANIFEST_TS = join(ROOT, 'packages/app/features/game/world/cell-source/data/vd-cells-manifest.ts');
const IMMUTABLE_CC = 'public, max-age=31536000, immutable';
const sha256hex = (buf) => createHash('sha256').update(buf).digest('hex');

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const flag = (n) => args.includes(`--${n}`);

const BASE = (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
if (!BASE) {
  console.error('r2-verify: R2_PUBLIC_BASE_URL is required (e.g. https://city-assets.nyc-mon.city/releases/<release-id>/)');
  process.exit(1);
}
if (/\/releases\/current$/.test(BASE)) {
  console.error('r2-verify: R2_PUBLIC_BASE_URL ends in /releases/current, which R2 does not resolve (every object 404s). Use the literal release root, https://<host>/releases/<release-id>/');
  process.exit(1);
}
const HEAD_ONLY = flag('head-only');
const CONCURRENCY = Number(arg('concurrency', '8'));
const LIMIT = arg('limit', undefined) ? Number(arg('limit')) : Infinity;
const ORIGIN = arg('origin', 'https://nyc-mon.city');
const MANIFEST = arg('manifest', MANIFEST_TS);

const manifest = parseCellsManifest(await readFile(MANIFEST, 'utf8'));
const cells = Object.keys(manifest.cells).sort().slice(0, LIMIT).map((key) => ({ key, ...manifest.cells[key] }));
console.log(`r2-verify: ${cells.length} cells under ${BASE}/`);

const results = [];
let next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < cells.length) {
    const cell = cells[next++];
    const url = `${BASE}/${cell.path}`;
    const fail = [];
    let head;
    try {
      head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(60_000) });
    } catch (err) {
      results.push({ key: cell.key, ok: false, why: [`HEAD ${err.message}`] });
      continue;
    }
    if (head.status !== 200) {
      fail.push(`HEAD HTTP ${head.status}`);
    } else {
      const len = Number(head.headers.get('content-length') ?? -1);
      if (len !== cell.bytes) fail.push(`content-length ${len} != pin ${cell.bytes}`);
      const cc = head.headers.get('cache-control') ?? '';
      if (cc !== IMMUTABLE_CC) fail.push(`cache-control '${cc}' != '${IMMUTABLE_CC}'`);
    }
    if (!HEAD_ONLY && head.status === 200) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
        const body = new Uint8Array(await res.arrayBuffer());
        const sha = sha256hex(body);
        if (res.status !== 200) fail.push(`GET HTTP ${res.status}`);
        else if (body.byteLength !== cell.bytes || sha !== cell.sha256) {
          fail.push(`GET ${sha.slice(0, 12)}/${body.byteLength} != pin ${cell.sha256.slice(0, 12)}/${cell.bytes}`);
        }
      } catch (err) {
        fail.push(`GET ${err.message}`);
      }
    }
    results.push({ key: cell.key, ok: fail.length === 0, why: fail });
  }
}));

for (const r of results) {
  if (r.ok) console.log(`PASS ${r.key}`);
  else console.log(`FAIL ${r.key}  ${r.why.join('; ')}`);
}

// Probes on the first checked key: CORS origin and a Range request.
const probeKey = cells[0];
if (probeKey) {
  const url = `${BASE}/${probeKey.path}`;
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { Origin: ORIGIN } });
    const acao = res.headers.get('access-control-allow-origin');
    // A 404 can carry the header too; the probe only counts against a real object.
    if (res.status === 200 && acao) {
      console.log(`PASS cors  HTTP 200, access-control-allow-origin: ${acao} (origin ${ORIGIN})`);
      results.push({ key: '@cors', ok: true, why: [] });
    } else {
      const why = [...(res.status === 200 ? [] : [`HTTP ${res.status}`]), ...(acao ? [] : ['no ACAO header'])];
      console.log(`FAIL cors  ${why.join('; ')} on HEAD with Origin ${ORIGIN}`);
      results.push({ key: '@cors', ok: false, why });
    }
  } catch (err) {
    console.log(`FAIL cors  ${err.message}`);
    results.push({ key: '@cors', ok: false, why: [err.message] });
  }
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-63' } });
    const body = new Uint8Array(await res.arrayBuffer());
    const cr = res.headers.get('content-range') ?? '';
    if (res.status === 206 && body.byteLength === 64 && cr.endsWith(`/${probeKey.bytes}`)) {
      console.log(`PASS range bytes=0-63 -> 206, ${body.byteLength} B, content-range ${cr}`);
      results.push({ key: '@range', ok: true, why: [] });
    } else {
      console.log(`FAIL range HTTP ${res.status}, ${body.byteLength} B, content-range '${cr}'`);
      results.push({ key: '@range', ok: false, why: [`HTTP ${res.status}`] });
    }
  } catch (err) {
    console.log(`FAIL range  ${err.message}`);
    results.push({ key: '@range', ok: false, why: [err.message] });
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} PASS, ${failed.length} FAIL`);
if (failed.length) process.exit(1);
