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

const STATE_MAX_AGE_MS = 15 * 60_000;
const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%` : null);

/**
 * The Mon's state as the host last read it (the standing card's quiet
 * get_mon_status, or the latest care result), as one line for the model:
 * "[Mon now, 12 s ago: dex-003, Small, mood content, energy 100%, …]". With it the model
 * answers small talk in the right mood without a check_on_mon round trip
 * first, which costs a whole model step plus the tool call (about 1.6 s
 * measured on Bedrock). Null when there is no fresh, readable state.
 */
export function monStateLine(result: { readonly structuredContent?: unknown; readonly isError?: boolean } | undefined, ageMs: number): string | null {
  if (!result || result.isError || ageMs < 0 || ageMs > STATE_MAX_AGE_MS) return null;
  const sc = result.structuredContent as { mon?: { stage?: unknown; speciesId?: unknown; name?: unknown; voice?: { voiceStage?: unknown } | null }; care?: Record<string, unknown>; mood?: unknown; needs?: unknown } | undefined;
  if (!sc?.mon || typeof sc.mood !== 'string') return null;
  const parts: string[] = [];
  // The skill names the form from the dex id (its roster table), so the line carries it.
  if (typeof sc.mon.speciesId === 'string') parts.push(sc.mon.speciesId);
  if (typeof sc.mon.name === 'string' && sc.mon.name) parts.push(`named ${sc.mon.name}`);
  if (typeof sc.mon.stage === 'string') parts.push(sc.mon.stage);
  // Babble or a few words (Decision 32): the model writes to it, and the server's gate may only lower speech by it.
  const voiceStage = sc.mon.voice?.voiceStage;
  if (voiceStage === 'baby-talk' || voiceStage === 'limited') parts.push(`voice ${voiceStage}`);
  parts.push(`mood ${sc.mood}`);
  const care = sc.care;
  if (care) {
    for (const k of ['energy', 'fullness', 'social'] as const) {
      const p = pct(care[k]);
      if (p) parts.push(`${k} ${p}`);
    }
    if (typeof care.activity === 'string') parts.push(care.activity);
  }
  const needs = Array.isArray(sc.needs) ? sc.needs.filter((n): n is string => typeof n === 'string') : [];
  parts.push(needs.length ? `needs ${needs.join(', ')}` : 'no needs');
  return `[Mon now, ${Math.round(ageMs / 1000)} s ago: ${parts.join(', ')}.]`;
}

/** The newest readable Mon state among the turn's tool items (care results carry it too), else the standing card's. */
export function latestMonState<T extends { readonly kind: string; readonly at: number; readonly result?: { readonly structuredContent?: unknown; readonly isError?: boolean } }>(
  items: readonly T[],
  standing: T | null,
  nowMs: number,
): string | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!;
    if (it.kind !== 'tool') continue;
    const line = monStateLine(it.result, nowMs - it.at);
    if (line) return line;
  }
  return standing ? monStateLine(standing.result, nowMs - standing.at) : null;
}

/** The model's copy of a turn with the host's latest Mon state appended (server/skill.ts explains the line). */
export function withMonState(text: string, line: string | null): string {
  return line ? `${text}\n${line}` : text;
}
