import type { Client, Tool } from '@modelcontextprotocol/client';
import type { ToolCaller } from '../shared/agentLoop.ts';

/** Tools whose input schema takes the simulator-only `speakerHint` (dev-mode MCP servers only). */
export function hintedToolNames(tools: readonly Tool[]): ReadonlySet<string> {
  return new Set(
    tools.filter((t) => 'speakerHint' in ((t.inputSchema as { properties?: object }).properties ?? {})).map((t) => t.name),
  );
}

/**
 * Bind this turn's MCP requests to the same cancellation signal as its model
 * requests. Who is speaking comes from the dev panel, never from the model
 * (SKILL.md: never infer the speaker from words), so the client overwrites any
 * `speakerHint` the model wrote: set to the chosen person, removed for the Caller.
 */
export function createTurnToolCaller(opts: {
  readonly client: Pick<Client, 'callTool'>;
  readonly signal: AbortSignal;
  readonly speakerId?: string;
  readonly hintedTools?: ReadonlySet<string>;
}): ToolCaller {
  return {
    callTool: (name, args) => {
      let sent = args;
      if (opts.hintedTools?.has(name)) {
        const { speakerHint: _ignored, ...rest } = args;
        sent = opts.speakerId ? { ...rest, speakerHint: { personId: opts.speakerId } } : rest;
      }
      return opts.client.callTool({ name, arguments: sent }, { signal: opts.signal });
    },
  };
}

/** The model's copy of a turn, marked with the dev panel speaker (the host note in server/skill.ts explains the line). */
export function withPresenceLine(text: string, speakerName: string): string {
  return speakerName ? `${text}\n\n[Presence: ${speakerName} is speaking.]` : text;
}
