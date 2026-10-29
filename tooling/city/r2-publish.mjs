// Publishes the pinned Valdrada cell set (packages/app/features/game/world/cell-source/data/vd-cells-manifest.ts)
// to Cloudflare R2 over its S3 API: no dependencies, SigV4 over HTTPS with node:crypto only.
//
// Layout in the bucket:
//   releases/<release>/<path>       one object per manifest cell, immutable, sha256 pinned in x-amz-meta-sha256
//   releases/<release>/manifest.json the release's full pin list + the ODbL attribution block, uploaded LAST
//   releases/current                 a record of the active release (JSON {"release": "<id>"}) for tooling. It is one
//                                    object: R2 does not resolve releases/current/<path> from it (that URL is a 404),
//                                    so clients and r2-verify.mjs use a literal releases/<id>/ base. Rollback rewrites
//                                    this one object only.
//
// A new release only reaches players once the clients point at it: bump the literal release root
// (https://city-assets.nyc-mon.city/releases/<id>) in apps/mobile/eas.json (preview + production
// EXPO_PUBLIC_VD_CELL_BASE) and in apps/web/next.config.ts (the same variable's default), then ship those builds.
//
// Cell key -> baked file (mirrors vd-port/write-cells-manifest.mjs):
//   structures/<cx>_<cz>  -> packages/app/features/game/world/vd-port/furniture/cells/<cx>_<cz>.bin
//   near|lite/<cx>_<cz>   -> packages/app/features/game/world/vd-port/blocks/data/<level>/<cx>_<cz>.bin
//   far/<file>.bin        -> tooling/city/.cache/vd-lod16/<file>   (landmarks_l6.bin included)
//
// Env (never logged): R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY;
// optional R2_ENDPOINT (default https://<account>.r2.cloudflarestorage.com), VD_RELEASE_ID.
//
//   node tooling/city/r2-publish.mjs --dry-run                 local pin check + plan, no network
//   node tooling/city/r2-publish.mjs [--release r20261030-0123abcd] [--concurrency 8] [--no-activate]
//   node tooling/city/r2-publish.mjs --verify [--release ID]   GET every object of the release, re-hash vs pins
//   node tooling/city/r2-publish.mjs --rollback <release-id>   flip releases/current only; never deletes
import { createHash, createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');
const MANIFEST_TS = join(ROOT, 'packages/app/features/game/world/cell-source/data/vd-cells-manifest.ts');
const STATE_FILE = join(HERE, '.cache', 'r2-publish-state.json');

const POINTER_KEY = 'releases/current';
const IMMUTABLE_CC = 'public, max-age=31536000, immutable';
const POINTER_CC = 'no-cache';
const OCTET = 'application/octet-stream';
const EMPTY_PAYLOAD_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const ODBL = {
  license: 'ODbL 1.0',
  credit: '© OpenStreetMap contributors, ODbL 1.0',
  url: 'https://opendatacommons.org/licenses/odbl',
  notice:
    'Every object under this release is a derivative database of OpenStreetMap data baked by ' +
    'tooling/city/vd-port (source: github.com/mkturkcan/valdrada @ 2724c79 MIT; tiles+data: ' +
    'huggingface.co/datasets/mehmetkeremturkcan/valdrada rev 09b5836 ODbL 1.0). This manifest and the ' +
    'cells it pins are the derivative-database offer required by ODbL 1.0 §4.4; keep the sha256 and ' +
    'byteLength pins attached so the license text stays bound to the data.',
};

// ---------- manifest ----------

const CELL_LINE =
  /^\s*'([^']+)':\s*\{\s*path:\s*'([^']+)',\s*sha256:\s*'([0-9a-f]{64})',\s*bytes:\s*(\d+),\s*bundled:\s*(true|false)\s*\},?\s*$/;

/** Parses the generated vd-cells-manifest.ts without executing it. Fails closed on any malformed cell line. */
export function parseCellsManifest(text) {
  if (typeof text !== 'string' || !text.includes('VD_CELL_MANIFEST')) {
    throw new Error('input does not look like vd-cells-manifest.ts (VD_CELL_MANIFEST missing)');
  }
  const version = text.match(/\bversion:\s*(\d+)/);
  if (!version) throw new Error('manifest has no version field');
  const cells = {};
  for (const line of text.split('\n')) {
    const m = line.match(CELL_LINE);
    if (m) {
      const [, key, path, sha256, bytes, bundled] = m;
      if (cells[key]) throw new Error(`duplicate manifest key: ${key}`);
      cells[key] = { path, sha256, bytes: Number(bytes), bundled: bundled === 'true' };
    } else if (/'[^']+'\s*:\s*\{/.test(line)) {
      throw new Error(`unparseable manifest cell line: ${line.trim().slice(0, 120)}`);
    }
  }
  const keys = Object.keys(cells);
  if (keys.length === 0) throw new Error('manifest parsed to zero cells');
  return { version: Number(version[1]), cells };
}

