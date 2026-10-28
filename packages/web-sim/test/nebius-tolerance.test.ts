import { describe, expect, it, vi } from 'vitest';
import { nebiusBackend, NebiusError, NVIDIA_MODELS, sameNvidiaModel, toNebiusRequest } from '../server/nebius.ts';
import type { TurnParams } from '../server/model.ts';

// Tolerance for valid first live responses (mock transport; not live qualification).
const tools: TurnParams['tools'] = [
  { name: 'get_mon_status', description: 'Read state', input_schema: { type: 'object', properties: {} } },
  { name: 'feed_mon', description: 'Feed', input_schema: { type: 'object', properties: {} } },
];
const input: TurnParams = { system: 'Use only permitted care tools.', messages: [{ role: 'user', content: 'Feed my Mon.' }], tools };
const completion = (overrides: Record<string, unknown> = {}) => ({ id: 'chatcmpl_t', model: NVIDIA_MODELS[0],
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Done.' } }],
  usage: { prompt_tokens: 12, completion_tokens: 8 }, ...overrides });
const call = (id: string, name = 'feed_mon') => ({ id, type: 'function', function: { name, arguments: '{}' } });
const transport = (body: unknown) => vi.fn<(input: unknown, init?: RequestInit) => Promise<Response>>(async () => Response.json(body));
const run = (body: unknown, onReceipt = vi.fn()) =>
  nebiusBackend({ apiKey: 'key' }, { fetch: transport(body), onReceipt }).stream(input, vi.fn(), new AbortController().signal);

describe('returned model alias', () => {
  it.each([
    ['nvidia/Nemotron-3_5-Lightning', 'nvidia/Nemotron-3_5-Lightning', true],
    ['nvidia/Nemotron-3_5-Lightning', 'nvidia/nemotron-3.5-lightning', true],
    ['nvidia/Nemotron-3_5-Lightning', 'nvidia/Nemotron-3_5-Lightning-fast', true],
    ['nvidia/Nemotron-3_5-Lightning', 'NVIDIA/Nemotron-3-5-Lightning', true],
    ['nvidia/Nemotron-3_5-Lightning', 'nvidia/nemotron-3-super-120b-a12b', false],
    ['nvidia/Nemotron-3_5-Lightning', 'Nemotron-3_5-Lightning', false],
    ['nvidia/Nemotron-3_5-Lightning', 'meta/Nemotron-3_5-Lightning', false],
    ['nvidia/Nemotron-3_5-Lightning', 'anthropic/claude', false],
    ['nvidia/Nemotron-3_5-Lightning', 'nvidia/Nemotron-3', false],
    ['nvidia/Nemotron-3_5-Lightning', '', false],
  ] as const)('%s returned as %s → %s', (requested, returned, same) => {
    expect(sameNvidiaModel(requested, returned)).toBe(same);
  });

  it('accepts an alias of the same NVIDIA model and records both ids in the receipt', async () => {
    const onReceipt = vi.fn();
    const result = await run(completion({ model: 'nvidia/nemotron-3.5-lightning' }), onReceipt);
    expect(result.model).toBe('nvidia/nemotron-3.5-lightning');
    expect(onReceipt).toHaveBeenCalledWith(expect.objectContaining({
      requestedModel: 'nvidia/Nemotron-3_5-Lightning', returnedModel: 'nvidia/nemotron-3.5-lightning' }));
  });

  it('still rejects another model family and a missing response id', async () => {
    await expect(run(completion({ model: 'nvidia/nemotron-3-super-120b-a12b' }))).rejects.toThrow(NebiusError);
    await expect(run(completion({ id: '' }))).rejects.toThrow(NebiusError);
    await expect(run(completion({ id: undefined }))).rejects.toThrow(NebiusError);
  });
});

describe('finish reasons with tool calls', () => {
  it('accepts tool calls reported with finish_reason stop', async () => {
    const result = await run(completion({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: null, tool_calls: [call('c1')] } }] }));
    expect(result.stop_reason).toBe('tool_use');
    expect(result.content.filter((b) => b.type === 'tool_use')).toHaveLength(1);
  });
  it('still rejects finish_reason tool_calls with no calls, and calls cut off by the length limit', async () => {
    await expect(run(completion({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: 'x' } }] }))).rejects.toThrow(NebiusError);
    await expect(run(completion({ choices: [{ finish_reason: 'length', message: { role: 'assistant', content: null, tool_calls: [call('c1')] } }] }))).rejects.toThrow(NebiusError);
  });
});

