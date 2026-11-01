import type { Client, CallToolResult } from '@modelcontextprotocol/client';
import { describe, expect, it, vi } from 'vitest';
import { createTurnToolCaller, hintedToolNames, withPresenceLine, latestMonState, monStateLine, withMonState } from '../src/client/turnTools.ts';

const result: CallToolResult = { content: [{ type: 'text', text: 'Done.' }] };

describe('turn MCP adapter', () => {
  it('passes the turn signal as the installed v2 client request options', async () => {
    const controller = new AbortController();
    const callTool = vi.fn<Client['callTool']>(async () => result);
    const caller = createTurnToolCaller({ client: { callTool }, signal: controller.signal });

    await expect(caller.callTool('feed_mon', { intentId: 'intent-1' })).resolves.toBe(result);
    expect(callTool).toHaveBeenCalledExactlyOnceWith(
      { name: 'feed_mon', arguments: { intentId: 'intent-1' } },
      { signal: controller.signal },
    );
    controller.abort();
    expect(callTool.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('keeps a new turn independent of an earlier cancelled turn', async () => {
    const first = new AbortController();
    const next = new AbortController();
    const callTool = vi.fn<Client['callTool']>(async () => result);
    const previous = createTurnToolCaller({ client: { callTool }, signal: first.signal });
    const current = createTurnToolCaller({ client: { callTool }, signal: next.signal });
    await previous.callTool('get_mon_status', {});
    first.abort();
    await current.callTool('feed_mon', {});

    expect(callTool.mock.calls[0]?.[1]?.signal).toBe(first.signal);
    expect(callTool.mock.calls[1]?.[1]?.signal).toBe(next.signal);
    expect(next.signal.aborted).toBe(false);
  });

  it('sends the dev panel speaker as speakerHint and drops one the model wrote', async () => {
    const callTool = vi.fn<Client['callTool']>(async () => result);
    const hintedTools = new Set(['feed_mon']);
    const signal = new AbortController().signal;
    const asJames = createTurnToolCaller({ client: { callTool }, signal, speakerId: 'person-james', hintedTools });
    const asCaller = createTurnToolCaller({ client: { callTool }, signal, hintedTools });

    await asJames.callTool('feed_mon', { intentId: 'i' });
    await asCaller.callTool('feed_mon', { intentId: 'i', speakerHint: { personId: 'person-james' } });
    await asJames.callTool('get_mon_status', {});

    expect(callTool.mock.calls.map((c) => c[0].arguments)).toEqual([
      { intentId: 'i', speakerHint: { personId: 'person-james' } },
      { intentId: 'i' },
      {},
    ]);
  });

  it('finds the tools that declare speakerHint', () => {
    const tool = (name: string, properties: Record<string, Record<string, never>>) => ({ name, inputSchema: { type: 'object' as const, properties } });
    expect([...hintedToolNames([tool('feed_mon', { speakerHint: {} }), tool('get_mon_status', {})])]).toEqual(['feed_mon']);
  });

  it('marks the model’s copy of a turn with the dev panel speaker', () => {
    expect(withPresenceLine('Can I feed it?', 'James')).toBe('Can I feed it?\n\n[Presence: James is speaking.]');
    expect(withPresenceLine('Can I feed it?', '')).toBe('Can I feed it?');
  });
});

describe('monStateLine', () => {
  const status = {
    structuredContent: {
      mon: { monId: 'mon_ratti', name: null, speciesId: 'dex-003', stage: 'Small' },
      care: { energy: 0.9989, fullness: 0.4991, social: 0.5994, activity: 'awake' },
      mood: 'content',
      needs: [],
    },
  };

  it('puts the card state on one line the model can use instead of check_on_mon', () => {
    expect(monStateLine(status, 8_000)).toBe('[Mon now, 8 s ago: dex-003, Small, mood content, energy 100%, fullness 50%, social 60%, awake, no needs.]');
  });

  it('says nothing for an error, an egg, or stale state', () => {
    expect(monStateLine({ structuredContent: { mon: { speciesId: 'dex-001', stage: 'Egg', voice: { voiceStage: 'baby-talk' } }, mood: 'content' } }, 2_000))
      .toBe('[Mon now, 2 s ago: dex-001, Egg, voice baby-talk, mood content, no needs.]');
    expect(monStateLine({ structuredContent: { mon: { speciesId: 'dex-003', stage: 'Small', voice: { voiceStage: 'full' } }, mood: 'content' } }, 2_000))
      .toBe('[Mon now, 2 s ago: dex-003, Small, mood content, no needs.]');
    expect(monStateLine({ ...status, isError: true }, 1_000)).toBeNull();
    expect(monStateLine({ structuredContent: { egg: { eggId: 'e1' } } }, 1_000)).toBeNull();
    expect(monStateLine(status, 16 * 60_000)).toBeNull();
    expect(monStateLine(undefined, 0)).toBeNull();
  });

  it('prefers the newest care result over the standing card', () => {
    const fed = { structuredContent: { ...status.structuredContent, mood: 'happy', needs: ['social'] } };
    const items = [
      { kind: 'tool', at: 1_000, result: fed },
      { kind: 'mon', at: 2_000 },
    ];
    expect(latestMonState(items, { kind: 'tool', at: 0, result: status }, 3_000)).toContain('mood happy');
    expect(latestMonState(items, { kind: 'tool', at: 0, result: status }, 3_000)).toContain('needs social');
    expect(latestMonState([], { kind: 'tool', at: 0, result: status }, 3_000)).toContain('mood content');
    expect(withMonState('hi', null)).toBe('hi');
    expect(withMonState('hi', '[Mon now]')).toBe('hi\n[Mon now]');
  });
});