const CELL_DIRS = (root) => ({
  structures: join(root, 'packages/app/features/game/world/vd-port/furniture/cells'),
  near: join(root, 'packages/app/features/game/world/vd-port/blocks/data/near'),
  lite: join(root, 'packages/app/features/game/world/vd-port/blocks/data/lite'),
  far: join(root, 'tooling/city/.cache/vd-lod16'),
});

/** Maps a manifest cell to its baked file on disk. Fails closed on an unknown tier or an escaping path. */
export function cellDiskPath(root, key, cellPath) {
  const slash = key.indexOf('/');
  const prefix = slash > 0 ? key.slice(0, slash) : '';
  const dir = CELL_DIRS(root)[prefix];
  if (!dir) throw new Error(`cell '${key}': unknown tier prefix '${prefix}'`);
  if (!cellPath.startsWith(`${prefix}/`)) {
    throw new Error(`cell '${key}': path '${cellPath}' is outside its tier`);
  }
  const rel = cellPath.slice(prefix.length + 1);
  if (!rel || rel.includes('/') || rel.includes('..') || !rel.endsWith('.bin')) {
    throw new Error(`cell '${key}': unsafe or unexpected file name '${rel}'`);
  }
  return join(dir, rel);
}

/** Canonical sha256 of the whole pin list (the release id's second half). */
export function manifestSha(cells) {
  const canonical = Object.keys(cells)
    .sort()
    .map((k) => `${k}\t${cells[k].path}\t${cells[k].sha256}\t${cells[k].bytes}\t${cells[k].bundled ? 1 : 0}`)
    .join('\n');
  return createHash('sha256').update(canonical).digest('hex');
}

/** Default release id: r<yyyymmdd UTC>-<manifest sha8>. */
export function defaultReleaseId(cells, now = new Date()) {
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `r${d}-${manifestSha(cells).slice(0, 8)}`;
}

// ---------- SigV4 ----------

const sha256hex = (buf) => createHash('sha256').update(buf).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

/** RFC 3986 URI encoding: unreserved chars (and '/' when keepSlash) pass through. */
export function uriEncode(str, keepSlash = true) {
  let out = '';
  for (const ch of String(str)) {
    if (/[A-Za-z0-9\-._~]/.test(ch) || (keepSlash && ch === '/')) out += ch;
    else out += [...Buffer.from(ch, 'utf8')].map((b) => '%' + b.toString(16).toUpperCase().padStart(2, '0')).join('');
  }
  return out;
}

const amzDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

/**
 * Signs one S3 request with SigV4 (service 's3', region 'auto' for R2). `headers` are extra headers to send;
 * host, x-amz-date and x-amz-content-sha256 are added; every header sent is signed. Returns the headers to send,
 * the Authorization header and the pieces a test pins down (canonicalRequest, stringToSign, signature).
 */
