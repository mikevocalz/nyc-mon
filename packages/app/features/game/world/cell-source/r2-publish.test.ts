// tooling/city/r2-publish.mjs against a fake R2 (fake fetch + fake fs): SigV4 signing, dry-run, HEAD skip,
// verify failure, rollback pointer, manifest-last ordering.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseCellsManifest,
  cellDiskPath,
  manifestSha,
  defaultReleaseId,
  uriEncode,
  signRequest,
  buildPlan,
  runPublish,
  runVerify,
  runRollback,
  type R2Io,
} from '../../../../../../tooling/city/r2-publish.mjs';

const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

// ---------------------------------------------------------------- fixtures

interface FakeObject {
  body: Uint8Array;
  headers: Record<string, string>;
}
interface Captured {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Uint8Array | null;
}

/** A fake R2 bucket: keyed by object path after the /<bucket>/ prefix; records every request. */
function fakeR2(seed: Record<string, FakeObject> = {}) {
  const objects = new Map<string, FakeObject>(Object.entries(seed));
  const calls: Captured[] = [];
  const headersOf = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });
  const fetchImpl = async (url: string, init: { method: string; headers: Record<string, string>; body: Uint8Array | null }) => {
    calls.push({ method: init.method, url, headers: init.headers, body: init.body ?? null });
    const path = new URL(url).pathname;
    const key = path.replace(/^\/[^/]+\//, ''); // strip /<bucket>/
    if (init.method === 'PUT') {
      const body = init.body ?? new Uint8Array(0);
      objects.set(key, {
        body,
        headers: {
          'content-length': String(body.byteLength),
          'content-type': init.headers['content-type'] ?? '',
          'cache-control': init.headers['cache-control'] ?? '',
          'x-amz-meta-sha256': init.headers['x-amz-meta-sha256'] ?? '',
        },
      });
      return { status: 200, headers: headersOf({}), arrayBuffer: async () => new ArrayBuffer(0) };
    }
    const obj = objects.get(key);
    if (!obj) return { status: 404, headers: headersOf({}), arrayBuffer: async () => new ArrayBuffer(0) };
    if (init.method === 'HEAD') return { status: 200, headers: headersOf(obj.headers), arrayBuffer: async () => new ArrayBuffer(0) };
    return { status: 200, headers: headersOf(obj.headers), arrayBuffer: async () => obj.body.slice().buffer as ArrayBuffer };
  };
  return { objects, calls, fetchImpl };
}

function fakeIo(r2: ReturnType<typeof fakeR2>, files: Map<string, Uint8Array>) {
  const writes = new Map<string, string>();
  const io: R2Io = {
    fetch: r2.fetchImpl,
    readFile: async (p: string) => {
      const b = files.get(p);
      if (!b) throw new Error(`ENOENT ${p}`);
      return b;
    },
    writeFile: async (p: string, d: Uint8Array | string) => { writes.set(p, typeof d === 'string' ? d : new TextDecoder().decode(d)); },
    mkdir: async () => {},
    now: () => new Date('2026-10-30T12:36:00Z'),
    log: () => {},
  };
  return { io, writes };
}

/** Synthetic cells on disk + the manifest rows a real run would parse. */
function fixtureCells() {
  const bodies: Record<string, Uint8Array> = {
    'structures/1_2': new Uint8Array([1, 2, 3]),
    'near/0_0': new Uint8Array([4, 5, 6, 7]),
    'lite/0_0': new Uint8Array([8]),
    'far/L4_0_0.bin': new Uint8Array([9, 10]),
    'far/landmarks_l6.bin': new Uint8Array([11, 12, 13, 14]),
  };
  const cells = Object.fromEntries(
    Object.entries(bodies).map(([key, body]) => [
      key,
      { path: key.endsWith('.bin') ? key : `${key}.bin`, sha256: sha(body), bytes: body.byteLength, bundled: key !== 'far/landmarks_l6.bin' },
    ]),
  );
  return { manifest: { version: 1, cells }, bodies };
}

const ROOT = '/repo';
const CTX = {
  endpoint: 'https://acct.r2.cloudflarestorage.com',
  bucket: 'bkt',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
};

async function planOf(manifest: ReturnType<typeof fixtureCells>['manifest'], io: Pick<R2Io, 'readFile'>) {
  return buildPlan(manifest, ROOT, io);
}

// ---------------------------------------------------------------- SigV4

