import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { FALLBACK_MON_LINGO } from '@acme/content/lingo';
import { babbleInventory } from '@acme/content/voice';
import { BABY_TALK_MS, isBabble, speechTokens, type LifecycleStage, type VoiceStage } from '@acme/core';
import { createModelHandler, type ModelBackend } from '../server/model.ts';
import type { MonLingoSource } from '../server/mon-lingo-source.ts';
import type { MonRoster, ServerMon } from '../server/mon-roster.ts';
import { resolveTurnVoice, turnVoice, withVoiceStageGate } from '../server/voice-stage-gate.ts';
import { withServedVoice } from '../server/voice-guide.ts';

/**
 * Decision 32 on the model path: whatever the model writes for an Egg or a
 * first-day Baby leaves the server as babble, a later Baby keeps at most two
 * words, and Small and up pass through. The voice stage is computed here from
 * the server's own roster (the Caller's Mons as /v1 or MCP report them);
 * whatever the conversation claims can only lower it.
 */

const ORIGIN = 'http://localhost:5180';
const NOW = Date.UTC(2026, 9, 29, 12);
const LOVE = 'Hello Callah, I love you';

interface Seen {
  stage: LifecycleStage;
  speciesId?: string;
  hatchedAt?: number;
  claimed?: VoiceStage;
}

/** A conversation whose last step is a Mon tool result, shaped like the MCP server's `success()`. */
function conversation(mon: Seen, text = 'say something'): Anthropic.MessageParam[] {
  const speciesId = mon.speciesId ?? 'dex-001';
  const data = {
    mon: {
      monId: 'mon_1', name: 'Pip', speciesId, stage: mon.stage,
      ...(mon.hatchedAt === undefined ? {} : { hatchedAt: mon.hatchedAt }),
      voice: { lineageId: 'dex-001/female/1', stage: mon.stage, ...(mon.claimed ? { voiceStage: mon.claimed } : {}), voiced: true },
    },
    mood: 'content',
  };
  return [
    { role: 'user', content: text },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_mon_status', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'text', text: JSON.stringify(data) }] }] },
  ];
}

/** A fake model that streams `reply` word by word. */
function fakeModel(reply: string): ModelBackend {
  return {
    label: 'fake',
    async stream(_params, onText) {
      for (const word of reply.split(/(?<= )/)) onText(word);
      return {
        id: 'msg_fake_1', type: 'message', role: 'assistant', model: 'fake',
        content: [{ type: 'text', text: reply, citations: null }],
        stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
      } as unknown as Anthropic.Message;
    },
  };
}

const fixed: MonLingoSource = { get: async () => FALLBACK_MON_LINGO, latest: () => FALLBACK_MON_LINGO, etag: () => null };

/** The server's roster for a Mon the tests describe (lineage dex-001/female/1). */
const rosterOf = (mon: Seen): MonRoster => [{ speciesId: mon.speciesId ?? 'dex-001', stage: mon.stage, hatchedAt: mon.hatchedAt ?? null, voiceLineageId: 'dex-001/female/1' } satisfies ServerMon];

/** One model turn through the real handler with the served voice and the gate, as nvidia-main.ts mounts them. */
async function turn(messages: Anthropic.MessageParam[], reply: string, roster: MonRoster) {
  const backend = withServedVoice(fakeModel(reply), fixed, () => undefined, async () => roster, () => NOW);
  const handle = createModelHandler({ backend, system: () => 'SKILL', allowedOrigin: ORIGIN, rateLimit: () => true });
  const res = await handle(
    new Request(`${ORIGIN}/api/model`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ messages, tools: [] }) }),
    'ip',
  );
  const events = (await res.text()).split('\n\n').filter(Boolean).map((line) => JSON.parse(line.slice('data: '.length)) as { type: string; delta?: string; message?: Anthropic.Message });
  const deltas = events.filter((e) => e.type === 'text').map((e) => e.delta ?? '');
  const final = events.find((e) => e.type === 'message')?.message;
  const finalText = (final?.content ?? []).map((b) => (b.type === 'text' ? b.text : '')).join(' ');
  return { deltas, streamed: deltas.join(''), finalText };
}

