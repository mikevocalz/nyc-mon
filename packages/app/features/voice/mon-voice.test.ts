import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FALLBACK_MON_LINGO, type MonLingo, type MonVoicePort } from '@acme/content/voice';
import { createMonLingoSource } from './mon-lingo-source.ts';
import { createMonSpeaker, type MonVoiceSubject } from './mon-speaker.ts';
import { MonVoiceSilent, requestMonVoice, type MonVoiceRequestDeps } from './mon-voice-request.ts';

const squeaklet: MonVoiceSubject = { monInstanceId: 'mon_1', voiceLineageId: 'dex-001/female/1', stage: 'Baby' };
const egg: MonVoiceSubject = { monInstanceId: 'mon_2', voiceLineageId: 'dex-001/female/1', stage: 'Egg' };

const tick = () => new Promise((r) => setTimeout(r, 0));

/** A port whose `play` stays open until the test ends it, recording every call. */
function fakePort() {
  const calls: { prepared: string[]; played: number; aborted: number } = { prepared: [], played: 0, aborted: 0 };
  let finish: (() => void) | undefined;
  const portFor = (subject: MonVoiceSubject): MonVoicePort<string> => ({
    prepare: async (text) => {
      calls.prepared.push(`${subject.monInstanceId}:${text}`);
      return text;
    },
    play: (_clip, signal) =>
      new Promise<void>((resolve) => {
        calls.played += 1;
        finish = resolve;
        signal.addEventListener('abort', () => {
          calls.aborted += 1;
          resolve();
        });
      }),
  });
  return { calls, portFor, end: () => finish?.() };
}

function speaker(opts: { sound?: boolean } = {}) {
  const port = fakePort();
  const holds: (() => void)[] = [];
  const s = createMonSpeaker({
    portFor: port.portFor,
    soundEnabled: () => opts.sound ?? true,
    hold: (_ms, done) => {
      holds.push(done);
      return () => {};
    },
  });
  return { s, port, holds };
}

describe('createMonSpeaker', () => {
  it('shows the caption (Caller, no stage direction) and plays the line through the port', async () => {
    const { s, port } = speaker();
    const done = s.say({ text: '*chuckle* Bet, Callah!', mon: squeaklet });
    assert.equal(s.caption(), 'Bet, Caller!');
    await tick();
    assert.deepEqual(port.calls.prepared, ['mon_1:*chuckle* Bet, Callah!']);
    assert.equal(port.calls.played, 1);
    port.end();
    await done;
  });

  it('keeps the caption up when Sound is off and never touches the port', async () => {
    const { s, port, holds } = speaker({ sound: false });
    await s.say({ text: 'Food?', mon: squeaklet });
    assert.equal(s.caption(), 'Food?');
    assert.equal(port.calls.prepared.length, 0);
    holds.at(-1)?.();
    assert.equal(s.caption(), null);
  });

  it('an Egg makes no sound; its caption still shows', async () => {
    const { s, port } = speaker();
    await s.say({ text: 'Bet!', mon: egg });
    assert.equal(s.caption(), 'Bet!');
    assert.equal(port.calls.prepared.length, 0);
  });

  it('a new line cuts off the one playing', async () => {
    const { s, port } = speaker();
    void s.say({ text: 'Bet!', mon: squeaklet });
    await tick();
    void s.say({ text: 'Food?', mon: squeaklet });
    await tick();
    assert.equal(port.calls.aborted, 1);
    assert.equal(s.caption(), 'Food?');
  });

  it('stop() cuts the voice and clears the caption (navigation away, the city starting)', async () => {
    const { s, port } = speaker();
    void s.say({ text: 'Bet!', mon: squeaklet });
    await tick();
    s.stop();
    assert.equal(port.calls.aborted, 1);
    assert.equal(s.caption(), null);
  });

  it('a rejected prepare skips the sound and holds the caption', async () => {
    const holds: (() => void)[] = [];
    const s = createMonSpeaker<string>({
      portFor: () => ({ prepare: async () => { throw new MonVoiceSilent('no-key'); }, play: async () => {} }),
      soundEnabled: () => true,
      hold: (_ms, done) => (holds.push(done), () => {}),
    });
    await s.say({ text: 'Food?', mon: squeaklet });
    assert.equal(s.caption(), 'Food?');
    assert.equal(holds.length, 1);
  });

  it("stop(owner) only stops the owner's line, so another screen's cleanup can't cut it", async () => {
    const { s, port } = speaker();
    const home = {};
    const hatch = {};
    void s.say({ text: 'Bet!', mon: squeaklet, owner: home });
    await tick();
    s.stop(hatch);
    assert.equal(port.calls.aborted, 0);
    assert.equal(s.caption(), 'Bet!');
    s.stop(home);
    assert.equal(port.calls.aborted, 1);
    assert.equal(s.caption(), null);
  });

  it('a prepared clip that is never played is disposed', async () => {
    const disposed: string[] = [];
    let release: (() => void) | undefined;
    const s = createMonSpeaker<string>({
      portFor: () => ({
        prepare: (text) => new Promise<string>((r) => { release = () => r(text); }),
        play: async () => {},
        dispose: (clip) => disposed.push(clip),
      }),
      soundEnabled: () => true,
      hold: () => () => {},
    });
    const first = s.say({ text: 'Bet!', mon: squeaklet });
    await tick();
    const pending = release;
    void s.say({ text: 'Food?', mon: squeaklet });
    pending?.();
    await first;
    assert.deepEqual(disposed, ['Bet!']);
  });

  it('tells subscribers when the caption changes', async () => {
    const { s, port } = speaker();
    const seen: (string | null)[] = [];
    const off = s.subscribe(() => seen.push(s.caption()));
    void s.say({ text: 'Bet!', mon: squeaklet });
    await tick();
    port.end();
    await tick();
    off();
    assert.equal(seen[0], 'Bet!');
  });
});

