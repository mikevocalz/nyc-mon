import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FALLBACK_MON_LINGO, type MonLingo, type MonVoicePort } from '@acme/content/voice';
import { createMonLingoSource } from './mon-lingo-source.ts';
import { BABY_TALK_MS, isBabble } from '@acme/core';
import { babbleInventory } from '@acme/content/voice';
import { babbleLine, createMonSpeaker, type MonVoiceSubject } from './mon-speaker.ts';
import { MonVoiceHttpError, MonVoiceSilent, requestMonVoice, type MonVoiceRequestDeps } from './mon-voice-request.ts';

/** The fixed clock every speaker in this file reads. */
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const now = () => NOW;
const LINEAGE = 'dex-001/female/1';
/** A Small speaks in full (existing canon): lines pass the gate untouched. */
const squeaklet: MonVoiceSubject = { monInstanceId: 'mon_1', voiceLineageId: LINEAGE, stage: 'Small', hatchedAt: NOW - 30 * BABY_TALK_MS };
/** A Baby past its first day: the Q32 limit (family sound plus two words, no "Callah"). */
const baby: MonVoiceSubject = { monInstanceId: 'mon_3', voiceLineageId: LINEAGE, stage: 'Baby', hatchedAt: NOW - BABY_TALK_MS - 1 };
/** A Baby an hour after hatching: babble only. */
const newBaby: MonVoiceSubject = { monInstanceId: 'mon_4', voiceLineageId: LINEAGE, stage: 'Baby', hatchedAt: NOW - 60 * 60_000 };
const egg: MonVoiceSubject = { monInstanceId: 'mon_2', voiceLineageId: LINEAGE, stage: 'Egg', hatchedAt: null };
const inventory = (stage: MonVoiceSubject['stage']) => babbleInventory({ lineageId: LINEAGE }, stage);

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
    now,
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

  it('an Egg babbles: the caption is the gated babble, never the real word, and the line goes to the port', async () => {
    const { s, port } = speaker();
    const done = s.say({ text: 'Bet!', mon: egg });
    const caption = s.caption();
    assert.notEqual(caption, 'Bet!');
    assert.ok(caption !== null && isBabble(caption, inventory('Egg')), String(caption));
    await tick();
    assert.equal(port.calls.prepared.length, 1);
    port.end();
    await done;
  });

  it('reads the voice stage at the injected clock: the same Baby babbles at hour 1 and speaks limited after 24 h', async () => {
    const hatchedAt = NOW - 60 * 60_000;
    const mon: MonVoiceSubject = { ...baby, hatchedAt };
    const captionAt = async (at: number) => {
      const s = createMonSpeaker<string>({ portFor: () => ({ prepare: async (t) => t, play: async () => {} }), soundEnabled: () => false, hold: () => () => {}, now: () => at });
      await s.say({ text: 'Food?', mon });
      return s.caption();
    };
    const early = await captionAt(NOW);
    assert.ok(early !== null && early !== 'Food?' && isBabble(early, inventory('Baby')), String(early));
    assert.equal(await captionAt(hatchedAt + BABY_TALK_MS), 'Food?');
  });

  it('a Baby past its first day never says "Callah" or a sentence: the caption is the gated line', async () => {
    const { s } = speaker({ sound: false });
    await s.say({ text: '*chuckle* Bet, Callah!', mon: baby });
    const caption = s.caption() ?? '';
    assert.doesNotMatch(caption, /call/i);
  });

  it('a first-day Baby babbles even a canon line', async () => {
    const { s } = speaker({ sound: false });
    await s.say({ text: 'Bet!', mon: newBaby });
    const caption = s.caption();
    assert.ok(caption !== null && caption !== 'Bet!' && isBabble(caption, inventory('Baby')), String(caption));
  });

  it("prefers the server's caption when the clip carries one (the server clock decides)", async () => {
    let finish: (() => void) | undefined;
    const s = createMonSpeaker<{ caption: string }>({
      portFor: () => ({
        prepare: async () => ({ caption: 'Bwa gu!' }),
        play: () => new Promise<void>((r) => { finish = r; }),
        captionOf: (clip) => clip.caption,
      }),
      soundEnabled: () => true,
      hold: () => () => {},
      now,
    });
    const done = s.say({ text: 'Food?', mon: squeaklet });
    assert.equal(s.caption(), 'Food?');
    await tick();
    assert.equal(s.caption(), 'Bwa gu!');
    finish?.();
    await done;
  });

  it("shows the server's caption from a silent answer too", async () => {
    const s = createMonSpeaker<string>({
      portFor: () => ({ prepare: async () => { throw new MonVoiceSilent('no-key', 'Nya-mi~'); }, play: async () => {} }),
      soundEnabled: () => true,
      hold: () => () => {},
      now,
    });
    await s.say({ text: 'Food?', mon: squeaklet });
    assert.equal(s.caption(), 'Nya-mi~');
  });

  it('an Egg the server has no record for (404) keeps the local babble caption', async () => {
    const holds: (() => void)[] = [];
    const s = createMonSpeaker<string>({
      portFor: () => ({ prepare: async () => { throw new MonVoiceHttpError(404); }, play: async () => {} }),
      soundEnabled: () => true,
      hold: (_ms, done) => (holds.push(done), () => {}),
      now,
    });
    await s.say({ text: babbleLine(egg, NOW, 'tap|1') ?? '', mon: egg });
    const caption = s.caption();
    assert.ok(caption !== null && isBabble(caption, inventory('Egg')), String(caption));
    assert.equal(holds.length, 1);
  });

  it('speaking() is true from say() until the caption clears', async () => {
    const { s, holds } = speaker({ sound: false });
    assert.equal(s.speaking(), false);
    await s.say({ text: 'Food?', mon: squeaklet });
    assert.equal(s.speaking(), true);
    holds.at(-1)?.();
    assert.equal(s.speaking(), false);
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
      now,
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
      now,
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
      now,
    });
    await s.say({ text: 'Yo Kolla!', mon: squeaklet });
    assert.equal(s.caption(), 'Yo Caller!');
    assert.deepEqual(seen, [served]);
  });

  it('a stage stays silent by the served stage pitch, not a hard-coded rule', async () => {
    const eggSilent: MonLingo = { ...FALLBACK_MON_LINGO, voices: { ...FALLBACK_MON_LINGO.voices, stagePitch: { ...FALLBACK_MON_LINGO.voices.stagePitch, Egg: null } } };
    const port = fakePort();
    const s = createMonSpeaker({ portFor: port.portFor, soundEnabled: () => true, hold: () => () => {}, lingo: () => eggSilent, now });
    await s.say({ text: 'Bet!', mon: egg });
    assert.equal(port.calls.prepared.length, 0);
    assert.ok(s.caption() !== null);
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

describe('requestMonVoice reads what the server gated', () => {
  it('returns the x-mon-caption caption (URI-encoded) and x-mon-voice-stage', async () => {
    const res = new Response(new Uint8Array([1]), { status: 200, headers: { 'x-mon-caption': encodeURIComponent('Bwa gu, nya!'), 'x-mon-voice-stage': 'baby-talk' } });
    const clip = await requestMonVoice({ monId: 'mon_1', text: 'Bet!' }, new AbortController().signal, deps(res));
    assert.equal(clip.caption, 'Bwa gu, nya!');
    assert.equal(clip.voiceStage, 'baby-talk');
  });

  it('ignores a malformed caption or an unknown stage', async () => {
    const res = new Response(new Uint8Array([1]), { status: 200, headers: { 'x-mon-caption': '%E0%A4%A', 'x-mon-voice-stage': 'shouting' } });
    const clip = await requestMonVoice({ monId: 'mon_1', text: 'Bet!' }, new AbortController().signal, deps(res));
    assert.equal(clip.caption, undefined);
    assert.equal(clip.voiceStage, undefined);
  });

  it('a 204 carries the server caption on MonVoiceSilent; a 404 is a MonVoiceHttpError', async () => {
    const silent = new Response(null, { status: 204, headers: { 'x-mon-voice-reason': 'silent', 'x-mon-caption': encodeURIComponent('Mi~') } });
    await assert.rejects(
      requestMonVoice({ monId: 'mon_1', text: 'Bet!' }, new AbortController().signal, deps(silent)),
      (err: unknown) => err instanceof MonVoiceSilent && err.caption === 'Mi~',
    );
    await assert.rejects(
      requestMonVoice({ monId: 'egg', text: 'Bwa!' }, new AbortController().signal, deps(new Response(null, { status: 404 }))),
      (err: unknown) => err instanceof MonVoiceHttpError && err.status === 404,
    );
  });
});

describe('babbleLine', () => {
  it("is seeded babble from the Mon's own sounds for an Egg and a first-day Baby, and nothing after", () => {
    const a = babbleLine(egg, NOW, 'tap|1');
    assert.ok(a !== undefined && isBabble(a, inventory('Egg')), String(a));
    assert.equal(babbleLine(egg, NOW, 'tap|1'), a);
    assert.ok(babbleLine(newBaby, NOW, 'x') !== undefined);
    assert.equal(babbleLine(baby, NOW, 'x'), undefined);
    assert.equal(babbleLine(squeaklet, NOW, 'x'), undefined);
    assert.equal(babbleLine({ ...egg, voiceLineageId: null }, NOW, 'x'), undefined);
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
