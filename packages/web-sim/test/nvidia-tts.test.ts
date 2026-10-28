import { describe, expect, it, vi } from 'vitest';
import { loadNvidiaEnv, nvidiaPublicConfig } from '../server/nvidia-env.ts';
import { bundledFfmpeg, createNvidiaTts, nvidiaCsp, nvidiaPitchShift } from '../server/nvidia-tts.ts';
import { findFfmpeg } from '../server/tts.ts';
import type { TtsFetch } from '../server/tts.ts';

const base = { NEBIUS_API_KEY: 'k', V1_MCP_SERVICE_KEY: 'v'.repeat(32) };
const ORIGIN = 'http://localhost:5180';
const LINEAGE = 'dex-001/female/1';

const post = (origin: string | null, authorization: string | null = 'Bearer t') =>
  new Request(`${ORIGIN}/api/tts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(origin === null ? {} : { origin }),
      ...(authorization === null ? {} : { authorization }),
    },
    body: JSON.stringify({ text: 'Hi there.', lineageId: LINEAGE, stage: 'Baby' }),
  });

const audio = () => vi.fn<TtsFetch>(async () => new Response(new Uint8Array([0xff, 0xfb, 0x90]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }));
const signedIn = (callerId = '12') => vi.fn(async () => ({ callerId }));

describe('NVIDIA env: the Mon voice settings', () => {
  it('leaves ElevenLabs and ffmpeg optional, and treats empty as unset', () => {
    const env = loadNvidiaEnv(base);
    expect(env.ELEVENLABS_API_KEY).toBeUndefined();
    expect(env.FFMPEG_PATH).toBeUndefined();
    const empty = loadNvidiaEnv({ ...base, ELEVENLABS_API_KEY: '', FFMPEG_PATH: '' });
    expect(empty.ELEVENLABS_API_KEY).toBeUndefined();
    expect(empty.FFMPEG_PATH).toBeUndefined();
  });

  it('reads both when set and never publishes the ElevenLabs key', () => {
    const env = loadNvidiaEnv({ ...base, ELEVENLABS_API_KEY: 'eleven-secret', FFMPEG_PATH: '/opt/ffmpeg/bin/ffmpeg' });
    expect(env.ELEVENLABS_API_KEY).toBe('eleven-secret');
    expect(env.FFMPEG_PATH).toBe('/opt/ffmpeg/bin/ffmpeg');
    expect(JSON.stringify(nvidiaPublicConfig(env))).not.toContain('eleven-secret');
  });
});

describe('NVIDIA /api/tts', () => {
  it('refuses a foreign or missing origin before auth or ElevenLabs', async () => {
    const fetchFn = audio();
    const auth = signedIn();
    const tts = createNvidiaTts(loadNvidiaEnv({ ...base, ELEVENLABS_API_KEY: 'x' }), { auth, fetch: fetchFn, pitchShift: null });
    for (const origin of ['https://evil.example', 'http://localhost:5181', null]) {
      expect((await tts(post(origin), 'ip')).status, String(origin)).toBe(403);
    }
    expect(auth).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('allows the origin of SIM_PUBLIC_ORIGIN', async () => {
    const env = loadNvidiaEnv({ ...base, SIM_PUBLIC_ORIGIN: 'http://127.0.0.1:6100' });
    const tts = createNvidiaTts(env, { auth: signedIn(), fetch: audio(), pitchShift: null });
    expect((await tts(post('http://127.0.0.1:6100'), 'ip')).status).toBe(204);
    expect((await tts(post(ORIGIN), 'ip')).status).toBe(403);
  });

  it('answers 204 without an ElevenLabs key, so the page reads with Web Speech', async () => {
    const fetchFn = audio();
    const tts = createNvidiaTts(loadNvidiaEnv(base), { auth: signedIn(), fetch: fetchFn, pitchShift: null });
    expect((await tts(post(ORIGIN), 'ip')).status).toBe(204);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('requires the same sign-in as the other NVIDIA routes', async () => {
    const fetchFn = audio();
    const auth = vi.fn(async () => {
      throw new Error('no user scope');
    });
    const tts = createNvidiaTts(loadNvidiaEnv({ ...base, ELEVENLABS_API_KEY: 'x' }), { auth, fetch: fetchFn, pitchShift: null });
    expect((await tts(post(ORIGIN, null), 'ip')).status).toBe(401);
    expect(auth).toHaveBeenCalledWith(null);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('speaks in the lineage voice with the key when signed in', async () => {
    const fetchFn = audio();
    const tts = createNvidiaTts(loadNvidiaEnv({ ...base, ELEVENLABS_API_KEY: 'eleven-secret' }), { auth: signedIn(), fetch: fetchFn, pitchShift: null });
    const res = await tts(post(ORIGIN), 'ip');
    expect(res.status).toBe(200);
    const init = fetchFn.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>)['xi-api-key']).toBe('eleven-secret');
  });

  it('rate-limits per signed-in Caller, not per proxy address', async () => {
    const auth = vi.fn(async (authorization: string | null) => ({ callerId: authorization === 'Bearer a' ? 'a' : 'b' }));
    const tts = createNvidiaTts(loadNvidiaEnv(base), { auth, fetch: audio(), pitchShift: null, perMinute: 2 });
    expect((await tts(post(ORIGIN, 'Bearer a'), 'proxy')).status).toBe(204);
    expect((await tts(post(ORIGIN, 'Bearer a'), 'proxy')).status).toBe(204);
    expect((await tts(post(ORIGIN, 'Bearer a'), 'proxy')).status).toBe(429);
    // Same proxy address, another Caller: their own bucket.
    expect((await tts(post(ORIGIN, 'Bearer b'), 'proxy')).status).toBe(204);
  });

  it('serves the deferred face path (204 for an unknown id)', async () => {
    const tts = createNvidiaTts(loadNvidiaEnv(base), { auth: signedIn(), fetch: audio(), pitchShift: null });
    const res = await tts(new Request(`${ORIGIN}/api/tts/face/00000000-0000-4000-8000-000000000000`, { headers: { origin: ORIGIN } }), 'ip');
    expect(res.status).toBe(204);
  });
});

describe('NVIDIA page CSP', () => {
  it('lets the Mon voice play from a blob: URL', () => {
    const csp = nvidiaCsp(loadNvidiaEnv(base));
    expect(csp).toContain("media-src 'self' blob:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("object-src 'none'");
  });
});

describe('NVIDIA pitch shift', () => {
  it('uses FFMPEG_PATH when set', () => {
    const find = vi.fn((candidate?: string) => (candidate === '/opt/ffmpeg' ? candidate : null));
    expect(typeof nvidiaPitchShift(loadNvidiaEnv({ ...base, FFMPEG_PATH: '/opt/ffmpeg' }), find)).toBe('function');
    expect(find).toHaveBeenCalledWith('/opt/ffmpeg');
  });

  it('plays at natural pitch when FFMPEG_PATH does not run', () => {
    expect(nvidiaPitchShift(loadNvidiaEnv({ ...base, FFMPEG_PATH: '/nope' }), () => null)).toBeNull();
  });

  it('uses the bundled ffmpeg-static binary when FFMPEG_PATH is unset', () => {
    const find = vi.fn((candidate?: string) => (candidate === '/bundled/ffmpeg' ? candidate : null));
    expect(typeof nvidiaPitchShift(loadNvidiaEnv(base), find, '/bundled/ffmpeg')).toBe('function');
    expect(find).toHaveBeenCalledWith('/bundled/ffmpeg');
  });

  it('falls back to the system lookup when unset and the bundled binary does not run', () => {
    const find = vi.fn(() => null);
    expect(nvidiaPitchShift(loadNvidiaEnv(base), find, '/bundled/ffmpeg')).toBeUndefined();
    expect(nvidiaPitchShift(loadNvidiaEnv(base), find, null)).toBeUndefined();
  });

  it('ships a bundled ffmpeg for this platform that runs', () => {
    expect(bundledFfmpeg()).toEqual(expect.any(String));
    expect(findFfmpeg(bundledFfmpeg()!)).toBe(bundledFfmpeg());
  });
});