describe('r2-publish SigV4', () => {
  it('reproduces the AWS documentation canonical-request signature (iam ListUsers vector)', () => {
    // AWS docs "Examples of the complete version 4 signing process": GET iam.amazonaws.com, 20150830T123600Z.
    const s = signRequest({
      method: 'GET',
      host: 'iam.amazonaws.com',
      canonicalUri: '/',
      canonicalQuery: 'Action=ListUsers&Version=2010-05-08',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
      payloadHash: EMPTY_SHA,
      region: 'us-east-1',
      service: 'iam',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      date: new Date('2015-08-30T12:36:00Z'),
      includePayloadHeader: false,
    });
    assert.equal(
      s.canonicalRequest,
      'GET\n/\nAction=ListUsers&Version=2010-05-08\n' +
        'content-type:application/x-www-form-urlencoded; charset=utf-8\n' +
        'host:iam.amazonaws.com\n' +
        'x-amz-date:20150830T123600Z\n\n' +
        'content-type;host;x-amz-date\n' +
        EMPTY_SHA,
    );
    assert.equal(s.signature, '5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7');
  });

  it('signs an R2 cell PUT identically to the AWS SDK signer (fixed vector)', () => {
    // Cross-checked against @smithy/signature-v4 signing the identical request: same canonical request,
    // same signed-header set (host + cache-control + x-amz-meta-sha256 all signed).
    const payloadHash = sha('hello world');
    const s = signRequest({
      method: 'PUT',
      host: 'f1c2d65992e84470279f61126eba1fb8.r2.cloudflarestorage.com',
      canonicalUri: '/nyc-mon-valdrada-staging/releases/r20261030-deadbeef/near/-1_-1.bin',
      headers: {
        'content-type': 'application/octet-stream',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-amz-meta-sha256': payloadHash,
      },
      payloadHash,
      region: 'auto',
      service: 's3',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      date: new Date('2026-10-30T12:36:00Z'),
    });
    assert.equal(s.signedHeaders, 'cache-control;content-type;host;x-amz-content-sha256;x-amz-date;x-amz-meta-sha256');
    assert.equal(s.signature, '7217cf18a6951cf02fe83293adc616bb792f94af7627141cb48263aa87c065c5');
  });

  it('URI-encodes object keys (spaces, non-ascii), keeps the slash split', () => {
    assert.equal(uriEncode('releases/r1/far/L4_0_0.bin'), 'releases/r1/far/L4_0_0.bin');
    assert.equal(uriEncode('a b/c'), 'a%20b/c');
    assert.equal(uriEncode('é'), '%C3%A9');
    assert.equal(uriEncode('a/b', false), 'a%2Fb');
  });
});

// ---------------------------------------------------------------- manifest + plan

describe('r2-publish manifest', () => {
  it('parses the real generated manifest (458 pinned cells)', () => {
    const text = readFileSync(new URL('./data/vd-cells-manifest.ts', import.meta.url), 'utf8');
    const m = parseCellsManifest(text);
    assert.equal(Object.keys(m.cells).length, 458);
    assert.ok(m.cells['far/landmarks_l6.bin']);
    for (const [k, c] of Object.entries(m.cells)) {
      assert.match(c.sha256, /^[0-9a-f]{64}$/);
      assert.ok(c.bytes > 0, k);
      assert.ok(c.path.startsWith(k.split('/')[0] + '/'));
    }
  });

  it('fails closed on a malformed cell line', () => {
    const bad = `export const VD_CELL_MANIFEST = { version: 1, cells: {
    'near/0_0': { path: 'near/0_0.bin', sha256: 'nope', bytes: 3, bundled: true },
} };`;
    assert.throws(() => parseCellsManifest(bad), /unparseable|sha256/);
  });

  it('maps every tier to its baked directory and refuses escaping paths', () => {
    assert.equal(cellDiskPath(ROOT, 'structures/1_2', 'structures/1_2.bin'), `${ROOT}/packages/app/features/game/world/vd-port/furniture/cells/1_2.bin`);
    assert.equal(cellDiskPath(ROOT, 'near/0_0', 'near/0_0.bin'), `${ROOT}/packages/app/features/game/world/vd-port/blocks/data/near/0_0.bin`);
    assert.equal(cellDiskPath(ROOT, 'lite/0_0', 'lite/0_0.bin'), `${ROOT}/packages/app/features/game/world/vd-port/blocks/data/lite/0_0.bin`);
    assert.equal(cellDiskPath(ROOT, 'far/L4_0_0.bin', 'far/L4_0_0.bin'), `${ROOT}/tooling/city/.cache/vd-lod16/L4_0_0.bin`);
    assert.throws(() => cellDiskPath(ROOT, 'bogus/x', 'bogus/x.bin'), /unknown tier/);
    assert.throws(() => cellDiskPath(ROOT, 'near/0_0', 'near/../evil.bin'), /outside|unsafe/);
  });

  it('derives a stable release id from the pin list', () => {
    const { manifest } = fixtureCells();
    const a = defaultReleaseId(manifest.cells, new Date('2026-10-30T00:00:00Z'));
    assert.match(a, /^r20261030-[0-9a-f]{8}$/);
    assert.equal(a.slice(-8), manifestSha(manifest.cells).slice(0, 8));
  });
});

