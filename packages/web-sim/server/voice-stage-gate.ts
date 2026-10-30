import type { MonLingo } from '@acme/content/lingo';
import { gateMonLine, type MonVoiceRef } from '@acme/content/voice';
import {
  LIFECYCLE_STAGES, MON_MOODS, capVoiceStage, voiceStage as voiceStageAt,
  type LifecycleStage, type MonMood, type VoiceStage,
} from '@acme/core';
import type Anthropic from '@anthropic-ai/sdk';
import type { ModelBackend } from './model.ts';
import { serverVoice, type MonRoster } from './mon-roster.ts';

/**
 * Decision 32 on the model path. An Egg and a Baby in its first 24 hours
 * babble; a Baby after that says the family sound plus at most two words;
 * Small and up talk. The voice guide in the prompt asks the model for this,
 * and this module enforces it: every text block of the model's message goes
 * through `gateMonLine` before it leaves the server.
 *
 * Which Mon, and how much speech it has, comes from the server's own lookup
 * (mon-roster.ts): the Mon's real lifecycle stage and `hatchedAt`, so the
 * voice stage is `voiceStage(mon, now)` computed here. The conversation the
 * browser sends (the newest tool result's `mon`, or the host's "[Mon now …]"
 * line) is only a claim: it can pick which of the Caller's Mons is talking by
 * lineage and can lower the voice stage, never raise it. When the lookup
 * fails or names no Mon, the reply is babble.
 *
 * For `baby-talk` and `limited` the reply is buffered and sent as one gated
 * delta: a streamed word would already be on screen and in the voice before
 * the gate could refuse it. `full` streams as before.
 */

export interface TurnVoice {
  readonly speciesId: string | undefined;
  /** The lineage the conversation reported; undefined when it reported none. */
  readonly lineageId: string | undefined;
  readonly stage: LifecycleStage;
  readonly mood: MonMood | undefined;
  readonly voiceStage: VoiceStage;
  /** The ref the gate runs with; its `voiceStage` is the server's. */
  readonly ref: MonVoiceRef;
}

interface Sighting {
  readonly speciesId: string | undefined;
  readonly stage: LifecycleStage;
  readonly mood: MonMood | undefined;
  readonly lineageId: string | undefined;
  readonly hatchedAt: number | undefined;
  readonly claimed: VoiceStage | undefined;
}

const MON_NOW = /\[Mon now, \d+ s ago: ([^\]\n]*)\]/;
const SPECIES = /^dex-\d{1,4}$/;
const LINEAGE = /^dex-\d{1,4}\/(?:female|male)\/[1-9]$/;
const VOICE_STAGES: readonly VoiceStage[] = ['baby-talk', 'limited', 'full'];
const RANK: Readonly<Record<VoiceStage, number>> = { 'baby-talk': 0, limited: 1, full: 2 };

const isStage = (v: unknown): v is LifecycleStage => (LIFECYCLE_STAGES as readonly unknown[]).includes(v);
const isMood = (v: unknown): v is MonMood => (MON_MOODS as readonly unknown[]).includes(v);
const isVoiceStage = (v: unknown): v is VoiceStage => (VOICE_STAGES as readonly unknown[]).includes(v);
const str = (v: unknown, re: RegExp) => (typeof v === 'string' && re.test(v) ? v : undefined);

/** The host's "[Mon now …]" line: dex id from the front, stage, mood and voice claim from the back, so a name can't stand in for any. */
export function sightingFromLine(text: string): Sighting | null {
  const line = MON_NOW.exec(text);
  if (!line) return null;
  const parts = line[1]!.split(',').map((part) => part.trim());
  const fromBack = [...parts].reverse();
  const speciesId = parts.find((part) => SPECIES.test(part));
  const stage = fromBack.find(isStage);
  if (speciesId === undefined || stage === undefined) return null;
  const mood = fromBack.map((part) => /^mood (\S+)$/.exec(part)?.[1]).find(isMood);
  const claimed = fromBack.map((part) => /^voice (\S+)$/.exec(part)?.[1]).find(isVoiceStage);
  return { speciesId, stage, mood, lineageId: undefined, hatchedAt: undefined, claimed };
}

/** A tool result's Mon: the MCP server's `success()` text is the structured content as JSON. */
function sightingFromJson(text: string): Sighting | null {
  const t = text.trim();
  if (!t.startsWith('{')) return null;
  let data: unknown;
  try {
    data = JSON.parse(t);
  } catch {
    return null;
  }
  const { mon, mood } = (data ?? {}) as { mon?: unknown; mood?: unknown };
  if (typeof mon !== 'object' || mon === null) return null;
  const m = mon as { speciesId?: unknown; stage?: unknown; hatchedAt?: unknown; voice?: unknown };
  if (!isStage(m.stage)) return null;
  const voice = (typeof m.voice === 'object' && m.voice !== null ? m.voice : {}) as { lineageId?: unknown; voiceStage?: unknown };
  return {
    speciesId: str(m.speciesId, SPECIES),
    stage: m.stage,
    mood: isMood(mood) ? mood : undefined,
    lineageId: str(voice.lineageId, LINEAGE),
    hatchedAt: typeof m.hatchedAt === 'number' && Number.isFinite(m.hatchedAt) ? m.hatchedAt : undefined,
    claimed: isVoiceStage(voice.voiceStage) ? voice.voiceStage : undefined,
  };
}

