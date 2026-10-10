import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { runAgentTurn, toolResultContent, type AgentEvent, type ModelClient } from '../src/shared/agentLoop.ts';
import { bedrockBackend, type BedrockMessagesClient } from '../server/model.ts';

const TOOLS: Anthropic.Tool[] = [
  { name: 'get_mon_status', description: 'Status', input_schema: { type: 'object', properties: {} } },
  { name: 'feed_mon', description: 'Feed', input_schema: { type: 'object', properties: { itemId: { type: 'string' } } } },
];

function msg(content: unknown[], stop: Anthropic.StopReason): Anthropic.Message {
  return {
    id: 'msg',
    type: 'message',
    role: 'assistant',
    model: 'test',
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Anthropic.Message;
}

/** A model client that plays back fixed turns and records what it was sent. */
function scripted(turns: Anthropic.Message[]) {
  const seen: Anthropic.MessageParam[][] = [];
  const client: ModelClient = {
    async streamTurn(req, onText) {
      seen.push(structuredClone(req.messages));
      const next = turns.shift();
      if (!next) throw new Error('script ran out');
      for (const b of next.content) if (b.type === 'text') onText(b.text);
      return next;
    },
  };
  return { client, seen };
}

const STATUS: CallToolResult = {
  content: [{ type: 'text', text: '{"fullness":0.2}' }],
  structuredContent: { care: { fullness: 0.2 } },
};

describe('runAgentTurn', () => {
  it('tool call → MCP call → final text', async () => {
    const thinking = { type: 'thinking', thinking: '', signature: 'sig-1' };
    const { client, seen } = scripted([
      msg([thinking, { type: 'tool_use', id: 'tu1', name: 'get_mon_status', input: {} }], 'tool_use'),
      msg([{ type: 'text', text: 'Yo, I could eat.' }], 'end_turn'),
    ]);
    const callTool = vi.fn(async () => STATUS);
    const events: AgentEvent[] = [];

    const out = await runAgentTurn({
      model: client,
      mcp: { callTool },
      tools: TOOLS,
      history: [],
      userText: 'You hungry?',
      onEvent: (e) => events.push(e),
    });

    expect(callTool).toHaveBeenCalledWith('get_mon_status', {});
    expect(out.outcome).toBe('done');
    expect(out.reply).toBe('Yo, I could eat.');
    // Second model call carries the tool result, and the assistant turn unedited.
    const second = seen[1]!;
    expect(second[1]).toEqual({ role: 'assistant', content: [thinking, { type: 'tool_use', id: 'tu1', name: 'get_mon_status', input: {} }] });
    expect(second[2]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'tu1', content: [{ type: 'text', text: '{"fullness":0.2}' }] }],
    });
    expect(events.map((e) => e.type)).toEqual(['step-done', 'tool-start', 'tool-result', 'text', 'step-done']);
    expect(out.history).toHaveLength(4);
  });

  it('returns every parallel result in one user message and flags errors', async () => {
    const { client, seen } = scripted([
      msg(
        [
          { type: 'tool_use', id: 'a', name: 'get_mon_status', input: {} },
          { type: 'tool_use', id: 'b', name: 'feed_mon', input: { itemId: 'rare-1' } },
        ],
        'tool_use',
      ),
      msg([{ type: 'text', text: 'You ain’t my Callah.' }], 'end_turn'),
    ]);
    const callTool = vi.fn(async (name: string): Promise<CallToolResult> =>
      name === 'feed_mon'
        ? { content: [{ type: 'text', text: 'Only the Caller can do that.' }], structuredContent: { code: 'PERMISSION_DENIED_NOT_CALLER' }, isError: true }
        : STATUS,
    );
    await runAgentTurn({ model: client, mcp: { callTool }, tools: TOOLS, history: [], userText: 'Use Mike’s rare item.' });
    const results = seen[1]![2]!.content as Anthropic.ToolResultBlockParam[];
    expect(results.map((r) => [r.tool_use_id, r.is_error ?? false])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('turns a thrown MCP error and an unknown tool into error results, not crashes', async () => {
    const { client, seen } = scripted([
      msg(
        [
          { type: 'tool_use', id: 'x', name: 'get_mon_status', input: {} },
          { type: 'tool_use', id: 'y', name: 'not_listed', input: {} },
        ],
        'tool_use',
      ),
      msg([{ type: 'text', text: 'Server’s down, I can’t check.' }], 'end_turn'),
    ]);
    const callTool = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    const out = await runAgentTurn({ model: client, mcp: { callTool }, tools: TOOLS, history: [], userText: 'Status?' });
    expect(callTool).toHaveBeenCalledTimes(1);
    const results = seen[1]![2]!.content as Anthropic.ToolResultBlockParam[];
    expect(results.every((r) => r.is_error)).toBe(true);
    expect(JSON.stringify(results)).toContain('No tool named not_listed');
    expect(out.outcome).toBe('done');
  });

  it('stops on refusal and on a truncated tool call without running tools', async () => {
    const callTool = vi.fn(async () => STATUS);
    const refused = await runAgentTurn({
      model: scripted([msg([], 'refusal')]).client,
      mcp: { callTool },
      tools: TOOLS,
      history: [],
      userText: 'x',
    });
    expect(refused.outcome).toBe('refused');
    const truncated = await runAgentTurn({
      model: scripted([msg([{ type: 'tool_use', id: 't', name: 'feed_mon', input: { itemId: 'ra' } }], 'max_tokens')]).client,
      mcp: { callTool },
      tools: TOOLS,
      history: [],
      userText: 'x',
    });
    expect(truncated.outcome).toBe('truncated');
    expect(callTool).not.toHaveBeenCalled();
  });

  it('stops at the step limit', async () => {
    const loop = Array.from({ length: 3 }, (_, i) => msg([{ type: 'tool_use', id: `t${i}`, name: 'get_mon_status', input: {} }], 'tool_use'));
    const out = await runAgentTurn({
      model: scripted(loop).client,
      mcp: { callTool: async () => STATUS },
      tools: TOOLS,
      history: [],
      userText: 'x',
      maxSteps: 3,
    });
    expect(out.outcome).toBe('step-limit');
  });
});

describe('toolResultContent', () => {
  it('uses structuredContent when no text mirrors it', () => {
    expect(toolResultContent({ content: [], structuredContent: { a: 1 } })).toEqual([{ type: 'text', text: '{"a":1}' }]);
  });
  it('keeps supported images and drops unsupported ones', () => {
    const out = toolResultContent({
      content: [
        { type: 'image', data: 'AAAA', mimeType: 'image/png' },
        { type: 'image', data: 'AAAA', mimeType: 'image/tiff' },
      ],
    });
    expect(out).toEqual([{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }]);
  });
});

describe('bedrockBackend with a mocked Bedrock client', () => {
  it('sends the skill as a cached system block, the model id and effort, and streams text', async () => {
    const final = msg([{ type: 'text', text: 'Hey.' }], 'end_turn');
    const stream = vi.fn((_params: unknown, _opts: unknown) => {
      let onText: ((d: string) => void) | undefined;
      return {
        on(event: string, cb: (d: string) => void) {
          if (event === 'text') onText = cb;
          return this;
        },
        async finalMessage() {
          onText?.('Hey.');
          return final;
        },
      };
    });
    const fake = { messages: { stream } } as unknown as BedrockMessagesClient;
    const backend = bedrockBackend({ modelId: 'anthropic.claude-opus-5-5', region: 'us-east-1', effort: 'low', maxTokens: 4096 }, fake);
    const deltas: string[] = [];
    const out = await backend.stream(
      { system: 'SKILL', messages: [{ role: 'user', content: 'hi' }], tools: TOOLS },
      (d) => deltas.push(d),
      new AbortController().signal,
    );
    expect(out).toBe(final);
    expect(deltas).toEqual(['Hey.']);
    const params = stream.mock.calls[0]![0] as Record<string, unknown>;
    expect(params).toMatchObject({
      model: 'anthropic.claude-opus-5-5',
      max_tokens: 4096,
      system: [{ type: 'text', text: 'SKILL', cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      output_config: { effort: 'low' },
    });
    // Opus 5.5 rejects a disabled thinking config; the backend never sends one.
    expect(params).not.toHaveProperty('thinking');
  });

  it('drives the agent loop end to end: Bedrock tool_use → MCP → final text', async () => {
    const turns = [
      msg([{ type: 'tool_use', id: 'tu', name: 'get_mon_status', input: {} }], 'tool_use'),
      msg([{ type: 'text', text: 'Belly’s low. Feed me?' }], 'end_turn'),
    ];
    const fake = {
      messages: {
        stream: () => ({
          on() {
            return this;
          },
          finalMessage: async () => turns.shift(),
        }),
      },
    } as unknown as BedrockMessagesClient;
    const backend = bedrockBackend({ modelId: 'm', region: 'us-east-1', effort: 'low', maxTokens: 1024 }, fake);
    const model: ModelClient = { streamTurn: (req, onText, signal) => backend.stream({ system: 's', ...req }, onText, signal ?? new AbortController().signal) };
    const callTool = vi.fn(async () => STATUS);
    const out = await runAgentTurn({ model, mcp: { callTool }, tools: TOOLS, history: [], userText: 'Hungry?' });
    expect(callTool).toHaveBeenCalledOnce();
    expect(out.reply).toBe('Belly’s low. Feed me?');
  });
});