// ---------------------------------------------------------------- publish

function filesFrom(bodies: Record<string, Uint8Array>, manifest: ReturnType<typeof fixtureCells>['manifest']) {
  const files = new Map<string, Uint8Array>();
  for (const [key, body] of Object.entries(bodies)) {
    files.set(cellDiskPath(ROOT, key, manifest.cells[key]!.path), body);
  }
  return files;
}

describe('r2-publish modes', () => {
  it('skip-unchanged: HEAD metadata match means no PUT', async () => {
    const { manifest, bodies } = fixtureCells();
    const release = 'r20261030-deadbeef';
    const seed: Record<string, FakeObject> = {};
    for (const [key, body] of Object.entries(bodies)) {
      const path = manifest.cells[key]!.path;
      seed[`releases/${release}/${path}`] = {
        body,
        headers: { 'content-length': String(body.byteLength), 'x-amz-meta-sha256': sha(body) },
      };
    }
    const r2 = fakeR2(seed);
    const { io } = fakeIo(r2, filesFrom(bodies, manifest));
    const plan = await planOf(manifest, io);
    const res = await runPublish({ ...CTX, release, plan, concurrency: 4 }, io);
    const puts = r2.calls.filter((c) => c.method === 'PUT');
    assert.equal(res.skipped, plan.length);
    assert.equal(res.uploaded, 0);
    // only manifest.json + the releases/current pointer are PUT; no cell body moves
    assert.deepEqual(
      puts.map((c) => new URL(c.url).pathname.replace(/^\/bkt\//, '')).sort(),
      [`releases/${release}/manifest.json`, 'releases/current'].sort(),
    );
  });

  it('verify-mismatch-fails: a tampered remote object fails the verify pass', async () => {
    const { manifest, bodies } = fixtureCells();
    const release = 'r20261030-deadbeef';
    const seed: Record<string, FakeObject> = {};
    for (const [key, body] of Object.entries(bodies)) {
      seed[`releases/${release}/${manifest.cells[key]!.path}`] = { body, headers: { 'content-length': String(body.byteLength) } };
    }
    seed[`releases/${release}/manifest.json`] = { body: new Uint8Array([123]), headers: {} };
    // corrupt one cell
    seed[`releases/${release}/near/0_0.bin`] = { body: new Uint8Array([0, 0, 0]), headers: { 'content-length': '3' } };
    const r2 = fakeR2(seed);
    const { io } = fakeIo(r2, filesFrom(bodies, manifest));
    const plan = await planOf(manifest, io);
    const v = await runVerify({ ...CTX, release, plan, concurrency: 4 }, io);
    assert.equal(v.ok, false);
    assert.equal(v.checked, plan.length - 1);
    assert.ok(v.failures.some((f) => f.startsWith('near/0_0')));
  });

  it('rollback writes only the releases/current pointer and refuses a missing release', async () => {
    const r2 = fakeR2({ 'releases/r20261029-aaaabbbb/manifest.json': { body: new Uint8Array([123]), headers: {} } });
    const { io } = fakeIo(r2, new Map());
    const res = await runRollback({ ...CTX, target: 'r20261029-aaaabbbb' }, io);
    assert.equal(res.release, 'r20261029-aaaabbbb');
    const puts = r2.calls.filter((c) => c.method === 'PUT');
    assert.equal(puts.length, 1);
    assert.ok(puts[0]!.url.endsWith('/bkt/releases/current'));
    assert.match(new TextDecoder().decode(puts[0]!.body!), /"release":"r20261029-aaaabbbb"/);
    // missing target release: no pointer write
    await assert.rejects(() => runRollback({ ...CTX, target: 'r20000101-ffffffff' }, io), /no manifest\.json|refusing/);
    assert.equal(r2.calls.filter((c) => c.method === 'PUT').length, 1);
  });

  it('uploads every cell, writes manifest.json last, then flips the current pointer', async () => {
    const { manifest, bodies } = fixtureCells();
    const release = 'r20261030-deadbeef';
    const r2 = fakeR2();
    const { io } = fakeIo(r2, filesFrom(bodies, manifest));
    const plan = await planOf(manifest, io);
    const res = await runPublish({ ...CTX, release, plan, concurrency: 2 }, io);
    assert.equal(res.uploaded, plan.length);

    const puts = r2.calls.filter((c) => c.method === 'PUT');
    const keys = puts.map((c) => new URL(c.url).pathname.replace(/^\/bkt\//, ''));
    const manifestIx = keys.indexOf(`releases/${release}/manifest.json`);
    const pointerIx = keys.indexOf('releases/current');
    assert.ok(manifestIx > 0 && pointerIx === keys.length - 1);
    // every release object lands before manifest.json; the pointer is the last write overall
    for (const c of plan) assert.ok(keys.indexOf(`releases/${release}/${c.path}`) < manifestIx, c.key);

    // each PUT carries the immutable cache header + sha pin in metadata
    for (const c of puts) {
      if (c.url.includes('releases/current')) continue;
      assert.equal(c.headers['cache-control'], 'public, max-age=31536000, immutable');
      if (!c.url.endsWith('manifest.json')) assert.equal(c.headers['x-amz-meta-sha256'], sha(c.body!));
      assert.ok(c.headers.authorization?.startsWith('AWS4-HMAC-SHA256 Credential='));
    }
    // the manifest.json body is the full pin list + the ODbL block
    const mbody = JSON.parse(new TextDecoder().decode(puts[manifestIx]!.body!));
    assert.equal(mbody.release, release);
    assert.equal(Object.keys(mbody.cells).length, plan.length);
    assert.equal(mbody.attribution.license, 'ODbL 1.0');
  });

  it('a stale remote object (wrong sha) is overwritten, not skipped', async () => {
    const { manifest, bodies } = fixtureCells();
    const release = 'r20261030-deadbeef';
    const stale = new Uint8Array([99]);
    const r2 = fakeR2({
      'releases/r20261030-deadbeef/near/0_0.bin': {
        body: stale,
        headers: { 'content-length': String(stale.byteLength), 'x-amz-meta-sha256': sha(stale) },
      },
    });
    const { io } = fakeIo(r2, filesFrom(bodies, manifest));
    const plan = await planOf(manifest, io);
    const res = await runPublish({ ...CTX, release, plan, concurrency: 4 }, io);
    assert.equal(res.skipped, 0);
    assert.equal(res.uploaded, plan.length);
    const stored = r2.objects.get(`releases/${release}/near/0_0.bin`)!;
    assert.deepEqual([...stored.body], [...bodies['near/0_0']!]);
  });
});

// ---------------------------------------------------------------- dry run

describe('r2-publish dry run / plan', () => {
  it('buildPlan re-hashes every file and fails closed on drift', async () => {
    const { manifest, bodies } = fixtureCells();
    const files = filesFrom(bodies, manifest);
    const { io } = fakeIo(fakeR2(), files);
    const plan = await planOf(manifest, io);
    assert.equal(plan.length, 5);
    assert.equal(plan.find((c) => c.key === 'far/L4_0_0.bin')!.file, `${ROOT}/tooling/city/.cache/vd-lod16/L4_0_0.bin`);

    files.set(`${ROOT}/packages/app/features/game/world/vd-port/blocks/data/near/0_0.bin`, new Uint8Array([0]));
    await assert.rejects(() => buildPlan(manifest, ROOT, io), /pin mismatch/);
  });

  it('resume state skips already-uploaded cells without touching the network', async () => {
    const { manifest, bodies } = fixtureCells();
    const release = 'r20261030-deadbeef';
    const r2 = fakeR2();
    const { io, writes } = fakeIo(r2, filesFrom(bodies, manifest));
    const plan = await planOf(manifest, io);
    const stateFile = 'state.json';
    await runPublish({ ...CTX, release, plan, concurrency: 4, stateFile }, io);
    const state = JSON.parse(writes.get(stateFile)!);
    assert.equal(state.release, release);
    assert.equal(Object.keys(state.done).length, plan.length);

    const r2b = fakeR2();
    const files2 = filesFrom(bodies, manifest);
    files2.set(stateFile, new TextEncoder().encode(writes.get(stateFile)!));
    const { io: io2 } = fakeIo(r2b, files2);
    const plan2 = await planOf(manifest, io2);
    // second publish with the state file pre-seeded: nothing uploads or HEADs
    const res2 = await runPublish({ ...CTX, release, plan: plan2, concurrency: 4, stateFile }, io2);
    assert.equal(res2.resumed, plan.length);
    assert.equal(r2b.calls.filter((c) => c.method === 'HEAD').length, 0);
  });
});
