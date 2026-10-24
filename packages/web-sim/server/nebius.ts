import { createHash } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ModelBackend, TurnParams } from './model.ts';

/** Official model IDs, checked against Nebius's catalog on 2026-10-24. */
export const NVIDIA_MODELS = [
  'nvidia/Nemotron-3_5-Lightning',
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/Nemotron-3-Ultra-550b-a55b',
] as const;
export const NEBIUS_ENDPOINTS = [
  'https://api.tokenfactory.us-central1.nebius.com/v1',
  'https://api.tokenfactory.nebius.com/v1',
] as const;
export const NebiusOptionsSchema = z.object({
  apiKey: z.string().trim().min(1),
  baseUrl: z.enum(NEBIUS_ENDPOINTS).default(NEBIUS_ENDPOINTS[0]),
  modelId: z.enum(NVIDIA_MODELS).default(NVIDIA_MODELS[0]),
  maxTokens: z.number().int().min(256).max(16000).default(4096),
  timeoutMs: z.number().int().min(1000).max(120000).default(60000),
});
export type NebiusOptions = z.input<typeof NebiusOptionsSchema>;
export interface NebiusReceipt {
  readonly provider: 'nebius-token-factory';
  readonly endpoint: string;
  readonly requestedModel: string;
  readonly returnedModel: string;
  readonly responseId: string;
  readonly requestId: string | null;
  readonly completedAt: string;
  readonly latencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly toolCalls: number;
}
export class NebiusError extends Error {
  override readonly name = 'NebiusError';
  constructor(readonly code: 'CONFIG' | 'INPUT' | 'HTTP' | 'RESPONSE' | 'TIMEOUT', readonly status?: number) {
    super(`Nebius ${code.toLowerCase()} error${status === undefined ? '' : ` (${status})`}. No alternate provider was used.`);
  }
}

const Text = z.object({ type: z.literal('text'), text: z.string().max(200000) });
const ToolUse = z.object({
  type: z.literal('tool_use'), id: z.string().min(1).max(134),
  name: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/), input: z.record(z.string(), z.unknown()),
});
const ToolResult = z.object({
  type: z.literal('tool_result'), tool_use_id: z.string().min(1).max(134),
  content: z.union([z.string().max(200000), z.array(Text).max(32)]).optional(),
  is_error: z.boolean().optional(),
});
const History = z.array(z.discriminatedUnion('role', [
  z.object({ role: z.literal('user'), content: z.union([z.string(), z.array(z.union([Text, ToolResult]))]) }),
  z.object({ role: z.literal('assistant'), content: z.union([z.string(), z.array(z.union([Text, ToolUse]))]) }),
])).max(200);
const Tools = z.array(z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/), description: z.string().optional(),
  input_schema: z.object({ type: z.literal('object') }).passthrough(),
})).max(64);
interface FunctionCall { id: string; type: 'function'; function: { name: string; arguments: string } }
type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: FunctionCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

/** Preserve tool-result IDs and reject unsupported images/thinking rather than silently losing context. */
export function toNebiusRequest(params: TurnParams) {
  const history = History.safeParse(params.messages);
  const parsedTools = Tools.safeParse(params.tools);
  if (!history.success || !parsedTools.success) throw new NebiusError('INPUT');
  const messages: ChatMessage[] = [{ role: 'system', content: params.system }];
  let pending = new Set<string>();
  for (const item of history.data) {
    if (item.role === 'assistant') {
      if (pending.size) throw new NebiusError('INPUT');
      const blocks = typeof item.content === 'string' ? [{ type: 'text' as const, text: item.content }] : item.content;
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      const calls: FunctionCall[] = blocks.filter((b) => b.type === 'tool_use').map((b) => ({
        id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input) },
      }));
      pending = new Set(calls.map((c) => c.id));
      if (pending.size !== calls.length) throw new NebiusError('INPUT');
      messages.push({ role: 'assistant', content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      const blocks = typeof item.content === 'string' ? [{ type: 'text' as const, text: item.content }] : item.content;
      const texts: string[] = [];
      for (const b of blocks) {
        if (b.type === 'text') texts.push(b.text);
        else {
          if (!pending.delete(b.tool_use_id)) throw new NebiusError('INPUT');
          const body = typeof b.content === 'string' ? b.content : (b.content ?? []).map((t) => t.text).join('\n');
          messages.push({ role: 'tool', tool_call_id: b.tool_use_id,
            content: b.is_error ? JSON.stringify({ is_error: true, result: body }) : body });
        }
      }
      if (pending.size) throw new NebiusError('INPUT');
      if (texts.length) messages.push({ role: 'user', content: texts.join('\n') });
    }
  }
  if (pending.size) throw new NebiusError('INPUT');
  return { messages, tools: parsedTools.data.map((t) => ({
    type: 'function' as const, function: { name: t.name, description: t.description ?? '', parameters: t.input_schema },
  })) };
}

