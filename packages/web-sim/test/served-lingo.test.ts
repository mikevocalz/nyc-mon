import { FALLBACK_MON_LINGO, type MonLingo } from '@acme/content/lingo';
import { voiceGuideFor } from '@acme/content/voice';
import { describe, expect, it, vi } from 'vitest';
import { asrPhrases } from '../server/asr.ts';
import { loadNvidiaEnv } from '../server/nvidia-env.ts';
import { createNvidiaTts } from '../server/nvidia-tts.ts';
import type { ModelBackend, TurnParams } from '../server/model.ts';
import type { MonLingoSource } from '../server/mon-lingo-source.ts';
import { hostNote, stageDirectionNote } from '../server/skill.ts';
import { createTtsHandler, type TtsFetch } from '../server/tts.ts';
import { monFromTurn, withServedVoice, withVoiceGuide } from '../server/voice-guide.ts';

/**
 * The NVIDIA server reads the Mon's lingo from Payload (GET /v1/mon-lingo)
 * instead of the bundled seed: the voice table for /api/tts, the pronunciations
 * and palette for the ASR word boost, the stage-direction keywords for the host
 * note, and the voice guide for each model turn.
 */

const ORIGIN = 'http://localhost:5180';
const LINEAGE = 'dex-001/female/1';

/** The seed with every voice recast and one changed stage direction, so the tests can tell served from bundled. */
const served: MonLingo = {
  ...FALLBACK_MON_LINGO,
  voices: { ...FALLBACK_MON_LINGO.voices, lineages: FALLBACK_MON_LINGO.voices.lineages.map((v) => ({ ...v, elevenLabsVoiceId: `served-${v.elevenLabsVoiceId}` })) },
  pronunciations: [...FALLBACK_MON_LINGO.pronunciations, { key: 'pronunciation.dana', written: 'Dana', variants: ['Danah'], spoken: 'Day-nuh', spokenPlural: null }],
  stageDirections: [{ key: 'stage-direction.snorts', tag: '[snorts]', keywords: ['snort', 'scoff'] }],
  guide: [
    ...FALLBACK_MON_LINGO.guide,
    { key: 'word-palette.facts', category: 'word-palette', subcategory: 'hood-ratti', text: 'facts', meaning: 'True. Like: “Facts.”', policy: 'Agreement.', bloodlineId: null, speciesId: null, stage: null, mood: null, trigger: null },
  ],
};

