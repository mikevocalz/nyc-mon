import { afterEach, describe, expect, it, vi } from 'vitest';
import { speakAs, stopSpeaking } from '../src/client/speech.ts';

/** Records what speakAs does to the element; Node has no HTMLAudioElement. */
class FakeAudio {
  static created: FakeAudio[] = [];
  playbackRate = 1;
  preservesPitch = true;
  onended: (() => void) | null = null;
  constructor(readonly src: string) {
    FakeAudio.created.push(this);
  }
  play = vi.fn(async () => {});
  pause = vi.fn();
}

/** A fetch stand-in that records each request's init. */
function fakeFetch(respond: () => Response) {
  const inits: RequestInit[] = [];
  const fn = (async (_input: unknown, init?: RequestInit) => {
    inits.push(init ?? {});
    return respond();
  }) as typeof fetch;
  return { fn, inits };
}

const mp3 = () => new Response(new Uint8Array([0xff, 0xfb, 0x90]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });

afterEach(() => {
  stopSpeaking();
  FakeAudio.created = [];
  vi.unstubAllGlobals();
});

describe('speakAs', () => {
  it('plays server audio at rate 1 with pitch preserved for every speaking stage', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    for (const stage of ['Baby', 'Small', 'Mid', 'Max'] as const) {
      const { fn } = fakeFetch(mp3);
      await speakAs('hello', { lineageId: 'dex-001/female/1', stage }, { fetchFn: fn, endpoint: '/api/tts' });
      const audio = FakeAudio.created.at(-1);
      expect(audio?.play).toHaveBeenCalledTimes(1);
      expect(audio?.playbackRate).toBe(1);
      expect(audio?.preservesPitch).toBe(true);
    }
  });

  it('sends the mood when the voice has one and leaves it out when not', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const { fn, inits } = fakeFetch(mp3);
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Small', mood: 'needs-social' }, { fetchFn: fn });
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Small' }, { fetchFn: fn });
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

  it('falls back to Web Speech with the stage pitch on 204, leaving the rate alone', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const spoken: { pitch: number; rate: number }[] = [];
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      constructor(readonly text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: (u: Utterance) => spoken.push({ pitch: u.pitch, rate: u.rate }) });
    const { fn } = fakeFetch(() => new Response(null, { status: 204 }));
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Baby' }, { fetchFn: fn });
    expect(spoken).toEqual([{ pitch: 1.3, rate: 1.02 }]);
    expect(FakeAudio.created).toHaveLength(0);
  });
});