const Completion = z.object({
  id: z.string().min(1).max(256), model: z.string().min(1).max(256),
  choices: z.array(z.object({
    finish_reason: z.enum(['stop', 'length', 'tool_calls']),
    message: z.object({
      role: z.literal('assistant'), content: z.string().max(200000).nullable().optional(),
      tool_calls: z.array(z.object({
        id: z.string().min(1).max(256), type: z.literal('function'),
        function: z.object({ name: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/), arguments: z.string().max(200000) }),
      })).max(16).optional(),
    }),
  })).length(1),
  usage: z.object({ prompt_tokens: z.number().int().nonnegative(), completion_tokens: z.number().int().nonnegative() }),
});
async function readCompletion(response: Response): Promise<unknown> {
  if (!response.body) throw new NebiusError('RESPONSE');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1000000) { await reader.cancel(); throw new NebiusError('RESPONSE'); }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof NebiusError) throw error;
    throw new NebiusError('RESPONSE');
  } finally { reader.releaseLock(); }
}

/** Buffered completion, then the existing SSE message protocol; NOT token-by-token Nebius streaming. */
export function nebiusBackend(options: NebiusOptions, dependencies: {
  fetch?: typeof fetch; onReceipt?: (receipt: NebiusReceipt) => void;
} = {}): ModelBackend {
  const parsed = NebiusOptionsSchema.safeParse(options);
  if (!parsed.success) throw new NebiusError('CONFIG');
  const opts = parsed.data;
  return {
    label: opts.modelId,
    async stream(params, onText, signal) {
      signal.throwIfAborted();
      const input = toNebiusRequest(params);
      const started = performance.now();
      const deadline = AbortSignal.timeout(opts.timeoutMs);
      let response: Response;
      try {
        response = await (dependencies.fetch ?? fetch)(`${opts.baseUrl}/chat/completions`, {
          method: 'POST', redirect: 'error',
          headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
          signal: AbortSignal.any([signal, deadline]),
          body: JSON.stringify({ model: opts.modelId, messages: input.messages, max_tokens: opts.maxTokens,
            stream: false, ...(input.tools.length ? { tools: input.tools, tool_choice: 'auto', parallel_tool_calls: false } : {}) }),
        });
      } catch {
        signal.throwIfAborted();
        throw new NebiusError(deadline.aborted ? 'TIMEOUT' : 'HTTP');
      }
      if (!response.ok) { await response.body?.cancel(); throw new NebiusError('HTTP', response.status); }
      const decoded = Completion.safeParse(await readCompletion(response));
      if (!decoded.success || decoded.data.model !== opts.modelId) throw new NebiusError('RESPONSE');
      signal.throwIfAborted();
      const result = decoded.data;
      const choice = result.choices[0];
      if (!choice) throw new NebiusError('RESPONSE');
      const calls = choice.message.tool_calls ?? [];
      if ((choice.finish_reason === 'tool_calls') !== (calls.length > 0)) throw new NebiusError('RESPONSE');
      if (new Set(calls.map((c) => c.id)).size !== calls.length) throw new NebiusError('RESPONSE');
      const allowed = new Set(input.tools.map((t) => t.function.name));
      const content: Anthropic.ContentBlock[] = [];
      if (choice.message.content) content.push({ type: 'text', text: choice.message.content, citations: null });
      for (const call of calls) {
        if (!allowed.has(call.function.name)) throw new NebiusError('RESPONSE');
        let value: unknown;
        try { value = JSON.parse(call.function.arguments); } catch { throw new NebiusError('RESPONSE'); }
        const args = z.record(z.string(), z.unknown()).safeParse(value);
        if (!args.success) throw new NebiusError('RESPONSE');
        content.push({ type: 'tool_use', name: call.function.name, input: args.data, caller: { type: 'direct' },
          id: `toolu_nb_${createHash('sha256').update(`${result.id}:${call.id}`).digest('hex')}` });
      }
      if (!content.length) throw new NebiusError('RESPONSE');
      const receipt: NebiusReceipt = {
        provider: 'nebius-token-factory', endpoint: opts.baseUrl, requestedModel: opts.modelId,
        returnedModel: result.model, responseId: result.id,
        requestId: response.headers.get('x-request-id')?.slice(0,256) ?? null,
        completedAt: new Date().toISOString(), latencyMs: Math.round(performance.now() - started),
        inputTokens: result.usage.prompt_tokens, outputTokens: result.usage.completion_tokens, toolCalls: calls.length,
      };
      dependencies.onReceipt?.(receipt);
      if (choice.message.content) onText(choice.message.content);
      return {
        id: result.id, type: 'message', role: 'assistant', model: result.model, content,
        container: null, diagnostics: null, stop_details: null,
        stop_reason: calls.length ? 'tool_use' : choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn', stop_sequence: null,
        usage: { input_tokens: result.usage.prompt_tokens, output_tokens: result.usage.completion_tokens,
          cache_creation: null, cache_creation_input_tokens: null, cache_read_input_tokens: null,
          inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null, speed: null },
      };
    },
  };
}
