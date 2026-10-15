import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { z } from 'zod';
import type { ModelAuthCheck } from './model-auth.ts';

/**
 * POST /api/model — one model turn for the browser's agent loop, streamed back
 * as server-sent events. The browser sends the conversation and the tool list
 * it got from the MCP server; this process adds the system prompt (the Agent
 * Skill), the model id and the output limits. The browser can't pick any of
 * those, and AWS credentials never leave this process.
 *
 * Wire events (one JSON object per `data:` line):
 *   { type: 'text', delta }            text as it streams
 *   { type: 'message', message }       the complete Anthropic.Message
 *   { type: 'error', message, retry }  plain-language failure
 */

export interface TurnParams {
  readonly system: string;
  readonly messages: Anthropic.MessageParam[];
  readonly tools: Anthropic.Tool[];
}

export interface ModelBackend {
  readonly label: string;
  stream(params: TurnParams, onText: (delta: string) => void, signal: AbortSignal): Promise<Anthropic.Message>;
}

// ------------------------------------------------------------- bedrock ---

export interface BedrockOptions {
  readonly modelId: string;
  readonly region: string | undefined;
  readonly effort: 'low' | 'medium' | 'high';
  readonly maxTokens: number;
}

/**
 * Claude on Amazon Bedrock through the Messages-API endpoint
 * (`bedrock-mantle.<region>.api.aws/anthropic/v1/messages`), SigV4-signed by
 * the Anthropic Bedrock SDK from the default AWS credential chain.
 */
/** The slice of the Bedrock client this backend uses; tests pass a fake. */
export type BedrockMessagesClient = Pick<AnthropicBedrockMantle, 'messages'>;

export function bedrockBackend(opts: BedrockOptions, injected?: BedrockMessagesClient): ModelBackend {
  let client: BedrockMessagesClient | null = injected ?? null;
  const getClient = () => (client ??= new AnthropicBedrockMantle({ awsRegion: opts.region }));
  return {
    label: opts.modelId,
    async stream({ system, messages, tools }, onText, signal) {
      const stream = getClient().messages.stream(
        {
          model: opts.modelId,
          max_tokens: opts.maxTokens,
          // The skill is the stable prefix: cache it with an explicit breakpoint.
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          tools,
          messages,
          output_config: { effort: opts.effort },
        },
        { signal },
      );
      stream.on('text', onText);
      return stream.finalMessage();
    },
  };
}

// ---------------------------------------------------------------- mock ---

/** Tools the scripted model tries first, when present and callable with `{}`. */
const MOCK_TOOL_PREFERENCE = ['get_mon_status', 'check_on_mon'];

function lastUserMessage(messages: readonly Anthropic.MessageParam[]): Anthropic.MessageParam | undefined {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i]?.role === 'user') return messages[i];
  return undefined;
}

function needsNoArgs(tool: Anthropic.Tool): boolean {
  const required = (tool.input_schema as { required?: unknown }).required;
  return !Array.isArray(required) || required.length === 0;
}

let mockSeq = 0;
function mockMessage(content: Anthropic.ContentBlock[], stop: Anthropic.StopReason): Anthropic.Message {
  return {
    id: `msg_mock_${++mockSeq}`,
    type: 'message',
    role: 'assistant',
    model: 'mock',
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 } as Anthropic.Usage,
  } as Anthropic.Message;
}

/**
 * A fixed script for tests and offline runs, labelled as such in the UI.
 * It is not a router: whatever the user says, it calls the same status tool
 * once and then reads the result back. It exists so the MCP path, the views
 * and the transcript can be exercised without AWS.
 */
export function mockBackend(): ModelBackend {
  return {
    label: 'mock',
    async stream({ messages, tools }, onText) {
      const last = lastUserMessage(messages);
      const results = Array.isArray(last?.content)
        ? last.content.filter((b): b is Anthropic.ToolResultBlockParam => b.type === 'tool_result')
        : [];
      if (results.length > 0) {
        const calls = messages.at(-2)?.content;
        const called = Array.isArray(calls) ? calls.find((b): b is Anthropic.ToolUseBlockParam => b.type === 'tool_use')?.name : undefined;
        const first = results[0];
        const body = Array.isArray(first?.content)
          ? first.content.map((c) => (c.type === 'text' ? c.text : '')).join(' ')
          : String(first?.content ?? '');
        const text = first?.is_error
          ? `Scripted test reply. ${called ?? 'The tool'} came back with an error: ${body.slice(0, 160)}`
          : `Scripted test reply. ${called ?? 'The tool'} answered; the card shows what it returned.`;
        onText(text);
        return mockMessage([{ type: 'text', text, citations: null } as Anthropic.TextBlock], 'end_turn');
      }
      const tool =
        MOCK_TOOL_PREFERENCE.map((n) => tools.find((t) => t.name === n)).find((t) => t && needsNoArgs(t)) ??
        tools.find(needsNoArgs);
      if (!tool) {
        const text = 'Scripted test reply. The server offered no tool I can call without arguments.';
        onText(text);
        return mockMessage([{ type: 'text', text, citations: null } as Anthropic.TextBlock], 'end_turn');
      }
      const lead = 'Let me check.';
      onText(lead);
      return mockMessage(
        [
          { type: 'text', text: lead, citations: null } as Anthropic.TextBlock,
          { type: 'tool_use', id: `toolu_mock_${mockSeq}`, name: tool.name, input: {} } as Anthropic.ToolUseBlock,
        ],
        'tool_use',
      );
    },
  };
}

