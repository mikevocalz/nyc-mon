import { z } from 'zod';

const Envelope = z.object({ isError: z.boolean().optional(), structuredContent: z.unknown().optional() });
const Action = z.object({ applied: z.boolean().optional(), ok: z.boolean().optional() });

/** What an MCP result proves, as returned by {@link toolOutcome}; returned data alone does not prove a mutation. */
export type ToolOutcome = 'applied' | 'declined' | 'failed' | 'returned' | 'unverified';

/** Classify the server's result, never the model's description of it. Care declines are valid responses with `applied: false`. */
export function toolOutcome(result: unknown): ToolOutcome {
  const envelope = Envelope.safeParse(result);
  if (!envelope.success) return 'unverified';
  if (envelope.data.isError) return 'failed';
  if (envelope.data.structuredContent === undefined) return 'returned';
  const action = Action.safeParse(envelope.data.structuredContent);
  if (!action.success) return 'unverified';
  if (action.data.ok === false) return 'failed';
  if (action.data.applied === false) return 'declined';
  if (action.data.applied === true) return 'applied';
  return 'returned';
}
