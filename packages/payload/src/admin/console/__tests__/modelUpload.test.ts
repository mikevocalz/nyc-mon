import type { PayloadRequest } from 'payload';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MON_MODEL_CHUNK_BYTES, chunkCount, chunkLength } from '../../../collections/monModelFile.ts';
import { assembleChunks, chunkKey, chunkProblem, issueUploadToken, readUploadToken, STAGED_UPLOAD_TTL_MS } from '../../../storage/stagedUpload.ts';
import { needsChunkedUpload, uploadModelInChunks, type ChunkTransport } from '../views/modelUpload.ts';

const SECRET = 'test-secret';
const MB = 1024 * 1024;

describe('chunk plan', () => {
  it('keeps every chunk under the 4.5 MB function body limit', () => {
    expect(MON_MODEL_CHUNK_BYTES).toBeLessThan(4.5 * 1000 * 1000);
    expect(chunkCount(4_998_988)).toBe(2);
    expect(chunkCount(23_733_332)).toBe(6);
    expect(chunkLength(4_998_988, 0)).toBe(MON_MODEL_CHUNK_BYTES);
    expect(chunkLength(4_998_988, 1)).toBe(4_998_988 - MON_MODEL_CHUNK_BYTES);
  });

  it('sends files up to one chunk the old way', () => {
    expect(needsChunkedUpload(MON_MODEL_CHUNK_BYTES)).toBe(false);
    expect(needsChunkedUpload(MON_MODEL_CHUNK_BYTES + 1)).toBe(true);
  });
});

