import { afterEach, describe, expect, it, vi } from 'vitest';
import { bloodlines } from '@acme/content';
import { babbleInventory, captionText, gateMonLine, monVoiceRef, planMonUtterance, readMonVoiceRef, type MonVoiceRef } from '@acme/content/voice';
import { MON_EGG_STAGE_PITCH } from '@acme/content/lingo';
import { isBabble } from '@acme/core';
import { createRateLimiter } from '../server/model.ts';
import { createTtsHandler, type PitchShifter, type TtsFetch } from '../server/tts.ts';
import { currentMonVoice } from '../src/client/monVoice.ts';
import { speakAs, stopSpeaking } from '../src/client/speech.ts';
import type { TranscriptItem } from '../src/client/session.ts';
import { trustClaim } from './fixtures/roster.ts';

/**
 * One Mon line, every adapter: the MCP tool result (the Alexa+ path), the
 * browser that posts to /api/tts, the server that calls ElevenLabs, and the
 * Web Speech fallback all land on the plan from `planMonUtterance`.
 */

const ORIGIN = 'http://localhost:5180';

const LINES = [
  "*chuckle* Yeah Callah, I'm good.",
  '“Say less, Callah. That hit.”',
  '*yawn* Night night.',
  'Bet!',
] as const;

/** As the MCP tool result reports them: a Baby past its first day speaks `limited`. */
const VOICED: readonly MonVoiceRef[] = [
  { lineageId: 'dex-001/female/1', stage: 'Small', voiceStage: 'full', mood: 'content' },
  { lineageId: 'dex-001/male/3', stage: 'Baby', voiceStage: 'limited', mood: 'asleep' },
  { lineageId: 'dex-001/female/4', stage: 'Max', voiceStage: 'full' },
];

class FakeAudio {
  static created: FakeAudio[] = [];
  volume = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  currentTime = 0;
  duration = 1;
  constructor(readonly src: string) {
    FakeAudio.created.push(this);
  }
  play = vi.fn(async () => {});
  pause = vi.fn();
}

function stubWebSpeech() {
  const spoken: { text: string; pitch: number }[] = [];
  class Utterance {
    lang = '';
    rate = 1;
    pitch = 1;
    voice: unknown;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(readonly text: string) {}
  }
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', {
    cancel: vi.fn(),
    getVoices: () => [{ name: 'Samantha', lang: 'en-US', default: true }],
    speak: (u: Utterance) => {
      spoken.push({ text: u.text, pitch: u.pitch });
      queueMicrotask(() => u.onend?.());
    },
  });
  return spoken;
}

/** The server adapter: what it sent ElevenLabs and the pitch it baked in. */
async function serverSends(body: unknown) {
  const upstream = vi.fn<TtsFetch>(async () => new Response(new Uint8Array([0xff, 0xfb, 0x90]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }));
  const shift = vi.fn<PitchShifter>((audio) => audio);
  const res = await createTtsHandler({ roster: trustClaim, allowedOrigin: ORIGIN, rateLimit: createRateLimiter(100), apiKey: 'k', fetch: upstream, pitchShift: shift })(
    new Request(`${ORIGIN}/api/tts`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(body) }),
    'ip',
  );
  await res.arrayBuffer().catch(() => undefined);
  const call = upstream.mock.calls[0];
  return {
    status: res.status,
    url: call ? String(call[0]) : null,
    sent: call ? (JSON.parse(String(call[1].body)) as { text: string; model_id: string; voice_settings: unknown }) : null,
    factor: shift.mock.calls[0]?.[1] ?? 1,
    caption: decodeURIComponent(res.headers.get('x-mon-caption') ?? ''),
  };
}