describe('createMonSpeaker with the lingo Payload serves', () => {
  it('captions and plans every line with the served tables, and hands them to the port', async () => {
    const served: MonLingo = {
      ...FALLBACK_MON_LINGO,
      pronunciations: [{ key: 'p', written: 'Caller', variants: ['Callah', 'Kolla'], spoken: 'Call-uh', spokenPlural: null }],
    };
    const seen: MonLingo[] = [];
    const s = createMonSpeaker<string>({
      portFor: (_mon, lingo) => {
        seen.push(lingo);
        return { prepare: async (text) => text, play: async () => {} };
      },
      soundEnabled: () => true,
      hold: () => () => {},
      lingo: () => served,
    });
    await s.say({ text: 'Yo Kolla!', mon: squeaklet });
    assert.equal(s.caption(), 'Yo Caller!');
    assert.deepEqual(seen, [served]);
  });

  it('an Egg stays silent by the served stage pitch, not a hard-coded rule', async () => {
    const babySilent: MonLingo = { ...FALLBACK_MON_LINGO, voices: { ...FALLBACK_MON_LINGO.voices, stagePitch: { ...FALLBACK_MON_LINGO.voices.stagePitch, Baby: null } } };
    const port = fakePort();
    const s = createMonSpeaker({ portFor: port.portFor, soundEnabled: () => true, hold: () => () => {}, lingo: () => babySilent });
    await s.say({ text: 'Bet!', mon: squeaklet });
    assert.equal(port.calls.prepared.length, 0);
  });
});

function lingoResponse(lingo: MonLingo, etag: string): Response {
  return new Response(JSON.stringify({ ok: true, data: lingo }), { status: 200, headers: { etag, 'content-type': 'application/json' } });
}

