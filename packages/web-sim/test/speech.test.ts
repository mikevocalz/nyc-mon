import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MonSpeechCue } from '@acme/ui/three/mon/lipsync';
import { setSessionVoice, speakAs, stopSpeaking } from '../src/client/speech.ts';
import { addSpeechCueListener } from '../src/client/speechCues.ts';

/** Records what speakAs does to the element; Node has no HTMLAudioElement. Ends only when told to. */
class FakeAudio {
  static created: FakeAudio[] = [];
  playbackRate = 1;
  preservesPitch = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  currentTime = 0.03;
  duration = 1.5;
  constructor(readonly src: string) {
    FakeAudio.created.push(this);
  }
  play = vi.fn(async () => {});
  pause = vi.fn();
  end() {
    this.onended?.();
  }
}

/** A fetch stand-in that records each request's init and answers in turn. */
function fakeFetch(...responders: (() => Response)[]) {
  const inits: RequestInit[] = [];
  const fn = (async (_input: unknown, init?: RequestInit) => {
    inits.push(init ?? {});
    const r = responders[Math.min(inits.length - 1, responders.length - 1)]!;
    return r();
  }) as typeof fetch;
  return { fn, inits };
}

const mp3 = () => new Response(new Uint8Array([0xff, 0xfb, 0x90]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
const status = (code: number) => () => new Response(code === 204 ? null : 'x', { status: code });

/** A browser speech stub that records each utterance. */
function stubWebSpeech() {
  const spoken: { text: string; pitch: number; rate: number; voice: string | undefined }[] = [];
  class Utterance {
    lang = '';
    rate = 1;
    pitch = 1;
    voice: { name: string } | undefined;
    constructor(readonly text: string) {}
  }
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', {
    cancel: vi.fn(),
    getVoices: () => [{ name: 'Samantha', lang: 'en-US', default: true }, { name: 'Daniel', lang: 'en-GB', default: false }],
    speak: (u: Utterance) => spoken.push({ text: u.text, pitch: u.pitch, rate: u.rate, voice: u.voice?.name }),
  });
  return spoken;
}

/** Starts speech without waiting for the clip to end (FakeAudio never ends by itself). */
async function started(text: string, voice: Parameters<typeof speakAs>[1], opts: Parameters<typeof speakAs>[2]) {
  void speakAs(text, voice, { retryDelayMs: 1, ...opts });
  await vi.waitFor(() => expect(FakeAudio.created.at(-1)?.play).toHaveBeenCalled());
  return FakeAudio.created.at(-1)!;
}

