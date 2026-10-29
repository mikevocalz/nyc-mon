import type { MonLingo } from '@acme/content/lingo';
import { voiceGuideFor } from '@acme/content/voice';
import type { LifecycleStage, MonMood } from '@acme/core';
import type Anthropic from '@anthropic-ai/sdk';
import type { MonLingoSource } from './mon-lingo-source.ts';
import type { ModelBackend, TurnParams } from './model.ts';
import type { MonRoster } from './mon-roster.ts';
import { resolveTurnVoice, sightingFromLine, streamGated, turnVoice, type TurnVoice } from './voice-stage-gate.ts';

/**
 * The served voice guide on every model turn: `voiceGuideFor(mon, mood,
 * lingo, voiceStage)` from `@acme/content/voice`, read against the lingo
 * Payload serves, appended to the system prompt the Nebius request carries.
 *
 * Which Mon: the newest one the conversation reports (voice-stage-gate.ts
 * `turnVoice`), from a tool result or the host's "[Mon now, … s ago: dex-003,
 * Small, mood content, …]" line (src/client/turnTools.ts monStateLine;
 * server/skill.ts tells the model what it is). Only a dex id, a lifecycle
 * stage, a mood and a voice stage are read, each checked against its closed
 * set, so the conversation can pick which published rules apply but cannot
 * put its own text in the system prompt. Without a Mon, only the rules for
 * every Mon apply.
 *
 * For an Egg or a first-day Baby the guide is the babble rules. The guide is
 * a hint; the gate in voice-stage-gate.ts is what keeps words out.
 */

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
    const seen = sightingFromLine(textOf(message));
    if (seen === null) continue;
    return { mon: { speciesId: seen.speciesId!, stage: seen.stage }, mood: seen.mood };
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
export function withVoiceGuide(params: TurnParams, lingo: MonLingo, turn: TurnVoice | null = turnVoice(params.messages, Date.now())): TurnParams {
  // A babbling Mon gets the babble rules even when no form is known (the shared syllables then).
  const mon = turn === null ? null : turn.speciesId !== undefined ? { speciesId: turn.speciesId, stage: turn.stage } : turn.voiceStage === 'baby-talk' ? { speciesId: '', stage: turn.stage } : null;
  const guide = mon === null ? rulesForEveryMon(lingo) : voiceGuideFor(mon, turn!.mood, lingo, turn!.voiceStage);
  if (guide.length === 0) return params;
  const heading = mon === null
    ? 'How a Mon talks, as published in Payload (no Mon state this turn, so only the rules for every Mon):'
    : `How this Mon talks right now (${mon.speciesId || 'form unknown'}, ${mon.stage}${turn!.mood ? `, mood ${turn!.mood}` : ''}${turn!.voiceStage === 'full' ? '' : `, voice ${turn!.voiceStage}`}), as published in Payload. Write character lines within it:`;
  return { ...params, system: `${params.system}\n\n${heading}\n${guide.map((line) => `- ${line}`).join('\n')}` };
}

/**
 * Reads the served lingo on behalf of the turn's owner, appends its voice
 * guide before the backend runs, and gates the reply by voice stage. The
 * voice stage comes from `roster` (the server's lookup of the owner's Mons),
 * lowered by whatever the conversation claims.
 */
export function withServedVoice(
  backend: ModelBackend,
  source: MonLingoSource,
  callerId: () => string | undefined,
  roster: () => Promise<MonRoster>,
  now: () => number = Date.now,
): ModelBackend {
  return {
    label: backend.label,
    async stream(params, onText, signal) {
      const owner = callerId();
      const lingo = owner === undefined ? source.latest() : await source.get(owner);
      const t = now();
      const turn = resolveTurnVoice(turnVoice(params.messages, t), await roster(), t);
      return streamGated(backend, withVoiceGuide(params, lingo, turn), onText, signal, turn, lingo);
    },
  };
}
