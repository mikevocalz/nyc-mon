import type Anthropic from '@anthropic-ai/sdk';
import type { CallToolResult } from '@modelcontextprotocol/client';

/**
 * The simulator's agent loop: one user utterance in, tool calls against the
 * MCP server, one spoken reply out. The model picks every tool from the Agent
 * Skill and the tool descriptions (ADR 0009); nothing here routes intents.
 *
 * It runs in the browser, which is the MCP client. Each model turn goes
 * through the simulator server, which holds the AWS credentials, the model id
 * and the system prompt.
 */

export interface ModelTurnRequest {
  readonly messages: Anthropic.MessageParam[];
  readonly tools: Anthropic.Tool[];
}

export interface ModelClient {
  /** Run one model turn. `onText` gets text deltas as they stream. */
  streamTurn(req: ModelTurnRequest, onText: (delta: string) => void, signal?: AbortSignal): Promise<Anthropic.Message>;
}

export interface ToolCaller {
  callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
}

export type AgentEvent =
  | { readonly type: 'text'; readonly delta: string }
  | { readonly type: 'tool-start'; readonly id: string; readonly name: string; readonly input: Record<string, unknown> }
  | {
      readonly type: 'tool-result';
      readonly id: string;
      readonly name: string;
      readonly input: Record<string, unknown>;
      readonly result: CallToolResult;
    }
  | { readonly type: 'step-done'; readonly message: Anthropic.Message };

export type TurnOutcome = 'done' | 'refused' | 'step-limit' | 'truncated';

export interface TurnResult {
  /** The full model history after the turn, assistant content unedited. */
  readonly history: Anthropic.MessageParam[];
  /** Text the Mon says this turn (all assistant text blocks, joined). */
  readonly reply: string;
  readonly outcome: TurnOutcome;
}

export interface RunTurnOptions {
  readonly model: ModelClient;
  readonly mcp: ToolCaller;
  readonly tools: Anthropic.Tool[];
  readonly history: readonly Anthropic.MessageParam[];
  readonly userText: string;
  readonly onEvent?: (event: AgentEvent) => void;
  readonly signal?: AbortSignal;
  /** Model turns allowed per utterance before the loop stops. */
  readonly maxSteps?: number;
}

/** MCP CallToolResult → the `content` of a Claude tool_result block. */
export function toolResultContent(result: CallToolResult): Anthropic.ToolResultBlockParam['content'] {
  const blocks: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = [];
  for (const item of result.content ?? []) {
    switch (item.type) {
      case 'text':
        blocks.push({ type: 'text', text: item.text });
        break;
      case 'image':
        if (/^image\/(png|jpeg|gif|webp)$/.test(item.mimeType)) {
          blocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: item.mimeType as Anthropic.Base64ImageSource['media_type'],
              data: item.data,
            },
          });
        }
        break;
      case 'resource':
        if ('text' in item.resource && typeof item.resource.text === 'string') {
          blocks.push({ type: 'text', text: item.resource.text });
        }
        break;
      case 'resource_link':
        blocks.push({ type: 'text', text: `Linked resource: ${item.name} (${item.uri})` });
        break;
      default:
        break;
    }
  }
  // structuredContent is the authoritative data; add it when no text mirrors it.
  const hasText = blocks.some((b) => b.type === 'text');
  if (result.structuredContent !== undefined && !hasText) {
    blocks.push({ type: 'text', text: JSON.stringify(result.structuredContent) });
  }
  if (blocks.length === 0) blocks.push({ type: 'text', text: result.isError ? 'The tool failed.' : 'Done.' });
  return blocks;
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export async function runAgentTurn(opts: RunTurnOptions): Promise<TurnResult> {
  const { model, mcp, tools, onEvent, signal } = opts;
  const maxSteps = opts.maxSteps ?? 8;
  const history: Anthropic.MessageParam[] = [...opts.history, { role: 'user', content: opts.userText }];
  const replyParts: string[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const message = await model.streamTurn(
      { messages: history, tools },
      (delta) => onEvent?.({ type: 'text', delta }),
      signal,
    );
    onEvent?.({ type: 'step-done', message });
    // Append the assistant content exactly as returned (thinking blocks
    // included): later turns must replay it unedited.
    // An empty turn (a refusal with no text) is not replayable; leave it out.
    if (message.content.length > 0) history.push({ role: 'assistant', content: message.content });
    for (const block of message.content) if (block.type === 'text') replyParts.push(block.text);

    if (message.stop_reason === 'refusal') return { history, reply: replyParts.join('\n'), outcome: 'refused' };
    if (message.stop_reason === 'pause_turn') continue;

    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (toolUses.length === 0) return { history, reply: replyParts.join('\n'), outcome: 'done' };
    // A tool input cut off at max_tokens can still parse; never run it.
    if (message.stop_reason === 'max_tokens') return { history, reply: replyParts.join('\n'), outcome: 'truncated' };

    // Run every call from this step, then return all results in one user message.
    const results = await Promise.all(
      toolUses.map(async (use): Promise<Anthropic.ToolResultBlockParam> => {
        const input = (use.input ?? {}) as Record<string, unknown>;
        onEvent?.({ type: 'tool-start', id: use.id, name: use.name, input });
        let result: CallToolResult;
        if (!tools.some((t) => t.name === use.name)) {
          result = errorResult(`No tool named ${use.name} is available.`);
        } else {
          try {
            result = await mcp.callTool(use.name, input);
          } catch (err) {
            result = errorResult(err instanceof Error ? err.message : String(err));
          }
        }
        onEvent?.({ type: 'tool-result', id: use.id, name: use.name, input, result });
        return {
          type: 'tool_result',
          tool_use_id: use.id,
          content: toolResultContent(result),
          ...(result.isError ? { is_error: true } : {}),
        };
      }),
    );
    history.push({ role: 'user', content: results });
  }
  return { history, reply: replyParts.join('\n'), outcome: 'step-limit' };
}