describe('createMonLingoSource', () => {
  const served: MonLingo = { ...FALLBACK_MON_LINGO, voices: { ...FALLBACK_MON_LINGO.voices, model: 'eleven_served' } };

  it('answers with the fallback until the server does, then with what it served', async () => {
    const calls: RequestInit[] = [];
    const source = createMonLingoSource({ baseUrl: 'https://admin.test', headers: { origin: 'nycmon://' }, fetch: async (url, init) => {
      assert.equal(url, 'https://admin.test/v1/mon-lingo');
      calls.push(init);
      return lingoResponse(served, '"v1"');
    } });
    assert.equal(source.current(), FALLBACK_MON_LINGO);
    await source.refresh();
    assert.equal(source.current().voices.model, 'eleven_served');
    assert.equal(calls[0]?.credentials, 'include');
    assert.equal((calls[0]?.headers as Record<string, string>).origin, 'nycmon://');
  });

  it('revalidates with the ETag and keeps the table on a 304', async () => {
    const sent: (string | undefined)[] = [];
    let first = true;
    const source = createMonLingoSource({ baseUrl: '', fetch: async (_url, init) => {
      sent.push((init.headers as Record<string, string>)['if-none-match']);
      if (first) {
        first = false;
        return lingoResponse(served, '"v1"');
      }
      return new Response(null, { status: 304 });
    } });
    await source.refresh();
    await source.refresh();
    assert.deepEqual(sent, [undefined, '"v1"']);
    assert.equal(source.current().voices.model, 'eleven_served');
  });

  it('keeps what it has on a malformed body, an error status or no network', async () => {
    const answers: (() => Response)[] = [
      () => new Response(JSON.stringify({ ok: true, data: { locale: 'en-US' } }), { status: 200 }),
      () => new Response(null, { status: 503 }),
      () => { throw new TypeError('offline'); },
    ];
    const source = createMonLingoSource({ baseUrl: '', fetch: async () => answers.shift()!() });
    for (let i = 0; i < 3; i += 1) await source.refresh();
    assert.equal(source.current(), FALLBACK_MON_LINGO);
  });

  it('shares one request between concurrent refreshes', async () => {
    let count = 0;
    const source = createMonLingoSource({ baseUrl: '', fetch: async () => {
      count += 1;
      return lingoResponse(served, '"v1"');
    } });
    await Promise.all([source.refresh(), source.refresh()]);
    assert.equal(count, 1);
  });
});

function deps(response: Response, seen: { url?: string; init?: RequestInit } = {}): MonVoiceRequestDeps {
  return {
    baseUrl: 'https://admin.test',
    headers: { origin: 'nycmon://' },
    fetch: async (url, init) => {
      seen.url = url;
      seen.init = init;
      return response;
    },
  };
}

describe('requestMonVoice', () => {
  it('posts { monId, text, mood } with the session cookie and returns the clip and the pitch left to apply', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const res = new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'x-mon-pitch': '1', 'x-mon-pitch-target': '1.3' } });
    const clip = await requestMonVoice({ monId: 'mon_1', text: 'Bet!', mood: 'content' }, new AbortController().signal, deps(res, seen));
    assert.equal(seen.url, 'https://admin.test/v1/mon-voice');
    assert.equal(seen.init?.method, 'POST');
    assert.equal(seen.init?.credentials, 'include');
    assert.deepEqual(JSON.parse(String(seen.init?.body)), { monId: 'mon_1', text: 'Bet!', mood: 'content' });
    assert.equal((seen.init?.headers as Record<string, string>).origin, 'nycmon://');
    assert.equal(clip.pitch, 1.3);
    assert.equal(clip.bytes.byteLength, 3);
  });

  it('trims a long line to MAX_SPOKEN_TEXT before sending', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const res = new Response(new Uint8Array([1]), { status: 200 });
    await requestMonVoice({ monId: 'mon_1', text: 'a'.repeat(900) }, new AbortController().signal, deps(res, seen));
    assert.equal((JSON.parse(String(seen.init?.body)) as { text: string }).text.length, 400);
  });

  it('turns a 204 into MonVoiceSilent with the server reason', async () => {
    const res = new Response(null, { status: 204, headers: { 'x-mon-voice-reason': 'no-key' } });
    await assert.rejects(
      requestMonVoice({ monId: 'mon_1', text: 'Bet!' }, new AbortController().signal, deps(res)),
      (err: unknown) => err instanceof MonVoiceSilent && err.reason === 'no-key',
    );
  });

  it('rejects on any other status', async () => {
    await assert.rejects(requestMonVoice({ monId: 'mon_1', text: 'Bet!' }, new AbortController().signal, deps(new Response(null, { status: 404 }))));
  });
});

describe('the Mon voice adapters', () => {
  it('are the only app files that reach a speech engine, and both plan with @acme/content/voice', async () => {
    const { readFileSync } = await import('node:fs');
    for (const file of ['mon-voice-port.native.ts', 'mon-voice-port.web.ts']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.match(text, /from '@acme\/content\/voice'/, file);
    }
  });
});
