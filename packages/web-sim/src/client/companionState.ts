import type { StoreApi } from 'zustand/vanilla';
import type Anthropic from '@anthropic-ai/sdk';
import type { CallToolResult } from '@modelcontextprotocol/client';
import type { MemorySnapshot } from '@acme/core/schemas';
import type { TurnOutcome } from '../shared/agentLoop.ts';
import { captionText } from '@acme/content/voice';
import type { McpSession } from './mcp.ts';
import { INITIAL_VOICE, type VoiceState } from './voiceState.ts';
import { careSentence, type MonCard } from './companionMon.ts';

/** One entry in the conversation log. `detail` is the raw server answer, shown collapsed. */
export interface Line { id: number; who: 'Caller' | 'Mon' | 'Result'; text: string; detail?: string; cut?: boolean }

/** Visible state of the NVIDIA companion page (nvidia.tsx). */
export interface CompanionState {
  connected: boolean; busy: boolean; question: string; note: string; consent: boolean;
  memory: MemorySnapshot | null; error: string; status: string; confirmForget: boolean;
  lines: Line[]; nextId: number;
  /** The signed-in Caller's Mon, from the last tool result that carried it (companionMon.ts). */
  mon: MonCard | null;
  /** Which right-hand panel is open: the conversation or the Memory controls. */
  panel: 'chat' | 'memory';
  /** Voice conversation: listening, thinking, speaking, interrupted (voiceState.ts). */
  voice: VoiceState;
}
/** Per-page protocol handles that are not UI state. */
export interface CompanionRuntime { session: McpSession | null; history: Anthropic.MessageParam[]; abort: AbortController | null }

export const initialCompanionState = (): CompanionState => ({
  connected: false, busy: false, question: '', note: '', consent: false, memory: null,
  error: '', status: '', confirmForget: false, lines: [], nextId: 0, voice: INITIAL_VOICE, mon: null, panel: 'chat',
});

const MAX_LINES = 40;
const MAX_DETAIL = 2500;

/** Append with a stable id; ids keep React keys fixed when old lines are trimmed. */
export function appendLine(state: Pick<CompanionState, 'lines' | 'nextId'>, line: Omit<Line, 'id'>): Pick<CompanionState, 'lines' | 'nextId'> {
  return { lines: [...state.lines, { ...line, id: state.nextId }].slice(-MAX_LINES), nextId: state.nextId + 1 };
}

const EMPTY_REPLY: Readonly<Record<TurnOutcome, string>> = {
  done: 'No reply text.',
  refused: 'The model declined to answer. Try asking another way.',
  truncated: 'The reply was cut off at the length limit.',
  'step-limit': 'Your Mon tried too many steps and stopped. Try a simpler request.',
};

/** A tool result as one plain sentence (companionMon.ts careSentence), with the raw answer kept for the detail. */
export function toolResultLine(name: string, result: CallToolResult): Omit<Line, 'id'> {
  return {
    who: 'Result',
    text: careSentence(name, result),
    detail: JSON.stringify(result.structuredContent ?? result.content, null, 2).slice(0, MAX_DETAIL),
  };
}

/**
 * Adds one spoken sentence to a Mon line, captioned like monLine. The page
 * calls this as each sentence starts playing, so the caption never shows
 * words the Mon has not said yet.
 */
export function growLine(lines: Line[], id: number, sentence: string): Line[] {
  const words = captionText(sentence).trim();
  if (!words) return lines;
  return lines.map((l) => (l.id === id ? { ...l, text: l.text ? `${l.text} ${words}` : words } : l));
}

/** The Caller cut the Mon off: the line keeps what was said and is marked cut. */
export function cutLine(lines: Line[], id: number): Line[] {
  return lines.some((l) => l.id === id) ? lines.map((l) => (l.id === id ? { ...l, cut: true } : l)) : lines;
}

/** The Mon's reply as the main simulator captions it: "Caller" on screen, stage directions dropped. */
export function monLine(reply: string, outcome: TurnOutcome): Omit<Line, 'id'> {
  return { who: 'Mon', text: reply.trim() ? captionText(reply) : EMPTY_REPLY[outcome] };
}

export function memoryErrorMessage(method: 'GET' | 'PUT' | 'DELETE', status: number): string {
  if (status === 409) return 'Your preferences changed in another session. Reload them, then save again.';
  if (method === 'GET') return 'Saved preferences couldn’t be loaded. Try again.';
  if (method === 'PUT') return 'Preferences weren’t saved. Try again.';
  return 'Preferences weren’t forgotten. Try again.';
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something on this page failed. Reload and try again.';
}

/**
 * The refresh token was refused (freshToken's onSignedOut). Aborting makes
 * send()/memoryRequest() skip their own `busy:false`, so clear it here and say why.
 */
export function expireSession(store: StoreApi<CompanionState>, runtime: StoreApi<CompanionRuntime>): void {
  runtime.getState().abort?.abort(); runtime.setState({ history: [] });
  store.setState({
    connected: false, busy: false, memory: null, note: '', consent: false, confirmForget: false, lines: [], status: '', mon: null, panel: 'chat',
    error: 'Your sign-in expired. Sign in again to keep talking.',
  });
}