describe('one tool call per step', () => {
  it('does not send parallel_tool_calls, which the Nebius docs do not list', async () => {
    const fetchFn = transport(completion());
    await nebiusBackend({ apiKey: 'key' }, { fetch: fetchFn }).stream(input, vi.fn(), new AbortController().signal);
    const body = JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty('parallel_tool_calls');
    expect(body).toMatchObject({ tool_choice: 'auto' });
  });
  it('runs only the first of several calls; the receipt counts what the provider returned', async () => {
    const onReceipt = vi.fn();
    const result = await run(completion({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null,
      tool_calls: [call('c1', 'get_mon_status'), call('c2', 'feed_mon')] } }] }), onReceipt);
    const uses = result.content.filter((b) => b.type === 'tool_use');
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatchObject({ name: 'get_mon_status' });
    expect(onReceipt).toHaveBeenCalledWith(expect.objectContaining({ toolCalls: 2 }));
  });
  it('still refuses an invented tool anywhere in the returned calls', async () => {
    await expect(run(completion({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null,
      tool_calls: [call('c1', 'get_mon_status'), call('c2', 'delete_everything')] } }] }))).rejects.toThrow(NebiusError);
  });
});

describe('reasoning-only or empty replies', () => {
  it.each([
    ['stop', { role: 'assistant', content: null, reasoning_content: 'thinking about the Mon' }],
    ['length', { role: 'assistant', content: '', reasoning_content: 'still thinking' }],
    ['stop', { role: 'assistant', content: '   ' }],
  ] as const)('finish %s with no answer is an EMPTY error, not a fake reply, and emits no receipt', async (finish, message) => {
    const onReceipt = vi.fn();
    const pending = run(completion({ choices: [{ finish_reason: finish, message }] }), onReceipt);
    await expect(pending).rejects.toMatchObject({ name: 'NebiusError', code: 'EMPTY' });
    expect(onReceipt).not.toHaveBeenCalled();
  });
  it('never forwards reasoning text as the reply', async () => {
    const onText = vi.fn();
    const result = await nebiusBackend({ apiKey: 'key' }, { fetch: transport(completion({ choices: [{ finish_reason: 'stop',
      message: { role: 'assistant', content: 'Fed.', reasoning_content: 'private chain of thought' } }] })) })
      .stream(input, onText, new AbortController().signal);
    expect(JSON.stringify(result.content)).not.toContain('private chain');
    expect(onText).toHaveBeenCalledWith('Fed.');
  });
});

describe('tool result messages', () => {
  it('carry the tool name, as in the Nebius function-calling example', () => {
    const req = toNebiusRequest({ ...input, messages: [...input.messages,
      { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_a', name: 'feed_mon', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_a', content: '{"applied":true}' }] }] });
    expect(req.messages.at(-1)).toEqual({ role: 'tool', tool_call_id: 'toolu_a', name: 'feed_mon', content: '{"applied":true}' });
  });
});

// Shape of a real Token Factory reply (2026-10-28 live probe): every optional
// message field is present and null when unused.
describe('null optional fields from the live API', () => {
  const nulls = { refusal: null, annotations: null, audio: null, function_call: null, reasoning: null, reasoning_content: null };
  it('accepts a plain answer with tool_calls: null', async () => {
    const result = await run(completion({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Hi, Caller!', tool_calls: null, ...nulls } }] }));
    expect(result.content).toEqual([expect.objectContaining({ type: 'text', text: 'Hi, Caller!' })]);
  });
  it('accepts a tool call with content: null and the other fields null', async () => {
    const result = await run(completion({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [call('c1')], ...nulls } }] }));
    expect(result.stop_reason).toBe('tool_use');
  });
});

// finish_reason content_filter is documented (OpenAPI 20261022). It is a provider refusal,
// not a malformed response, and must never become a tool call or a fabricated answer.
describe('content filter', () => {
  it('reports a filtered reply as FILTERED, with no receipt', async () => {
    const onReceipt = vi.fn();
    const error = await run(completion({ choices: [{ finish_reason: 'content_filter', message: { role: 'assistant', content: null, tool_calls: null } }] }), onReceipt).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NebiusError);
    expect((error as NebiusError).code).toBe('FILTERED');
    expect(onReceipt).not.toHaveBeenCalled();
  });
});