afterEach(() => {
  stopSpeaking();
  FakeAudio.created = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('speakAs', () => {
  it('plays server audio at rate 1 with pitch preserved for every speaking stage', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    for (const stage of ['Baby', 'Small', 'Mid', 'Max'] as const) {
      const audio = await started('hello', { lineageId: 'dex-001/female/1', stage }, { fetchFn: fakeFetch(mp3).fn, endpoint: '/api/tts' });
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(audio.playbackRate).toBe(1);
      expect(audio.preservesPitch).toBe(true);
    }
  });

  it('sends the mood when the voice has one and leaves it out when not', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const { fn, inits } = fakeFetch(mp3);
    await started('hi', { lineageId: 'dex-001/male/2', stage: 'Small', mood: 'needs-social' }, { fetchFn: fn });
    await started('hi', { lineageId: 'dex-001/male/2', stage: 'Small' }, { fetchFn: fn });
    const bodies = inits.map((init) => JSON.parse(String(init.body)) as unknown);
    expect(bodies[0]).toEqual({ text: 'hi', lineageId: 'dex-001/male/2', stage: 'Small', mood: 'needs-social' });
    expect(bodies[1]).toEqual({ text: 'hi', lineageId: 'dex-001/male/2', stage: 'Small' });
  });

  it('keeps an Egg silent without calling the server', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const { fn, inits } = fakeFetch(mp3);
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Egg', mood: 'content' }, { fetchFn: fn });
    expect(inits).toHaveLength(0);
    expect(FakeAudio.created).toHaveLength(0);
  });

  it('uses the browser voice only when the server has no ElevenLabs (204), one voice for the session, stage pitch', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const spoken = stubWebSpeech();
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Baby' }, { fetchFn: fakeFetch(status(204)).fn });
    await speakAs('again', { lineageId: 'dex-001/male/2', stage: 'Baby' }, { fetchFn: fakeFetch(status(204)).fn });
    expect(spoken).toEqual([
      { text: 'hi', pitch: 1.3, rate: 1.02, voice: 'Samantha' },
      { text: 'again', pitch: 1.3, rate: 1.02, voice: 'Samantha' },
    ]);
    expect(FakeAudio.created).toHaveLength(0);
  });

  it('never speaks a voiced Mon in another voice: a failure retries once, then stays silent', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const spoken = stubWebSpeech();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fn, inits } = fakeFetch(status(502));
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Mid' }, { fetchFn: fn, retryDelayMs: 1 });
    expect(inits).toHaveLength(2);
    expect(spoken).toEqual([]);
    expect(FakeAudio.created).toHaveLength(0);
    expect(String(warn.mock.calls[0]?.[0])).toContain('502');
    expect(String(warn.mock.calls[0]?.[0])).not.toContain('hi');

    // A body that is not a performance, then a good one: the retry plays the voice.
    const bad = () => new Response('{"oops":1}', { status: 200, headers: { 'content-type': 'application/json' } });
    const retry = fakeFetch(bad, mp3);
    await started('hi', { lineageId: 'dex-001/male/2', stage: 'Mid' }, { fetchFn: retry.fn });
    expect(retry.inits).toHaveLength(2);
    expect(spoken).toEqual([]);

    // A network error twice: silent too.
    const net = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Mid' }, { fetchFn: net, retryDelayMs: 1 });
    expect(spoken).toEqual([]);
  });

  it('a play() rejection is not voiced by anything else', async () => {
    class Blocked extends FakeAudio {
      override play = vi.fn(async () => Promise.reject(new Error('NotAllowedError')));
    }
    vi.stubGlobal('Audio', Blocked);
    const spoken = stubWebSpeech();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Mid' }, { fetchFn: fakeFetch(mp3).fn });
    expect(spoken).toEqual([]);
  });

  it('a reply with no voice of its own speaks in the sticky session voice', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const spoken = stubWebSpeech();
    setSessionVoice({ lineageId: 'dex-001/female/1', stage: 'Small', mood: 'content' });
    const { fn, inits } = fakeFetch(mp3);
    await started('hello', undefined, { fetchFn: fn });
    expect(JSON.parse(String(inits[0]?.body))).toMatchObject({ lineageId: 'dex-001/female/1', stage: 'Small' });
    expect(spoken).toEqual([]);
    // A later voiced reply updates it.
    await started('hey', { lineageId: 'dex-001/male/2', stage: 'Mid' }, { fetchFn: fn });
    await started('again', undefined, { fetchFn: fn });
    expect(JSON.parse(String(inits[2]?.body))).toMatchObject({ lineageId: 'dex-001/male/2', stage: 'Mid' });
  });

  it('queue: true plays after the current clip instead of cutting it off; stopSpeaking cancels both', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const { fn } = fakeFetch(mp3);
    const voice = { lineageId: 'dex-001/male/2', stage: 'Mid' } as const;
    const first = await started('One.', voice, { fetchFn: fn });
    const second = speakAs('Two.', voice, { fetchFn: fn, queue: true });
    await new Promise((r) => setTimeout(r, 20));
    expect(FakeAudio.created).toHaveLength(1);
    expect(first.pause).not.toHaveBeenCalled();
    first.end();
    await vi.waitFor(() => expect(FakeAudio.created).toHaveLength(2));
    const third = speakAs('Three.', voice, { fetchFn: fn, queue: true });
    stopSpeaking();
    await second;
    await third;
    expect(FakeAudio.created[1]!.pause).toHaveBeenCalled();
    expect(FakeAudio.created).toHaveLength(2);
  });
});

describe('speakAs lip-sync cues', () => {
  const alignment = { characters: [...'Hi mom'], character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5], character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] };
  const performance = (extra: Record<string, unknown>) => () =>
    new Response(JSON.stringify({ audio: 'AQID', audioContentType: 'audio/mpeg', ...extra }), { status: 200, headers: { 'content-type': 'application/json' } });
  const listen = () => {
    const cues: MonSpeechCue[] = [];
    const off = addSpeechCueListener((c) => cues.push(c));
    return { cues, off };
  };

  it('asks for JSON and cues the face when the server sent Audio2Face frames', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const { cues, off } = listen();
    const { fn, inits } = fakeFetch(performance({ alignment, face: { fps: 30, names: ['jawOpen'], frames: [[0.1], [0.3]] } }));
    await started('Hi mom', { lineageId: 'dex-001/male/2', stage: 'Mid' }, { fetchFn: fn });
    await vi.waitFor(() => expect(cues).toHaveLength(1));
    expect(new Headers(inits[0]?.headers).get('accept')).toBe('application/json, audio/mpeg');
    const start = cues[0]!;
    if (start.kind !== 'start') throw new Error('expected a start cue');
    expect(start.track.kind).toBe('face');
    expect(start.elapsedMs).toBeCloseTo(30);
    expect(start.durationMs).toBeCloseTo(1500);
    FakeAudio.created.at(-1)!.end();
    expect(cues.at(-1)).toEqual({ kind: 'stop', id: start.id });
    off();
  });

  it('falls back to character-timed visemes without a face, and to no cue without any timing', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const { cues, off } = listen();
    await started('Hi mom', { lineageId: 'dex-001/male/2', stage: 'Mid' }, { fetchFn: fakeFetch(performance({ alignment })).fn });
    await vi.waitFor(() => expect(cues).toHaveLength(1));
    expect(cues[0]?.kind === 'start' && cues[0].track.kind).toBe('visemes');
    stopSpeaking();
    cues.length = 0;
    // Plain mp3 and no WebAudio in Node: no source, so no cue; the clip still plays.
    await started('Hi', { lineageId: 'dex-001/male/2', stage: 'Mid' }, { fetchFn: fakeFetch(mp3).fn });
    expect(cues).toEqual([]);
    off();
  });
});
