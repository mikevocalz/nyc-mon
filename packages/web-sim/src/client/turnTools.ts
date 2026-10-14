import type { Client } from '@modelcontextprotocol/client';
import type { ToolCaller } from '../shared/agentLoop.ts';

/** Bind this turn's MCP requests to the same cancellation signal as its model requests. */
export function createTurnToolCaller(opts: {
  readonly client: Pick<Client, 'callTool'>;
  readonly signal: AbortSignal;
}): ToolCaller {
  return {
    callTool: (name, args) => opts.client.callTool({ name, arguments: args }, { signal: opts.signal }),
  };
}