/** Every Mon one user message reports, newest last. */
function sightingsIn(message: Anthropic.MessageParam): Sighting[] {
  if (message.role !== 'user') return [];
  if (typeof message.content === 'string') {
    const s = sightingFromLine(message.content);
    return s ? [s] : [];
  }
  const out: Sighting[] = [];
  for (const block of message.content) {
    if (block.type === 'text') {
      const s = sightingFromLine(block.text);
      if (s) out.push(s);
    } else if (block.type === 'tool_result' && !block.is_error) {
      const parts = typeof block.content === 'string' ? [block.content] : (block.content ?? []).map((c) => (c.type === 'text' ? c.text : ''));
      for (const part of parts) {
        const s = sightingFromJson(part);
        if (s) out.push(s);
      }
    }
  }
  return out;
}

const lower = (a: VoiceStage, b: VoiceStage): VoiceStage => (RANK[a] <= RANK[b] ? a : b);

/**
 * The Mon the conversation claims and the voice stage that claim allows at
 * `now`; null when it names no Mon. A claim only: {@link resolveTurnVoice}
 * holds it to the server's roster.
 */
export function turnVoice(messages: readonly Anthropic.MessageParam[], now: number): TurnVoice | null {
  const all = messages.flatMap(sightingsIn);
  const newest = all.at(-1);
  if (newest === undefined) return null;
  // A "[Mon now]" line carries no hatch time or lineage: take them from the newest
  // earlier report of the same form. A Mon keeps both for life.
  const same = [...all].reverse().find((s) => s.speciesId === newest.speciesId && (s.hatchedAt !== undefined || s.lineageId !== undefined));
  const hatchedAt = newest.hatchedAt ?? same?.hatchedAt;
  const lineageId = newest.lineageId ?? same?.lineageId;
  const computed = voiceStageAt({ stage: newest.stage, hatchedAt: hatchedAt ?? null }, now);
  const voiceStage = lower(computed, capVoiceStage(newest.stage, newest.claimed));
  // Without a lineage the gate still needs the line key for the family sound; only that part is read.
  const ref: MonVoiceRef = {
    lineageId: lineageId ?? `${newest.speciesId ?? 'dex-001'}/female/1`,
    stage: newest.stage,
    voiceStage,
    ...(newest.mood ? { mood: newest.mood } : {}),
  };
  return { speciesId: newest.speciesId, lineageId, stage: newest.stage, mood: newest.mood, voiceStage, ref };
}

/**
 * The turn's voice as the server allows it: the roster's Mon (the claimed
 * lineage, else the companion) at its real stage, lowered by the claim. No
 * roster, no Mon, or a lineage that is not the Caller's: babble.
 */
export function resolveTurnVoice(claim: TurnVoice | null, roster: MonRoster, now: number): TurnVoice {
  const server = serverVoice(roster, { lineageId: claim?.lineageId, stage: claim?.stage, voiceStage: claim?.voiceStage }, now);
  const speciesId = server.mon?.speciesId ?? claim?.speciesId;
  const stage = server.mon?.stage ?? claim?.stage ?? 'Egg';
  const lineageId = server.mon?.voiceLineageId ?? claim?.lineageId ?? `${speciesId ?? 'dex-001'}/female/1`;
  const mood = claim?.mood;
  const ref: MonVoiceRef = { lineageId, stage, voiceStage: server.voiceStage, ...(mood ? { mood } : {}) };
  return { speciesId, lineageId, stage, mood, voiceStage: server.voiceStage, ref };
}

/** `message` with every text block gated for `turn`. The babble seed is the message id and block index, so a replay says the same. */
export function gateMessage(message: Anthropic.Message, turn: TurnVoice, lingo: MonLingo): Anthropic.Message {
  if (turn.voiceStage === 'full') return message;
  const content = message.content.map((block, i) =>
    block.type === 'text' ? { ...block, text: gateMonLine(block.text, turn.ref, lingo, { seed: `${message.id}|${i}` }).text } : block,
  );
  return { ...message, content };
}

/** Runs one model step and gates its text for `turn` (`full` streams untouched). */
export async function streamGated(
  backend: ModelBackend,
  params: Parameters<ModelBackend['stream']>[0],
  onText: (delta: string) => void,
  signal: AbortSignal,
  turn: TurnVoice,
  lingo: MonLingo,
): Promise<Anthropic.Message> {
  if (turn.voiceStage === 'full') return backend.stream(params, onText, signal);
  // Held back: nothing the model wrote reaches the browser before the gate has run.
  const message = gateMessage(await backend.stream(params, () => {}, signal), turn, lingo);
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join(' ');
  if (text !== '') onText(text);
  return message;
}

/** The gate on its own, for a backend that does not carry the served voice guide (the Bedrock simulator). */
export function withVoiceStageGate(backend: ModelBackend, lingo: () => MonLingo, roster: () => Promise<MonRoster>, now: () => number = Date.now): ModelBackend {
  return {
    label: backend.label,
    async stream(params, onText, signal) {
      const t = now();
      const turn = resolveTurnVoice(turnVoice(params.messages, t), await roster(), t);
      return streamGated(backend, params, onText, signal, turn, lingo());
    },
  };
}
