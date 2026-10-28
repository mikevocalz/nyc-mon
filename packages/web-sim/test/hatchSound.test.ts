import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BEATS, CRACK_TICK, CRACKS, soundCues } from '@acme/ui/three/mon/hatch-timeline';
import { HATCH_START_LOGGER } from '@acme/ui/three/mon/hatch-sound';
import { createHostHatchSound, isFreshHatch, parseHatchStart, type HostAudio } from '../src/client/hatchSound.ts';

/** A WebAudio stand-in that records every source start with its node kind and context time. */
function fakeAudio(opts: { state?: 'running' | 'suspended'; resumes?: boolean; now?: number } = {}) {
  const starts: { kind: 'noise' | 'osc'; at: number; filter?: { type: string; hz: number } }[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = (extra: object = {}) => {
    const n: Record<string, unknown> = { connect: (next: unknown) => next, disconnect() {}, ...extra };
    return n;
  };
  const ctx = {
    state: opts.state ?? 'running',
    currentTime: opts.now ?? 10,
    sampleRate: 8000,
    destination: node(),
    resume: vi.fn(async () => {
      if (opts.resumes !== false) ctx.state = 'running';
    }),
    createGain: () => node({ gain: param() }),
    createBuffer: (_ch: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource() {
      let filter: { type: string; hz: number } | undefined;
      return node({
        buffer: null,
        connect(next: { type?: string; frequency?: { value: number } }) {
          if (next.type) filter = { type: next.type, hz: next.frequency?.value ?? 0 };
          return next;
        },
        start: (at: number) => starts.push({ kind: 'noise', at, ...(filter ? { filter } : {}) }),
      });
    },
    createBiquadFilter: () => node({ type: '', frequency: param(), Q: param() }),
    createOscillator: () => node({ type: '', frequency: param(), start: (at: number) => starts.push({ kind: 'osc', at }), stop() {} }),
  };
  return { ctx: ctx as unknown as HostAudio & { state: string; currentTime: number }, starts, raw: ctx };
}

function setup(o: { soundOn?: boolean; reduced?: boolean; audio?: ReturnType<typeof fakeAudio> } = {}) {
  const audio = o.audio ?? fakeAudio();
  const ducks: { level: number; atMs: number }[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const host = createHostHatchSound({
    audio: () => audio.ctx,
    soundOn: () => o.soundOn ?? true,
    reducedMotion: () => o.reduced ?? false,
    duckSpeech: (level) => ducks.push({ level, atMs: timers.length ? timers[timers.length - 1]!.ms : 0 }),
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimer: () => {},
  });
  return { host, audio, ducks, timers };
}

const hatched = { structuredContent: { hatched: true, alreadyHatched: false, hatching: true } };

describe('isFreshHatch', () => {
  it('is true only for hatch_egg with hatching and not alreadyHatched', () => {
    expect(isFreshHatch('hatch_egg', hatched)).toBe(true);
    expect(isFreshHatch('hatch_egg', { structuredContent: { hatched: true, alreadyHatched: true, hatching: false } })).toBe(false);
    expect(isFreshHatch('hatch_egg', { ...hatched, isError: true })).toBe(false);
    expect(isFreshHatch('get_mon_status', hatched)).toBe(false);
    expect(isFreshHatch('hatch_egg', undefined)).toBe(false);
  });
});

describe('parseHatchStart', () => {
  it("reads the view's hatch-start log and ignores every other log", () => {
    expect(parseHatchStart({ level: 'info', logger: HATCH_START_LOGGER, data: { event: 'hatch-start', sound: false, elapsedMs: 40 } })).toEqual({ sound: false, elapsedMs: 40 });
    expect(parseHatchStart({ level: 'info', logger: 'other', data: { event: 'hatch-start', sound: false, elapsedMs: 0 } })).toBeNull();
    expect(parseHatchStart({ level: 'info', logger: HATCH_START_LOGGER, data: 'hatch-start' })).toBeNull();
    // A wild elapsed value is clamped, not trusted.
    expect(parseHatchStart({ level: 'info', logger: HATCH_START_LOGGER, data: { event: 'hatch-start', sound: false, elapsedMs: 9e9 } })?.elapsedMs).toBe(1000);
  });
});

describe('the host plays the hatch sound', () => {
  // The host adds its own processing time (two performance.now() reads) to the
  // reported lag. Pin the clock so these timings check the scheduling math, not
  // how fast the runner is: a loaded CI runner spent 5 ms there and failed.
  let clock: { mockRestore(): void } | undefined;
  beforeEach(() => {
    clock = vi.spyOn(globalThis.performance, 'now').mockReturnValue(1000);
  });
  afterEach(() => {
    clock?.mockRestore();
  });

  it('schedules every beat at its timeline offset from when the view started', async () => {
    const { host, audio } = setup();
    host.arm();
    // The view started 50 ms before its report reached us.
    expect(await host.onViewStart({ sound: false, elapsedMs: 50 })).toBe('host');
    const start = 10 - 0.05;
    const noiseAt = audio.starts.filter((s) => s.kind === 'noise');
    const cracks = noiseAt.filter((s) => s.filter?.hz === 2600).map((s) => s.at);
    expect(cracks).toHaveLength(3);
    cracks.forEach((at, i) => expect(at).toBeCloseTo(start + CRACKS[i]!, 3));
    expect(noiseAt.find((s) => s.filter?.hz === 3800)?.at).toBeCloseTo(start + CRACK_TICK, 3);
    expect(noiseAt.find((s) => s.filter?.type === 'lowpass')?.at).toBeCloseTo(start + BEATS.whiteout[0], 3);
    const oscs = audio.starts.filter((s) => s.kind === 'osc').map((s) => s.at);
    // Shimmer: three sines from the tension; chime: three bell notes from the silhouette's end.
    expect(oscs[0]).toBeCloseTo(start + BEATS.tension[0], 3);
    const chimeAt = soundCues(false).find((c) => c.cue === 'chime')!.t;
    expect(oscs[3]).toBeCloseTo(start + chimeAt, 3);
    expect(oscs).toHaveLength(6);
  });

  it('never plays when the view plays its own sound (touch path): no double playback', async () => {
    const { host, audio } = setup();
    host.arm();
    expect(await host.onViewStart({ sound: true, elapsedMs: 0 })).toBe('view');
    expect(audio.starts).toEqual([]);
  });

  it('plays once per hatch result: a second report for the same arm is ignored', async () => {
    const { host, audio } = setup();
    host.arm();
    await host.onViewStart({ sound: false, elapsedMs: 0 });
    const n = audio.starts.length;
    expect(await host.onViewStart({ sound: false, elapsedMs: 0 })).toBe('skipped');
    expect(audio.starts.length).toBe(n);
  });

  it('a report with no fresh hatch result armed plays nothing', async () => {
    const { host, audio } = setup();
    expect(await host.onViewStart({ sound: false, elapsedMs: 0 })).toBe('skipped');
    expect(audio.starts).toEqual([]);
  });

  it('reduced motion: the chime only', async () => {
    const { host, audio } = setup({ reduced: true });
    host.arm();
    await host.onViewStart({ sound: false, elapsedMs: 0 });
    expect(audio.starts.every((s) => s.kind === 'osc')).toBe(true);
    expect(audio.starts).toHaveLength(3);
    expect(audio.starts[0]!.at).toBeCloseTo(10 + soundCues(true)[0]!.t, 3);
  });

  it('"Read replies aloud" off: silent', async () => {
    const { host, audio } = setup({ soundOn: false });
    host.arm();
    expect(await host.onViewStart({ sound: false, elapsedMs: 0 })).toBe('skipped');
    expect(audio.starts).toEqual([]);
  });

  it('a page whose audio cannot start (no gesture yet) stays silent', async () => {
    const { host, audio } = setup({ audio: fakeAudio({ state: 'suspended', resumes: false }) });
    host.arm();
    expect(await host.onViewStart({ sound: false, elapsedMs: 0 })).toBe('skipped');
    expect(audio.starts).toEqual([]);
  });

  it("ducks the Mon's voice through the white-out, then restores it", async () => {
    const { host, ducks, timers } = setup();
    host.arm();
    await host.onViewStart({ sound: false, elapsedMs: 0 });
    expect(timers.map((t) => Math.round(t.ms))).toEqual([Math.round(BEATS.whiteout[0] * 1000), Math.round(BEATS.whiteFade[1] * 1000)]);
    timers.forEach((t) => t.fn());
    expect(ducks.map((d) => d.level)).toEqual([expect.any(Number), 1]);
    expect(ducks[0]!.level).toBeLessThan(0.5);
  });

  it('reduced motion has no white-out, so nothing ducks', async () => {
    const { host, timers } = setup({ reduced: true });
    host.arm();
    await host.onViewStart({ sound: false, elapsedMs: 0 });
    expect(timers).toEqual([]);
  });

  it('dispose stops the sound and restores the voice', async () => {
    const { host, ducks } = setup();
    host.arm();
    await host.onViewStart({ sound: false, elapsedMs: 0 });
    host.dispose();
    expect(ducks.at(-1)?.level).toBe(1);
  });
});