// ------------------------------------------------------------- handler ---

/*
 * Request schemas: only the block shapes the agent loop sends. User turns are
 * text, or tool results holding text and base64 images, and are strict:
 * unknown keys (cache_control, documents, URL sources) are rejected. Assistant
 * turns replay the model's own blocks (text, thinking, redacted_thinking,
 * tool_use); unknown keys on those are stripped rather than rejected, so a
 * field the API adds later can't break replay, and nothing extra reaches
 * Bedrock either way.
 */
const TOOL_USE_ID = /^toolu_[A-Za-z0-9_-]{1,128}$/;
const TextOut = z.strictObject({ type: z.literal('text'), text: z.string().max(20_000) });
const ImageOut = z.strictObject({
  type: z.literal('image'),
  source: z.strictObject({
    type: z.literal('base64'),
    media_type: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
    data: z.string().max(400_000),
  }),
});
const ToolResultIn = z.strictObject({
  type: z.literal('tool_result'),
  tool_use_id: z.string().regex(TOOL_USE_ID),
  content: z.union([z.string().max(20_000), z.array(z.union([TextOut, ImageOut])).max(16)]),
  is_error: z.boolean().optional(),
});
const UserMessageIn = z.strictObject({
  role: z.literal('user'),
  content: z.union([z.string().min(1).max(8000), z.array(z.union([ToolResultIn, TextOut])).min(1).max(32)]),
});
const AssistantBlockIn = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().max(20_000), citations: z.null().optional() }),
  z.object({ type: z.literal('thinking'), thinking: z.string().max(200_000), signature: z.string().max(20_000) }),
  z.object({ type: z.literal('redacted_thinking'), data: z.string().max(200_000) }),
  z.object({
    type: z.literal('tool_use'),
    id: z.string().regex(TOOL_USE_ID),
    name: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
    input: z.record(z.string(), z.unknown()),
  }),
]);
const AssistantMessageIn = z.strictObject({
  role: z.literal('assistant'),
  content: z.array(AssistantBlockIn).min(1).max(64),
});
const MessageIn = z.union([UserMessageIn, AssistantMessageIn]);
const ToolIn = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  description: z.string().max(4000),
  input_schema: z.object({ type: z.literal('object') }).passthrough(),
});
export const TurnRequestSchema = z
  .object({
    messages: z.array(MessageIn).min(1).max(200),
    tools: z.array(ToolIn).max(64),
  })
  .superRefine((req, ctx) => {
    // Every tool_result answers a tool_use from the assistant turn just before it.
    req.messages.forEach((m, i) => {
      if (m.role !== 'user' || typeof m.content === 'string') return;
      const prev = req.messages[i - 1];
      const ids = new Set(
        prev?.role === 'assistant' ? prev.content.flatMap((b) => (b.type === 'tool_use' ? [b.id] : [])) : [],
      );
      for (const b of m.content) {
        if (b.type === 'tool_result' && !ids.has(b.tool_use_id)) {
          ctx.addIssue({ code: 'custom', path: ['messages', i], message: 'tool_result without a matching tool_use' });
        }
      }
    });
  });

export const MAX_BODY_BYTES = 1_000_000;

/**
 * Sliding-window limiter: at most `perMinute` hits in any 60 s, per key, plus a
 * global ceiling across all keys. It tracks at most `maxKeys` keys and evicts
 * the least recently seen one when full, so a flood of new addresses can't
 * wipe everyone's window.
 */