/** The browser adapter: the body it posts to /api/tts for one line. */
async function browserPosts(line: string, ref: MonVoiceRef): Promise<unknown> {
  vi.stubGlobal('Audio', FakeAudio);
  const inits: RequestInit[] = [];
  const fetchFn = (async (_u: unknown, init?: RequestInit) => {
    inits.push(init ?? {});
    return new Response(new Uint8Array([0xff, 0xfb, 0x90]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  }) as typeof fetch;
  void speakAs(line, ref, { fetchFn, retryDelayMs: 1 });
  await vi.waitFor(() => expect(inits).toHaveLength(1));
  stopSpeaking();
  return JSON.parse(String(inits[0]?.body));
}

/** The MCP path: the tool result's `mon.voice` and `mood`, read back by the client. */
function viaToolResult(ref: MonVoiceRef): MonVoiceRef | undefined {
  const mon = { monId: 'mon_1', voice: monVoiceRef({ voiceLineageId: ref.lineageId, stage: ref.stage }, Date.now()) };
  const item = { kind: 'tool', result: { content: [], structuredContent: { mon, ...(ref.mood ? { mood: ref.mood } : {}) } } } as unknown as TranscriptItem;
  return currentMonVoice([item]);
}

afterEach(() => {
  stopSpeaking();
  FakeAudio.created = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('one Mon voice across adapters', () => {
  for (const ref of VOICED) {
    for (const line of LINES) {
      it(`${ref.lineageId} ${ref.stage} ${ref.mood ?? '-'}: ${line}`, async () => {
        const plan = planMonUtterance(line, ref);
        if (plan.voice.kind !== 'lineage') throw new Error(`expected a lineage voice for ${ref.lineageId}`);

        // MCP tool result -> client: the same ref.
        expect(viaToolResult(ref)).toEqual(ref);
        expect(readMonVoiceRef(JSON.parse(JSON.stringify(ref)), ref.mood)).toEqual(ref);

        // Browser -> server: the server re-plans the posted body into the same voice.
        const body = await browserPosts(line, ref);
        const server = await serverSends(body);
        expect(server.status).toBe(200);
        expect(server.url).toContain(`/text-to-speech/${plan.voice.voiceId}/`);
        expect(server.sent).toEqual({ text: plan.spoken, model_id: plan.voice.model, voice_settings: plan.voice.settings });
        expect(server.factor).toBe(plan.voice.pitchFactor);

        // The caption every surface shows: the line after the speech gate (a Baby keeps two words at most).
        expect(plan.caption).toBe(captionText(gateMonLine(line, ref).text));
        expect(plan.caption).not.toMatch(/Callah|\*/);
        expect(server.caption).toBe(plan.caption);
      });
    }
  }

  it('the Web Speech fallback reads the plan’s plain text at the plan’s pitch', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const spoken = stubWebSpeech();
    const ref = VOICED[0]!;
    const noVoice = (async () => new Response(null, { status: 204 })) as typeof fetch;
    for (const line of LINES) await speakAs(line, ref, { fetchFn: noVoice });
    const plans = LINES.map((l) => planMonUtterance(l, ref));
    expect(spoken).toEqual(plans.map((p) => ({ text: p.plainSpoken, pitch: p.voice.kind === 'lineage' ? p.voice.fallbackPitch : NaN })));
    // Stage directions are performed or dropped, never read out.
    for (const s of spoken) expect(s.text).not.toMatch(/\*|chuckle|yawn/);
  });

  it('an Egg babbles everywhere, in its lineage voice at the Egg pitch (Decision 32)', async () => {
    const egg: MonVoiceRef = { lineageId: 'dex-001/female/1', stage: 'Egg', voiceStage: 'baby-talk' };
    const plan = planMonUtterance('hi Callah', egg);
    if (plan.voice.kind !== 'lineage') throw new Error('expected the lineage voice');
    expect(plan.voice.pitchFactor).toBe(MON_EGG_STAGE_PITCH);
    expect(plan.gated).toBe(true);
    expect(isBabble(plan.caption, babbleInventory({ lineageId: egg.lineageId }, 'Egg'))).toBe(true);
    const body = await browserPosts('hi Callah', egg);
    expect(body).toMatchObject({ stage: 'Egg', voiceStage: 'baby-talk' });
    const server = await serverSends(body);
    expect(server.status).toBe(200);
    expect(server.sent?.text).toBe(plan.spoken);
    expect(server.factor).toBe(MON_EGG_STAGE_PITCH);
    expect(server.caption).toBe(plan.caption);
  });

  it('a line with no lineage voice yet falls back the same way on server and browser', async () => {
    const bodega: MonVoiceRef = { lineageId: `${bloodlines[1]!.chain.speciesId}/female/1`, stage: 'Baby' };
    const plan = planMonUtterance('*purr* Food?', bodega);
    expect(plan.voice.kind).toBe('fallback');
    expect((await serverSends({ text: 'Food?', lineageId: bodega.lineageId, stage: 'Baby' })).status).toBe(204);
    vi.stubGlobal('Audio', FakeAudio);
    const spoken = stubWebSpeech();
    const fetchFn = vi.fn() as unknown as typeof fetch;
    await speakAs('*purr* Food?', bodega, { fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(spoken).toEqual([{ text: plan.plainSpoken, pitch: plan.voice.kind === 'fallback' ? plan.voice.pitch : NaN }]);
  });
});