const inventory = (stage: LifecycleStage) => babbleInventory({ lineageId: 'dex-001/female/1' }, stage, FALLBACK_MON_LINGO);
const original = speechTokens(LOVE);

describe('the model turn is gated by voice stage', () => {
  it('an Egg answers in babble only, sent once, with no word of the model’s line', async () => {
    const out = await turn(conversation({ stage: 'Egg' }), LOVE, rosterOf({ stage: 'Egg' }));
    expect(out.deltas).toHaveLength(1);
    for (const text of [out.streamed, out.finalText]) {
      expect(isBabble(text, inventory('Egg'))).toBe(true);
      for (const token of speechTokens(text)) expect(original).not.toContain(token);
    }
    expect(out.streamed).toBe(out.finalText);
  });

  it('a Baby in its first day answers in babble only', async () => {
    const mon: Seen = { stage: 'Baby', hatchedAt: NOW - 60 * 60_000 };
    const out = await turn(conversation(mon), LOVE, rosterOf(mon));
    expect(isBabble(out.streamed, inventory('Baby'))).toBe(true);
    for (const token of speechTokens(out.streamed)) expect(original).not.toContain(token);
  });

  it('a Baby after 24 h has its sentence replaced', async () => {
    const mon: Seen = { stage: 'Baby', hatchedAt: NOW - BABY_TALK_MS - 60_000 };
    const out = await turn(conversation(mon), LOVE, rosterOf(mon));
    expect(out.streamed).not.toContain('Callah');
    expect(out.streamed).not.toContain('love');
    expect(out.streamed).toBe(out.finalText);
  });

  it('a Small passes through and keeps streaming token by token', async () => {
    const mon: Seen = { stage: 'Small', speciesId: 'dex-002' };
    const out = await turn(conversation(mon), LOVE, rosterOf(mon));
    expect(out.streamed).toBe(LOVE);
    expect(out.deltas.length).toBeGreaterThan(1);
  });

  it('ignores a client claiming full speech for an Egg', async () => {
    const out = await turn(conversation({ stage: 'Egg', claimed: 'full' }), LOVE, rosterOf({ stage: 'Egg' }));
    expect(isBabble(out.streamed, inventory('Egg'))).toBe(true);
  });

  it('ignores a client that says its Egg is a Max: the server’s roster decides', async () => {
    const out = await turn(conversation({ stage: 'Max', speciesId: 'dex-004', claimed: 'full' }), LOVE, rosterOf({ stage: 'Egg' }));
    expect(isBabble(out.streamed, inventory('Egg'))).toBe(true);
    for (const token of speechTokens(out.streamed)) expect(original).not.toContain(token);
  });

  it('babbles when the server cannot find out the Mon, or the Caller has none', async () => {
    for (const roster of [null, []] as const) {
      const out = await turn(conversation({ stage: 'Small', speciesId: 'dex-002' }), LOVE, roster);
      expect(isBabble(out.streamed, inventory('Baby'))).toBe(true);
    }
  });

  it('babbles for a lineage that is not one of the Caller’s Mons', () => {
    const claim = turnVoice(conversation({ stage: 'Small', speciesId: 'dex-002' }), NOW)!;
    const stranger = resolveTurnVoice({ ...claim, lineageId: 'dex-008/male/2' }, rosterOf({ stage: 'Small', speciesId: 'dex-002' }), NOW);
    expect(stranger.voiceStage).toBe('baby-talk');
  });

  it('a client claim can lower a Small to babble', async () => {
    const out = await turn(conversation({ stage: 'Small', speciesId: 'dex-002', claimed: 'baby-talk' }), LOVE, rosterOf({ stage: 'Small', speciesId: 'dex-002' }));
    expect(isBabble(out.streamed, inventory('Small'))).toBe(true);
  });

  it('ignores a client claiming limited for a first-day Baby, and honours a claim that lowers', () => {
    const fresh = turnVoice(conversation({ stage: 'Baby', hatchedAt: NOW - 1000, claimed: 'limited' }), NOW);
    expect(fresh?.voiceStage).toBe('baby-talk');
    const lowered = turnVoice(conversation({ stage: 'Small', claimed: 'baby-talk' }), NOW);
    expect(lowered?.voiceStage).toBe('baby-talk');
  });

  it('reads the Mon from the host’s [Mon now] line, with hatchedAt from an earlier result for the same form', () => {
    const messages: Anthropic.MessageParam[] = [
      ...conversation({ stage: 'Baby', hatchedAt: NOW - 1000 }),
      { role: 'assistant', content: [{ type: 'text', text: 'Ba-gu!' }] },
      { role: 'user', content: 'hi again\n[Mon now, 3 s ago: dex-001, named Pip, Baby, mood content, no needs.]' },
    ];
    expect(turnVoice(messages, NOW)).toMatchObject({ speciesId: 'dex-001', stage: 'Baby', voiceStage: 'baby-talk' });
    // The same line after the first day: limited.
    expect(turnVoice(messages, NOW + BABY_TALK_MS)?.voiceStage).toBe('limited');
  });

  it('a [Mon now] line can carry a voice claim that lowers, never raises', () => {
    const line = (voice: string) => [{ role: 'user', content: `hi\n[Mon now, 3 s ago: dex-002, Small, mood content, voice ${voice}, no needs.]` }] as Anthropic.MessageParam[];
    expect(turnVoice(line('baby-talk'), NOW)?.voiceStage).toBe('baby-talk');
    expect(turnVoice([{ role: 'user', content: 'hi\n[Mon now, 3 s ago: dex-001, Egg, mood content, voice full, no needs.]' }], NOW)?.voiceStage).toBe('baby-talk');
  });

  it('no Mon in the conversation: nothing to gate', () => {
    expect(turnVoice([{ role: 'user', content: 'hi' }], NOW)).toBeNull();
  });

  it('the same model message gates to the same babble every time (seeded by message and block)', async () => {
    const a = await turn(conversation({ stage: 'Egg' }), LOVE, rosterOf({ stage: 'Egg' }));
    const b = await turn(conversation({ stage: 'Egg' }), LOVE, rosterOf({ stage: 'Egg' }));
    expect(a.streamed).toBe(b.streamed);
  });

  it('every text block of a tool step is gated, and tool_use blocks pass through', async () => {
    const backend: ModelBackend = {
      label: 'fake',
      stream: vi.fn(async (_p, onText: (d: string) => void) => {
        onText('Let me check.');
        return {
          id: 'msg_fake_2', type: 'message', role: 'assistant', model: 'fake', stop_reason: 'tool_use', stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
          content: [{ type: 'text', text: 'Let me check.', citations: null }, { type: 'tool_use', id: 'toolu_2', name: 'check_on_mon', input: {} }],
        } as unknown as Anthropic.Message;
      }),
    };
    const seen: string[] = [];
    const msg = await withVoiceStageGate(backend, () => FALLBACK_MON_LINGO, async () => rosterOf({ stage: 'Egg' }), () => NOW).stream(
      { system: 'S', messages: conversation({ stage: 'Egg' }), tools: [] }, (d) => seen.push(d), new AbortController().signal,
    );
    expect(msg.content[1]).toMatchObject({ type: 'tool_use', id: 'toolu_2' });
    const text = (msg.content[0] as Anthropic.TextBlock).text;
    expect(isBabble(text, inventory('Egg'))).toBe(true);
    expect(seen).toEqual([text]);
  });

  it('the prompt carries the babble guide for a babbling Mon', async () => {
    const inner: ModelBackend = { label: 'n', stream: vi.fn(async () => ({ id: 'm', content: [] }) as unknown as Anthropic.Message) };
    await withServedVoice(inner, fixed, () => undefined, async () => rosterOf({ stage: 'Egg' }), () => NOW).stream(
      { system: 'SKILL', messages: conversation({ stage: 'Egg' }), tools: [] }, () => {}, new AbortController().signal,
    );
    const sent = vi.mocked(inner.stream).mock.calls[0]![0];
    expect(sent.system).toContain('baby talk only');
    expect(sent.system).toContain('No real words');
  });
});