describe('upload token', () => {
  const now = 1_000_000;

  it('round-trips for the user who started it', () => {
    const { token, upload } = issueUploadToken({ user: 7, size: 5 * MB, now, secret: SECRET });
    expect(readUploadToken(token, { user: 7, now, secret: SECRET })).toEqual(upload);
    expect(upload.nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('refuses another user, an expired token, a wrong secret and a tampered size', () => {
    const { token } = issueUploadToken({ user: 7, size: 5 * MB, now, secret: SECRET });
    expect(readUploadToken(token, { user: 8, now, secret: SECRET })).toBeNull();
    expect(readUploadToken(token, { user: 7, now: now + STAGED_UPLOAD_TTL_MS, secret: SECRET })).toBeNull();
    expect(readUploadToken(token, { user: 7, now, secret: 'other' })).toBeNull();
    const [body, signature] = token.split('.');
    const forged = Buffer.from(Buffer.from(body!, 'base64url').toString().replace(`"size":${5 * MB}`, '"size":1')).toString('base64url');
    expect(readUploadToken(`${forged}.${signature}`, { user: 7, now, secret: SECRET })).toBeNull();
    expect(readUploadToken('nonsense', { user: 7, now, secret: SECRET })).toBeNull();
    expect(readUploadToken(undefined, { user: 7, now, secret: SECRET })).toBeNull();
  });
});

describe('chunks', () => {
  const { upload } = issueUploadToken({ user: 7, size: MON_MODEL_CHUNK_BYTES + 10, now: 0, secret: SECRET });

  it('accepts only an index in range with its exact length', () => {
    expect(chunkProblem(upload, 0, MON_MODEL_CHUNK_BYTES)).toBeNull();
    expect(chunkProblem(upload, 1, 10)).toBeNull();
    expect(chunkProblem(upload, 1, 9)).toBe('length');
    expect(chunkProblem(upload, 2, 10)).toBe('index');
    expect(chunkProblem(upload, -1, 10)).toBe('index');
    expect(chunkProblem(upload, Number.NaN, 10)).toBe('index');
  });

  it('joins the parts in order and refuses a short part', async () => {
    const parts = new Map([
      [chunkKey(upload, 0), new Uint8Array(MON_MODEL_CHUNK_BYTES).fill(1)],
      [chunkKey(upload, 1), new Uint8Array(10).fill(2)],
    ]);
    const joined = await assembleChunks(upload, async (key) => parts.get(key)!);
    expect(joined.byteLength).toBe(upload.size);
    expect(joined[MON_MODEL_CHUNK_BYTES - 1]).toBe(1);
    expect(joined[MON_MODEL_CHUNK_BYTES]).toBe(2);
    parts.set(chunkKey(upload, 1), new Uint8Array(3));
    await expect(assembleChunks(upload, async (key) => parts.get(key)!)).rejects.toThrow(/Chunk 1/);
  });
});

describe('uploadModelInChunks', () => {
  const file = new Blob([new Uint8Array(MON_MODEL_CHUNK_BYTES * 2 + 5)]);

  function transport(fail?: { chunk?: number; complete?: string }) {
    const calls: string[] = [];
    const t: ChunkTransport = {
      json: vi.fn(async (url: string, method: 'POST' | 'DELETE', body?: unknown) => {
        calls.push(`${method} ${url} ${JSON.stringify(body ?? null)}`);
        if (url.endsWith('/uploads')) return { ok: true as const, data: { token: 'tok', chunkBytes: MON_MODEL_CHUNK_BYTES, chunks: 3 } as never };
        if (url.endsWith('/complete') && fail?.complete) return { ok: false as const, message: fail.complete };
        return { ok: true as const, data: { id: 'm1' } as never };
      }),
      chunk: vi.fn(async (url: string, body: Blob, onSent: (bytes: number) => void) => {
        calls.push(`PUT ${url} ${body.size}`);
        onSent(body.size);
        return url.endsWith(`/${fail?.chunk}`) ? { ok: false as const, message: 'network' } : { ok: true as const, data: null };
      }),
    };
    return { t, calls };
  }

  it('sends each chunk in order, then commits to the target', async () => {
    const { t, calls } = transport();
    const progress: number[] = [];
    expect(await uploadModelInChunks(file, 'lil-ratti.glb', { speciesId: 'dex-003' }, t, (p) => progress.push(p))).toBeNull();
    expect(calls).toEqual([
      `POST /payload-api/console/models/uploads {"name":"lil-ratti.glb","size":${file.size}}`,
      `PUT /payload-api/console/models/uploads/tok/0 ${MON_MODEL_CHUNK_BYTES}`,
      `PUT /payload-api/console/models/uploads/tok/1 ${MON_MODEL_CHUNK_BYTES}`,
      'PUT /payload-api/console/models/uploads/tok/2 5',
      'POST /payload-api/console/models/uploads/tok/complete {"speciesId":"dex-003"}',
    ]);
    expect(progress.at(-1)).toBe(100);
    expect(progress.every((p, i) => i === 0 || p >= progress[i - 1]!)).toBe(true);
  });

  it('drops the staged parts and reports the message when a chunk fails', async () => {
    const { t, calls } = transport({ chunk: 1 });
    expect(await uploadModelInChunks(file, 'x.glb', { id: 'm1' }, t, () => {})).toBe('network');
    expect(calls.at(-1)).toBe('DELETE /payload-api/console/models/uploads/tok null');
    expect(calls.some((call) => call.includes('/complete'))).toBe(false);
  });

  it('reports the server message when the commit is refused', async () => {
    const { t } = transport({ complete: 'This GLB is cut short or padded. Export it again.' });
    expect(await uploadModelInChunks(file, 'x.glb', { id: 'm1' }, t, () => {})).toMatch(/cut short/);
  });
});

describe('staged upload endpoints', () => {
  const env = { ...process.env };
  let stored: Map<string, Uint8Array>;
  let models: typeof import('../endpoints/models.ts');

  beforeEach(async () => {
    process.env.BUNNY_STORAGE_ZONE = 'zone';
    process.env.BUNNY_STORAGE_PASSWORD = 'key';
    process.env.BUNNY_CDN_URL = 'https://cdn.example';
    stored = new Map();
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const key = new URL(url).pathname.replace(/^\/zone\//, '');
      if (init?.method === 'PUT') { stored.set(key, new Uint8Array(init.body as Uint8Array)); return new Response('', { status: 201 }); }
      if (init?.method === 'DELETE') { for (const k of [...stored.keys()]) if (k.startsWith(key)) stored.delete(k); return new Response('', { status: 200 }); }
      const body = stored.get(key);
      return body ? new Response(new Uint8Array(body)) : new Response('', { status: 404 });
    }));
    vi.resetModules();
    models = await import('../endpoints/models.ts');
  });

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  /** A GLB of `size` bytes: valid 12-byte header, zero padding after. */
  const glbOf = (size: number) => {
    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, size, true);
    return bytes;
  };

  function request(options: { role?: string; data?: unknown; body?: Uint8Array; params?: Record<string, string> }) {
    const create = vi.fn(async (args: Record<string, unknown>) => ({ id: 'new', args }));
    const update = vi.fn(async (args: Record<string, unknown>) => ({ id: args.id, args }));
    const body = options.body;
    const req = {
      user: options.role ? { id: 7, role: options.role, collection: 'users' } : null,
      method: body ? 'PUT' : 'POST',
      data: options.data,
      routeParams: options.params ?? {},
      headers: new Headers(body ? { 'content-length': String(body.byteLength) } : {}),
      arrayBuffer: async () => body!.buffer.slice(body!.byteOffset, body!.byteOffset + body!.byteLength),
      payload: { secret: SECRET, create, update, logger: { warn: vi.fn() } },
    };
    return { req: req as unknown as PayloadRequest, create, update };
  }

  it('refuses roles that cannot edit models', async () => {
    await expect(models.startModelUpload(request({ role: 'support', data: { name: 'a.glb', size: 5 * MB } }).req)).rejects.toMatchObject({ status: 403 });
    await expect(models.startModelUpload(request({ data: { name: 'a.glb', size: 5 * MB } }).req)).rejects.toMatchObject({ status: 403 });
  });

  it('applies the 25 MB and .glb rules before anything is stored', async () => {
    await expect(models.startModelUpload(request({ role: 'content', data: { name: 'a.fbx', size: 5 * MB } }).req)).rejects.toThrow(/Only .glb/);
    await expect(models.startModelUpload(request({ role: 'content', data: { name: 'a.glb', size: 26 * MB } }).req)).rejects.toThrow(/over 25 MB/);
  });

  it('stages each chunk, joins them and saves through the Local API with access enforced', async () => {
    const size = MON_MODEL_CHUNK_BYTES + 100;
    const file = glbOf(size);
    const started = await (await models.startModelUpload(request({ role: 'content', data: { name: 'corner.glb', size } }).req)).json() as { token: string; chunks: number };
    expect(started.chunks).toBe(2);
    for (let index = 0; index < 2; index++) {
      const body = file.subarray(index * MON_MODEL_CHUNK_BYTES, (index + 1) * MON_MODEL_CHUNK_BYTES);
      const res = await models.putModelChunk(request({ role: 'content', body, params: { token: started.token, index: String(index) } }).req);
      expect(res.status).toBe(200);
    }
    expect([...stored.keys()].every((key) => key.startsWith('_staging/mon-models/'))).toBe(true);

    const { req, create } = request({ role: 'content', data: { speciesId: 'dex-008' }, params: { token: started.token } });
    const res = await models.completeModelUpload(req);
    expect(res.status).toBe(201);
    const args = create.mock.calls[0]![0] as { file: { data: Buffer; size: number; mimetype: string }; overrideAccess: boolean; user: unknown; data: unknown };
    expect(args.overrideAccess).toBe(false);
    expect(args.user).toMatchObject({ id: 7 });
    expect(args.data).toEqual({ speciesId: 'dex-008' });
    expect(args.file.size).toBe(size);
    expect(args.file.mimetype).toBe('model/gltf-binary');
    expect(Buffer.compare(args.file.data, Buffer.from(file))).toBe(0);
    // The staged parts are gone once the model is saved.
    expect(stored.size).toBe(0);
  });

  it('refuses a first chunk that is not a GLB, and a token from another user', async () => {
    const size = MON_MODEL_CHUNK_BYTES + 100;
    const started = await (await models.startModelUpload(request({ role: 'ops', data: { name: 'a.glb', size } }).req)).json() as { token: string };
    const notGlb = new Uint8Array(MON_MODEL_CHUNK_BYTES);
    await expect(models.putModelChunk(request({ role: 'ops', body: notGlb, params: { token: started.token, index: '0' } }).req)).rejects.toThrow(/not a GLB/);
    const other = request({ role: 'ops', body: glbOf(size).subarray(0, MON_MODEL_CHUNK_BYTES), params: { token: started.token, index: '0' } });
    (other.req.user as { id: number }).id = 8;
    await expect(models.putModelChunk(other.req)).rejects.toMatchObject({ status: 404 });
    expect(stored.size).toBe(0);
  });

  it('fails the commit when a part never arrived, and still cleans up', async () => {
    const size = MON_MODEL_CHUNK_BYTES + 100;
    const started = await (await models.startModelUpload(request({ role: 'ops', data: { name: 'a.glb', size } }).req)).json() as { token: string };
    await models.putModelChunk(request({ role: 'ops', body: glbOf(size).subarray(0, MON_MODEL_CHUNK_BYTES), params: { token: started.token, index: '0' } }).req);
    const { req, update } = request({ role: 'ops', data: { id: 'm1' }, params: { token: started.token } });
    await expect(models.completeModelUpload(req)).rejects.toThrow(/never arrived/);
    expect(update).not.toHaveBeenCalled();
    expect(stored.size).toBe(0);
  });
});
