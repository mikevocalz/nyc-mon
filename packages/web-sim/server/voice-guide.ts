import type { MonLingo } from '@acme/content/lingo';
import { voiceGuideFor } from '@acme/content/voice';
import { LIFECYCLE_STAGES, MON_MOODS, type LifecycleStage, type MonMood } from '@acme/core';
import type Anthropic from '@anthropic-ai/sdk';
import type { MonLingoSource } from './mon-lingo-source.ts';
import type { ModelBackend, TurnParams } from './model.ts';

/**
 * The served voice guide on every model turn: `voiceGuideFor(mon, mood,
 * lingo)` from `@acme/content/voice`, read against the lingo Payload serves,
 * appended to the system prompt the Nebius request carries.
 *
 * Which Mon: the host's own "[Mon now, … s ago: dex-003, Small, mood content,
 * …]" line on the newest user text (src/client/turnTools.ts monStateLine;
 * server/skill.ts tells the model what it is). Only a dex id, a lifecycle
 * stage and a mood are read from it, each checked against its closed set, so
 * the line can pick which published rules apply but cannot put its own text
 * in the system prompt. Without the line, only the rules for every Mon apply.
 */

const MON_NOW = /\[Mon now, \d+ s ago: ([^\]\n]*)\]/;
const SPECIES = /^dex-\d{1,4}$/;

export interface TurnMon {
  readonly mon: { readonly speciesId: string; readonly stage: LifecycleStage };
  readonly mood: MonMood | undefined;
}

function textOf(message: Anthropic.MessageParam): string {
  if (typeof message.content === 'string') return message.content;
  return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('\n');
}

/** The Mon in the newest user text that carries a "[Mon now …]" line; null when none does. */
export function monFromTurn(messages: readonly Anthropic.MessageParam[]): TurnMon | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    if (message.role !== 'user') continue;
    const line = MON_NOW.exec(textOf(message));
    if (!line) continue;
    // dex id, then "named <name>", then stage, then mood: the id is read from the
    // front and the stage and mood from the back, so a name can't stand in for either.
    const parts = line[1]!.split(',').map((part) => part.trim());
    const fromBack = [...parts].reverse();
    const speciesId = parts.find((part) => SPECIES.test(part));
    const stage = fromBack.find((part): part is LifecycleStage => (LIFECYCLE_STAGES as readonly string[]).includes(part));
    const mood = fromBack.map((part) => /^mood (\S+)$/.exec(part)?.[1]).find((m): m is MonMood => (MON_MOODS as readonly (string | undefined)[]).includes(m));
    if (speciesId === undefined || stage === undefined) return null;
    return { mon: { speciesId, stage }, mood };
  }
  return null;
}

/** The served rules that name no form, bloodline, stage or mood: they apply to every Mon. */
function rulesForEveryMon(lingo: MonLingo): string[] {
  return lingo.guide
    .filter((entry) => entry.speciesId === null && entry.bloodlineId === null && entry.stage === null && entry.mood === null)
    .map((entry) => (entry.category === 'word-palette' ? `${entry.text}: ${entry.meaning} ${entry.policy}` : entry.text));
}

/** `params` with the served voice guide for this turn's Mon appended to the system prompt. */
export function withVoiceGuide(params: TurnParams, lingo: MonLingo): TurnParams {
  const turn = monFromTurn(params.messages);
  const guide = turn === null ? rulesForEveryMon(lingo) : voiceGuideFor(turn.mon, turn.mood, lingo);
  if (guide.length === 0) return params;
  const heading = turn === null
    ? 'How a Mon talks, as published in Payload (no Mon state this turn, so only the rules for every Mon):'
    : `How this Mon talks right now (${turn.mon.speciesId}, ${turn.mon.stage}${turn.mood ? `, mood ${turn.mood}` : ''}), as published in Payload. Write character lines within it:`;
  return { ...params, system: `${params.system}\n\n${heading}\n${guide.map((line) => `- ${line}`).join('\n')}` };
}

/** Reads the served lingo on behalf of the turn's owner and appends its voice guide before the backend runs. */
export function withServedVoice(backend: ModelBackend, source: MonLingoSource, callerId: () => string | undefined): ModelBackend {
  return {
    label: backend.label,
    async stream(params, onText, signal) {
      const owner = callerId();
      const lingo = owner === undefined ? source.latest() : await source.get(owner);
      return backend.stream(withVoiceGuide(params, lingo), onText, signal);
    },
  };
}