export function createRateLimiter(
  perMinute: number,
  opts: { globalPerMinute?: number; maxKeys?: number; now?: () => number } = {},
) {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 10_000;
  const windows = new Map<string, number[]>();
  let global: number[] = [];
  const recent = (hits: number[], t: number) => hits.filter((h) => t - h < 60_000);
  return (key: string): boolean => {
    const t = now();
    global = recent(global, t);
    if (opts.globalPerMinute !== undefined && global.length >= opts.globalPerMinute) return false;
    const hits = recent(windows.get(key) ?? [], t);
    // Re-insert so Map order is least recently seen first.
    windows.delete(key);
    if (hits.length >= perMinute) {
      windows.set(key, hits);
      return false;
    }
    hits.push(t);
    windows.set(key, hits);
    if (windows.size > maxKeys) windows.delete(windows.keys().next().value as string);
    global.push(t);
    return true;
  };
}

/** The rate-limit key: the socket address, or the first X-Forwarded-For hop only behind a trusted proxy. */
export function clientKey(remoteAddress: string | undefined, forwardedFor: string | null, trustProxy: boolean): string {
  if (trustProxy && forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return remoteAddress ?? 'unknown';
}

export function describeModelError(err: unknown): { message: string; retry: boolean } {
  if (err instanceof Anthropic.RateLimitError) return { message: 'The model is busy. Try again in a few seconds.', retry: true };
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { message: 'This server can’t reach Claude on Bedrock: its AWS credentials were refused.', retry: false };
  }
  if (err instanceof Anthropic.NotFoundError) return { message: 'The configured Bedrock model id wasn’t found in this region.', retry: false };
  if (err instanceof Anthropic.BadRequestError) return { message: 'The model rejected this request. Start a new conversation and try again.', retry: false };
  if (err instanceof Anthropic.APIConnectionError) return { message: 'Couldn’t reach Amazon Bedrock. Check the network and try again.', retry: true };
  if (err instanceof Anthropic.APIError) return { message: 'Amazon Bedrock returned an error. Try again.', retry: true };
  const name = err instanceof Error ? err.name : '';
  if (name === 'CredentialsProviderError' || /credential/i.test(err instanceof Error ? err.message : '')) {
    return { message: 'This server has no AWS credentials for Bedrock. Set them, or run with SIM_MODEL_BACKEND=mock.', retry: false };
  }
  return { message: 'The model call failed. Try again.', retry: true };
}

export interface ModelHandlerDeps {
  readonly backend: ModelBackend;
  readonly system: () => string;
  readonly allowedOrigin: string;
  readonly rateLimit: (key: string) => boolean;
  /** OAuth mode: verifies the person's MCP bearer token. Absent in dev-bypass. */
  readonly auth?: ModelAuthCheck;
}

/** Read a body as text, stopping once it passes `limit` bytes (null = too big). */
async function readCapped(req: Request, limit: number): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function sse(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

/** Web-standard handler so it runs in Node, a Vercel function or a test. */
export function createModelHandler(deps: ModelHandlerDeps) {
  return async function handle(req: Request, clientKey: string): Promise<Response> {
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    // Same-origin only: another site can't spend this server's Bedrock budget.
    if (req.headers.get('origin') !== deps.allowedOrigin) return json(403, { error: 'forbidden_origin' });
    if (deps.auth) {
      try {
        await deps.auth(req.headers.get('authorization'));
      } catch {
        return json(401, { error: 'Sign in again to keep talking.' });
      }
    }
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (declared > MAX_BODY_BYTES) return json(413, { error: 'Conversation too long. Start a new one.' });
    if (!deps.rateLimit(clientKey)) return json(429, { error: 'Too many requests. Wait a minute and try again.' });

    const raw = await readCapped(req, MAX_BODY_BYTES);
    if (raw === null) return json(413, { error: 'Conversation too long. Start a new one.' });
    let parsed: z.infer<typeof TurnRequestSchema>;
    try {
      parsed = TurnRequestSchema.parse(JSON.parse(raw));
    } catch {
      return json(400, { error: 'Malformed model request.' });
    }

    const abort = new AbortController();
    req.signal?.addEventListener('abort', () => abort.abort());
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const message = await deps.backend.stream(
            {
              system: deps.system(),
              messages: parsed.messages as unknown as Anthropic.MessageParam[],
              tools: parsed.tools as unknown as Anthropic.Tool[],
            },
            (delta) => controller.enqueue(sse({ type: 'text', delta })),
            abort.signal,
          );
          controller.enqueue(sse({ type: 'message', message }));
        } catch (err) {
          if (!abort.signal.aborted) {
            console.error('[web-sim] model turn failed', err instanceof Error ? err.message : err);
            controller.enqueue(sse({ type: 'error', ...describeModelError(err) }));
          }
        } finally {
          controller.close();
        }
      },
      cancel() {
        abort.abort();
      },
    });
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
    });
  };
}
