import { z } from 'zod';
import { IdSchema } from '@acme/core';

/**
 * Machine-readable tool error codes (ADR 0005 §4). The server never returns
 * dialogue — the personality layer (Agent Skill + model, ADR 0009) turns codes
 * into character voice. `PERMISSION_DENIED_NOT_CALLER` is the Callah-refusal
 * hook: it must stay structured so the refusal lands on the *Mon*, not Alexa.
 */
export const TOOL_ERROR_CODES = [
  'NOT_LINKED',
  'MON_NOT_FOUND',
  'PRESENCE_REQUIRED',
  'PERMISSION_DENIED_NOT_CALLER',
  'NOTHING_INCUBATING',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
] as const;
export const ToolErrorCodeSchema = z.enum(TOOL_ERROR_CODES);
export type ToolErrorCode = z.infer<typeof ToolErrorCodeSchema>;

/** Resolved acting voice — see auth/actor.ts. Wire keeps 'trainer' for the
 * build prompt's contract; it means the Caller (ADR 0008). */
export const ActingVoiceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('trainer'), callerId: IdSchema }),
  z.object({ kind: z.literal('familiar'), callerId: IdSchema, personId: IdSchema, confidence: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('unknown'), callerId: IdSchema }),
]);
export type ActingVoice = z.infer<typeof ActingVoiceSchema>;

export const ToolErrorSchema = z.object({
  code: ToolErrorCodeSchema,
  message: z.string(),
  actingVoice: ActingVoiceSchema.optional(),
  requiredPermissions: z.array(z.string()).optional(),
  monId: IdSchema.optional(),
});
export type ToolError = z.infer<typeof ToolErrorSchema>;

export function toolError(err: ToolError): { isError: true; structuredContent: { error: ToolError } } {
  return { isError: true, structuredContent: { error: err } };
}

export function permissionDenied(
  actingVoice: ActingVoice,
  requiredPermissions: readonly string[],
  monId?: string,
): { isError: true; structuredContent: { error: ToolError } } {
  return toolError({
    code: 'PERMISSION_DENIED_NOT_CALLER',
    message: 'The acting voice is not the Caller and lacks the required permissions.',
    actingVoice,
    requiredPermissions: [...requiredPermissions],
    monId,
  });
}