export function signRequest({
  method,
  host,
  canonicalUri,
  canonicalQuery = '',
  headers = {},
  payloadHash,
  region = 'auto',
  service = 's3',
  accessKeyId,
  secretAccessKey,
  date = new Date(),
  /** S3 wants x-amz-content-sha256 signed; other services (the AWS docs IAM vector) omit it. */
  includePayloadHeader = true,
}) {
  const stamp = amzDate(date);
  const dateStamp = stamp.slice(0, 8);
  const merged = {};
  for (const [k, v] of Object.entries(headers)) merged[k.toLowerCase()] = v;
  merged['host'] = host;
  if (includePayloadHeader) merged['x-amz-content-sha256'] = payloadHash;
  merged['x-amz-date'] = stamp;
  const names = Object.keys(merged).sort();
  const canonicalHeaders = names
    .map((k) => `${k}:${String(merged[k]).trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256hex(canonicalRequest)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const out = {};
  for (const k of names) out[k] = String(merged[k]).trim().replace(/\s+/g, ' ');
  out.authorization = authorization;
  return { headers: out, amzDate: stamp, canonicalRequest, stringToSign, signature, signedHeaders };
}

// ---------- R2 client ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt) => Math.min(10_000, 400 * 2 ** attempt) * (0.75 + Math.random() * 0.5);

/** One HTTP call with retry/backoff on 429, 5xx and network errors. Other statuses return to the caller. */
async function withRetry(fn, { attempts = 6, label = 'request' } = {}) {
  for (let a = 0; ; a++) {
    let res;
    try {
      res = await fn();
    } catch (err) {
      if (a >= attempts - 1) throw new Error(`${label}: network error after ${attempts} attempts (${err.message})`);
      await sleep(backoff(a));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (a >= attempts - 1) throw new Error(`${label}: HTTP ${res.status} after ${attempts} attempts`);
      await sleep(backoff(a));
      continue;
    }
    return res;
  }
}

/**
 * Minimal S3 client for R2, driven by an injected fetch. `endpoint` like
 * https://<account>.r2.cloudflarestorage.com (path-style: <endpoint>/<bucket>/<key>).
 */
export function r2Client({ endpoint, bucket, accessKeyId, secretAccessKey, fetchImpl = globalThis.fetch }) {
  const base = endpoint.replace(/\/+$/, '');
  const host = new URL(base).host;
  const request = async (method, key, { headers = {}, body = null, query = '' } = {}) => {
    const canonicalUri = `/${bucket}/${key.split('/').map((s) => uriEncode(s, false)).join('/')}`;
    const payloadHash = body ? sha256hex(body) : EMPTY_PAYLOAD_SHA;
    const signed = signRequest({
      method, host, canonicalUri, canonicalQuery: query, headers, payloadHash,
      accessKeyId, secretAccessKey,
    });
    const url = `${base}${canonicalUri}${query ? `?${query}` : ''}`;
    return withRetry(
      () => fetchImpl(url, { method, headers: signed.headers, body, signal: AbortSignal.timeout(120_000) }),
      { label: `${method} ${key}` },
    );
  };
  return {
    head: (key) => request('HEAD', key),
    get: (key) => request('GET', key),
    put: (key, body, headers) => request('PUT', key, { headers, body }),
    /** The object key a signed request would target; exported for tests. */
    objectUrl: (key) => `${base}/${bucket}/${key.split('/').map((s) => uriEncode(s, false)).join('/')}`,
  };
}

// ---------- plan (local, fail closed) ----------

/**
 * Reads every cell's baked file and re-checks it against the manifest pins. Any missing file or hash/size
 * mismatch throws — nothing is uploaded against a drifting manifest.
 */
export async function buildPlan(manifest, root, io) {
  const rows = [];
  for (const key of Object.keys(manifest.cells).sort()) {
    const pin = manifest.cells[key];
    const file = cellDiskPath(root, key, pin.path);
    const body = await io.readFile(file).catch(() => null);
    if (!body) throw new Error(`cell '${key}': baked file missing at ${file}`);
    const sha256 = sha256hex(body);
    if (body.byteLength !== pin.bytes || sha256 !== pin.sha256) {
      throw new Error(
        `cell '${key}': pin mismatch — manifest ${pin.sha256.slice(0, 12)}/${pin.bytes} vs disk ${sha256.slice(0, 12)}/${body.byteLength}`,
      );
    }
    rows.push({ key, path: pin.path, sha256, bytes: pin.bytes, bundled: pin.bundled === true, file });
  }
  return rows;
}

// ---------- state (resumable) ----------

async function loadState(io, stateFile, bucket, release) {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(await io.readFile(stateFile)));
    if (parsed && parsed.bucket === bucket && parsed.release === release && parsed.done && typeof parsed.done === 'object') {
      return parsed;
    }
  } catch { /* no state yet, or unreadable: start clean */ }
  return { bucket, release, done: {} };
}

async function saveState(io, stateFile, state) {
  await io.mkdir(dirname(stateFile), { recursive: true });
  await io.writeFile(stateFile, `${JSON.stringify(state)}\n`);
}

// ---------- concurrency pool ----------

async function pooled(items, concurrency, worker) {
  let next = 0;
  let failed = false;
  const lanes = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (!failed && next < items.length) {
      const item = items[next++];
      try {
        await worker(item);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  });
  await Promise.all(lanes);
}

// ---------- modes ----------

/**
 * Uploads every cell of the plan to releases/<release>/<path>, skipping objects already pinned
 * (state file) or unchanged on the remote (HEAD Content-Length + x-amz-meta-sha256), then writes
 * releases/<release>/manifest.json LAST and, unless activate === false, flips releases/current.
 */
export async function runPublish(o, io) {
  const client = r2Client({
    endpoint: o.endpoint, bucket: o.bucket,
    accessKeyId: o.accessKeyId, secretAccessKey: o.secretAccessKey,
    fetchImpl: io.fetch,
  });
  const state = o.stateFile ? await loadState(io, o.stateFile, o.bucket, o.release) : { bucket: o.bucket, release: o.release, done: {} };
  const counts = { resumed: 0, skipped: 0, uploaded: 0, failed: 0 };

  await pooled(o.plan, o.concurrency ?? 8, async (cell) => {
    if (state.done[cell.key]?.sha256 === cell.sha256) { counts.resumed++; return; }
    const key = `releases/${o.release}/${cell.path}`;
    const head = await client.head(key);
    if (head.status === 200) {
      const len = Number(head.headers.get('content-length') ?? -1);
      const remoteSha = head.headers.get('x-amz-meta-sha256');
      if (len === cell.bytes && remoteSha === cell.sha256) {
        counts.skipped++;
        state.done[cell.key] = { sha256: cell.sha256, at: io.now().toISOString() };
        return;
      }
      // A same-named object with different bytes must never stand: overwrite it (fail closed below on verify).
    } else if (head.status !== 404) {
      throw new Error(`HEAD ${key}: HTTP ${head.status}`);
    }
    const body = await io.readFile(cell.file);
    if (body.byteLength !== cell.bytes || sha256hex(body) !== cell.sha256) {
      throw new Error(`cell '${cell.key}': file changed between plan and upload`);
    }
    const res = await client.put(key, body, {
      'content-type': OCTET,
      'cache-control': IMMUTABLE_CC,
      'x-amz-meta-sha256': cell.sha256,
    });
    if (res.status !== 200) throw new Error(`PUT ${key}: HTTP ${res.status}`);
    counts.uploaded++;
    state.done[cell.key] = { sha256: cell.sha256, at: io.now().toISOString() };
    if (o.stateFile && counts.uploaded % 16 === 0) await saveState(io, o.stateFile, state);
  });
  if (o.stateFile) await saveState(io, o.stateFile, state);

  // manifest.json: the release's pin list + ODbL offer. Always the last release object written.
  const manifestDoc = {
    version: o.manifestVersion ?? 1,
    release: o.release,
    generated: io.now().toISOString(),
    attribution: ODBL,
    cells: Object.fromEntries(o.plan.map((c) => [c.key, { path: c.path, sha256: c.sha256, bytes: c.bytes, bundled: c.bundled }])),
  };
  const manifestBody = new TextEncoder().encode(JSON.stringify(manifestDoc, null, 1));
  const mres = await client.put(`releases/${o.release}/manifest.json`, manifestBody, {
    'content-type': 'application/json',
    'cache-control': IMMUTABLE_CC,
    'x-amz-meta-sha256': sha256hex(manifestBody),
  });
  if (mres.status !== 200) throw new Error(`PUT releases/${o.release}/manifest.json: HTTP ${mres.status}`);

  if (o.activate !== false) {
    await putPointer(client, o.release, io.now());
  }
  return { release: o.release, cells: o.plan.length, ...counts, activated: o.activate !== false };
}

async function putPointer(client, release, now) {
  const body = new TextEncoder().encode(JSON.stringify({ release, updatedAt: now.toISOString() }));
  const res = await client.put(POINTER_KEY, body, { 'content-type': 'application/json', 'cache-control': POINTER_CC });
  if (res.status !== 200) throw new Error(`PUT ${POINTER_KEY}: HTTP ${res.status}`);
}

/**
 * GETs every object of releases/<release>/ and re-hashes it against the pins; HEADs manifest.json.
 * Returns { ok, checked, failures } — fails are reported, never thrown past the summary.
 */
export async function runVerify(o, io) {
  const client = r2Client({
    endpoint: o.endpoint, bucket: o.bucket,
    accessKeyId: o.accessKeyId, secretAccessKey: o.secretAccessKey,
    fetchImpl: io.fetch,
  });
  const failures = [];
  let checked = 0;
  await pooled(o.plan, o.concurrency ?? 8, async (cell) => {
    const key = `releases/${o.release}/${cell.path}`;
    const res = await client.get(key);
    if (res.status !== 200) { failures.push(`${cell.key}: GET HTTP ${res.status}`); return; }
    const body = new Uint8Array(await res.arrayBuffer());
    const sha = sha256hex(body);
    if (body.byteLength !== cell.bytes || sha !== cell.sha256) {
      failures.push(`${cell.key}: remote ${sha.slice(0, 12)}/${body.byteLength} != pin ${cell.sha256.slice(0, 12)}/${cell.bytes}`);
      return;
    }
    checked++;
  });
  const mhead = await client.head(`releases/${o.release}/manifest.json`);
  if (mhead.status !== 200) failures.push(`releases/${o.release}/manifest.json: HEAD HTTP ${mhead.status}`);
  return { ok: failures.length === 0, checked, failures };
}

/** Flips releases/current to an existing release. HEADs the target's manifest.json first; writes only the pointer. */
export async function runRollback(o, io) {
  if (!/^r\d{8}-[0-9a-f]{8}$|^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(o.target)) {
    throw new Error(`refusing to point releases/current at malformed release id '${o.target}'`);
  }
  const client = r2Client({
    endpoint: o.endpoint, bucket: o.bucket,
    accessKeyId: o.accessKeyId, secretAccessKey: o.secretAccessKey,
    fetchImpl: io.fetch,
  });
  const head = await client.head(`releases/${o.target}/manifest.json`);
  if (head.status !== 200) {
    throw new Error(`release '${o.target}' has no manifest.json (HEAD HTTP ${head.status}) — refusing to flip current`);
  }
  await putPointer(client, o.target, io.now());
  return { release: o.target };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const flag = (n) => argv.includes(`--${n}`);
  return {
    release: arg('release', undefined),
    concurrency: Number(arg('concurrency', '8')),
    dryRun: flag('dry-run'),
    verify: flag('verify'),
    rollback: arg('rollback', undefined),
    noActivate: flag('no-activate'),
    manifest: arg('manifest', MANIFEST_TS),
  };
}

function requireEnv(env, names) {
  const missing = names.filter((n) => !env[n]);
  if (missing.length) throw new Error(`missing env: ${missing.join(', ')}`);
  return Object.fromEntries(names.map((n) => [n, env[n]]));
}

const realIo = () => ({
  fetch: globalThis.fetch,
  readFile: (p) => readFile(p),
  writeFile: (p, d) => writeFile(p, d),
  mkdir: (p, opts) => mkdir(p, opts),
  now: () => new Date(),
  log: (s) => console.log(s),
});

export async function main(argv = process.argv.slice(2), env = process.env, io = realIo()) {
  const args = parseArgs(argv);
  if (argv.includes('--rollback') && !args.rollback) throw new Error('--rollback needs a release id');
  const creds = () => {
    const c = requireEnv(env, ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']);
    return {
      endpoint: env.R2_ENDPOINT ?? `https://${c.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      bucket: c.R2_BUCKET_NAME,
      accessKeyId: c.R2_ACCESS_KEY_ID,
      secretAccessKey: c.R2_SECRET_ACCESS_KEY,
    };
  };

  if (args.rollback) {
    const { release } = await runRollback({ ...creds(), target: args.rollback }, io);
    io.log(`releases/current -> ${release}`);
    return;
  }

  const manifest = parseCellsManifest(new TextDecoder().decode(await io.readFile(args.manifest)));
  const release = args.release ?? env.VD_RELEASE_ID ?? defaultReleaseId(manifest.cells, io.now());
  const plan = await buildPlan(manifest, ROOT, io);
  const total = plan.reduce((a, c) => a + c.bytes, 0);
  io.log(`release ${release}: ${plan.length} cells, ${(total / 1e6).toFixed(1)} MB, all pins verified locally`);

  if (args.dryRun) {
    for (const c of plan) io.log(`  PUT releases/${release}/${c.path}  ${c.bytes} B`);
    io.log('dry run: nothing uploaded');
    return;
  }

  const ctx = creds();
  if (args.verify) {
    const v = await runVerify({ ...ctx, release, plan, concurrency: args.concurrency }, io);
    io.log(`verify ${release}: ${v.checked}/${plan.length} objects match pins`);
    for (const f of v.failures) io.log(`  FAIL ${f}`);
    if (!v.ok) throw new Error(`remote verify failed for ${v.failures.length} object(s)`);
    return;
  }

  const r = await runPublish(
    { ...ctx, release, plan, concurrency: args.concurrency, stateFile: STATE_FILE, activate: !args.noActivate, manifestVersion: manifest.version },
    io,
  );
  io.log(`published ${r.release}: ${r.uploaded} uploaded, ${r.skipped} unchanged, ${r.resumed} resumed, manifest.json last${r.activated ? ', releases/current flipped' : ' (no-activate)'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`r2-publish: ${err.message}`);
    process.exitCode = 1;
  });
}