const fixed = (lingo: MonLingo): MonLingoSource => ({ get: vi.fn(async () => lingo), latest: () => lingo, etag: () => '"t"' });
const audio = () => vi.fn<TtsFetch>(async () => new Response(new Uint8Array([0xff, 0xfb, 0x90]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }));
const speak = (text = 'Hi there.') =>
  new Request(`${ORIGIN}/api/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, authorization: 'Bearer t' },
    body: JSON.stringify({ text, lineageId: LINEAGE, stage: 'Baby' }),
  });

describe('/api/tts plans with the served lingo', () => {
  it('createTtsHandler speaks in the voice the served table casts', async () => {
    const fetchFn = audio();
    const handle = createTtsHandler({ allowedOrigin: ORIGIN, rateLimit: () => true, apiKey: 'x', fetch: fetchFn, pitchShift: null, lingo: async () => served });
    expect((await handle(speak(), 'ip')).status).toBe(200);
    expect(String(fetchFn.mock.calls[0]![0])).toContain('/served-');
  });

  it('keeps the bundled voice when no lingo dep is given', async () => {
    const fetchFn = audio();
    const handle = createTtsHandler({ allowedOrigin: ORIGIN, rateLimit: () => true, apiKey: 'x', fetch: fetchFn, pitchShift: null });
    expect((await handle(speak(), 'ip')).status).toBe(200);
    expect(String(fetchFn.mock.calls[0]![0])).not.toContain('/served-');
  });

  it('the NVIDIA /api/tts asks the source on behalf of the signed-in Caller', async () => {
    const fetchFn = audio();
    const source = fixed(served);
    const env = loadNvidiaEnv({ NEBIUS_API_KEY: 'k', V1_MCP_SERVICE_KEY: 'v'.repeat(32), ELEVENLABS_API_KEY: 'x' });
    const tts = createNvidiaTts(env, { auth: async () => ({ callerId: '12' }), fetch: fetchFn, pitchShift: null, lingo: source, log: () => {} });
    expect((await tts(speak(), 'ip')).status).toBe(200);
    expect(source.get).toHaveBeenCalledWith('12');
    expect(String(fetchFn.mock.calls[0]![0])).toContain('/served-');
  });
});

describe('ASR word boost', () => {
  it('boosts the served pronunciations and palette words', () => {
    const phrases = asrPhrases(served);
    expect(phrases).toEqual(expect.arrayContaining(['Caller', 'Callah', 'Dana', 'Danah', 'facts', 'bet', 'say less', 'my G']));
    expect(phrases).toEqual(expect.arrayContaining(["Lil' Ratti", 'Squeaklet']));
  });

  it('leaves out palette entries that are descriptions, not words', () => {
    const phrases = asrPhrases(FALLBACK_MON_LINGO);
    expect(phrases).not.toContain('habitual be');
    expect(phrases.some((p) => p.includes(','))).toBe(false);
    expect(new Set(phrases).size).toBe(phrases.length);
  });
});

describe('host note stage directions', () => {
  it('lists the served keywords instead of a fixed set', () => {
    const note = stageDirectionNote(served);
    expect(note).toContain('snort');
    expect(note).toContain('scoff');
    expect(note).not.toContain('*whisper*');
    expect(hostNote(served)).toContain(note);
  });

  it('lists every bundled direction when nothing is served yet', () => {
    const note = stageDirectionNote(FALLBACK_MON_LINGO);
    for (const direction of FALLBACK_MON_LINGO.stageDirections) for (const keyword of direction.keywords) expect(note).toContain(keyword);
  });
});

describe('voice guide in the system prompt', () => {
  const turn = (text: string): TurnParams => ({ system: 'SKILL', messages: [{ role: 'user', content: text }], tools: [] });
  const monNow = 'how you doing?\n\n[Mon now, 4 s ago: dex-003, named Pip, Small, mood content, energy 80%, awake, no needs.]';

  it('reads the Mon from the host’s [Mon now] line', () => {
    expect(monFromTurn(turn(monNow).messages)).toEqual({ mon: { speciesId: 'dex-003', stage: 'Small' }, mood: 'content' });
    expect(monFromTurn(turn('hi').messages)).toBeNull();
  });

  it('appends voiceGuideFor(mon, mood, lingo) for the Mon in this turn', () => {
    const out = withVoiceGuide(turn(monNow), served);
    expect(out.system.startsWith('SKILL')).toBe(true);
    for (const line of voiceGuideFor({ speciesId: 'dex-003', stage: 'Small' }, 'content', served)) expect(out.system).toContain(line);
    expect(out.messages).toEqual(turn(monNow).messages);
  });

  it('appends only the rules for every Mon when the turn names none', () => {
    const out = withVoiceGuide(turn('hi'), served);
    expect(out.system).toContain('No pronoun for a Mon');
    expect(out.system).not.toContain('Canon line');
  });

  it('the Nebius request carries the guide built from the source on behalf of the owner', async () => {
    const inner: ModelBackend = { label: 'nebius', stream: vi.fn(async () => ({}) as never) };
    const source = fixed(served);
    await withServedVoice(inner, source, () => '12').stream(turn(monNow), () => {}, new AbortController().signal);
    expect(source.get).toHaveBeenCalledWith('12');
    const sent = vi.mocked(inner.stream).mock.calls[0]![0];
    expect(sent.system).toContain('facts: True.');
  });
});
