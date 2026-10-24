import { describe, expect, it, vi } from 'vitest';
import { nebiusBackend, NebiusError, NVIDIA_MODELS, toNebiusRequest } from '../server/nebius.ts';
import type { TurnParams } from '../server/model.ts';

const input: TurnParams = { system: 'Use only permitted care tools.', messages: [{ role: 'user', content: 'Check my Mon.' }],
  tools: [{ name: 'get_mon_status', description: 'Read state', input_schema: { type: 'object', properties: {} } }] };
const completion = (overrides: Record<string, unknown> = {}) => ({ id: 'chatcmpl_test', model: NVIDIA_MODELS[0],
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Here is the state.' } }],
  usage: { prompt_tokens: 12, completion_tokens: 8 }, ...overrides });
const transport = (body: unknown, status = 200) => vi.fn<typeof fetch>(async () => Response.json(body, { status }));
const signal = () => new AbortController().signal;

describe('Nebius NVIDIA adapter (mock transport; not live qualification)', () => {
  it('uses the allowlisted HTTPS endpoint and a server-side key, returning a provider receipt', async () => {
    const fetchFn = transport(completion()); const onReceipt = vi.fn(); const onText = vi.fn();
    const result = await nebiusBackend({ apiKey: 'test-key' }, { fetch: fetchFn, onReceipt }).stream(input, onText, signal());
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://api.tokenfactory.us-central1.nebius.com/v1/chat/completions');
    const init = fetchFn.mock.calls[0]?.[1];
    expect(init?.redirect).toBe('error');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-key');
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: NVIDIA_MODELS[0], stream: false, parallel_tool_calls: false });
    expect(result.stop_reason).toBe('end_turn'); expect(onText).toHaveBeenCalledWith('Here is the state.');
    expect(onReceipt).toHaveBeenCalledWith(expect.objectContaining({ provider: 'nebius-token-factory', returnedModel: NVIDIA_MODELS[0] }));
    expect(JSON.stringify(onReceipt.mock.calls)).not.toContain('test-key');
  });
  it('preserves tool calls, error outcomes and IDs across the next turn', async () => {
    const fetchFn = transport(completion({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null,
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_mon_status', arguments: '{}' } }] } }] }));
    const first = await nebiusBackend({ apiKey: 'key' }, { fetch: fetchFn }).stream(input, vi.fn(), signal());
    const tool = first.content.find((b) => b.type === 'tool_use');
    if (!tool || tool.type !== 'tool_use') throw new Error('expected tool');
    expect(tool.id).toMatch(/^toolu_nb_[a-f0-9]{64}$/);
    const req = toNebiusRequest({ ...input, messages: [...input.messages,
      { role: 'assistant', content: first.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: tool.id, is_error: true, content: 'not-permitted' }] }] });
    expect(req.messages.at(-1)).toEqual({ role: 'tool', tool_call_id: tool.id, content: '{"is_error":true,"result":"not-permitted"}' });
  });
  it('rejects unmatched tool results', () => {
    expect(() => toNebiusRequest({ ...input, messages: [{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'missing', content: 'ok' }] }] })).toThrow(NebiusError);
  });
  it('rejects missing results before a new request', () => {
    expect(() => toNebiusRequest({ ...input, messages: [{ role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_a', name: 'get_mon_status', input: {} }] }] })).toThrow(NebiusError);
  });
  it('rejects a model outside the reviewed NVIDIA catalog', () => {
    expect(() => nebiusBackend({ apiKey: 'key', modelId: 'claude' as never })).toThrow(NebiusError);
  });
  it('does not permit an arbitrary host to receive the key', () => {
    expect(() => nebiusBackend({ apiKey: 'key', baseUrl: 'https://example.com/v1' as never })).toThrow(NebiusError);
  });
  it('requires a nonempty key', () => expect(() => nebiusBackend({ apiKey: ' ' })).toThrow(NebiusError));
  it('does not accept another returned model', async () => {
    await expect(nebiusBackend({ apiKey: 'key' }, { fetch: transport(completion({ model: 'other' })) }).stream(input, vi.fn(), signal())).rejects.toThrow(NebiusError);
  });
  it('refuses invented tool names', async () => {
    const body = completion({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null,
      tool_calls: [{ id: 'x', type: 'function', function: { name: 'delete_everything', arguments: '{}' } }] } }] });
    await expect(nebiusBackend({ apiKey: 'key' }, { fetch: transport(body) }).stream(input, vi.fn(), signal())).rejects.toThrow(NebiusError);
  });
  it.each(['[]', '{broken', 'null'])('rejects malformed or nonobject arguments: %s', async (args) => {
    const body = completion({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null,
      tool_calls: [{ id: 'x', type: 'function', function: { name: 'get_mon_status', arguments: args } }] } }] });
    await expect(nebiusBackend({ apiKey: 'key' }, { fetch: transport(body) }).stream(input, vi.fn(), signal())).rejects.toThrow(NebiusError);
  });
  it('fails closed on a provider error without leaking its body or retrying elsewhere', async () => {
    const fetchFn = transport({ message: 'sensitive provider body' }, 401);
    const pending = nebiusBackend({ apiKey: 'key' }, { fetch: fetchFn }).stream(input, vi.fn(), signal());
    await expect(pending).rejects.toThrow('Nebius http error (401)'); expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('aborts before sending an already cancelled turn', async () => {
    const fetchFn = transport(completion()); const ctrl = new AbortController(); ctrl.abort();
    await expect(nebiusBackend({ apiKey: 'key' }, { fetch: fetchFn }).stream(input, vi.fn(), ctrl.signal)).rejects.toThrow();
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('rejects malformed response envelopes', async () => {
    await expect(nebiusBackend({ apiKey: 'key' }, { fetch: transport({}) }).stream(input, vi.fn(), signal())).rejects.toThrow(NebiusError);
  });
});
