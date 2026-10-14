import type { Client, CallToolResult } from '@modelcontextprotocol/client';
import { describe, expect, it, vi } from 'vitest';
import { createTurnToolCaller } from '../src/client/turnTools.ts';

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
});
