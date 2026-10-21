import type { Client, CallToolResult } from '@modelcontextprotocol/client';
import { describe, expect, it, vi } from 'vitest';
import { createTurnToolCaller, hintedToolNames, withPresenceLine } from '../src/client/turnTools.ts';

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
