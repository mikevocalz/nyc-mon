import type Anthropic from '@anthropic-ai/sdk';
import type { CallToolResult } from '@modelcontextprotocol/client';
import type { KeyValueStore } from '../shared/auth.ts';

/**
 * The local half of "state across sessions": the transcript and the model
 * history survive a reload. The Mon's own state lives on the MCP server, so a
 * fresh browser still meets the same Mon. Nothing secret is stored here.
 */

export type TranscriptItem =
  | { readonly kind: 'user'; readonly id: string; readonly text: string; readonly at: number }
  | { readonly kind: 'mon'; readonly id: string; readonly text: string; readonly at: number }
  | {
      readonly kind: 'tool';
      readonly id: string;
      readonly name: string;
      readonly title: string;
      readonly input: Record<string, unknown>;
      readonly result: CallToolResult;
      readonly resourceUri: string | null;
      readonly at: number;
    }
  | { readonly kind: 'notice'; readonly id: string; readonly text: string; readonly tone: 'info' | 'error'; readonly at: number };

export interface SavedSession {
  readonly version: 1;
  readonly items: TranscriptItem[];
  readonly history: Anthropic.MessageParam[];
  readonly savedAt: number;
}

const KEY = 'nyc-mon-sim.session.v1';
export const MAX_ITEMS = 200;
/**
 * Past this many messages the model starts a fresh conversation instead of
 * trimming old turns: earlier turns are never edited, because replayed
 * thinking blocks must match what the model produced.
 */
export const MAX_HISTORY_MESSAGES = 80;

export function emptySession(): SavedSession {
  return { version: 1, items: [], history: [], savedAt: 0 };
}

export function loadSession(store: KeyValueStore | null): SavedSession {
  if (!store) return emptySession();
  try {
    const raw = store.getItem(KEY);
    if (!raw) return emptySession();
    const parsed = JSON.parse(raw) as Partial<SavedSession>;
    if (parsed.version !== 1 || !Array.isArray(parsed.items) || !Array.isArray(parsed.history)) return emptySession();
    return { version: 1, items: parsed.items, history: parsed.history, savedAt: parsed.savedAt ?? 0 };
  } catch {
    return emptySession();
  }
}

export function saveSession(store: KeyValueStore | null, session: SavedSession): void {
  if (!store) return;
  const trimmed: SavedSession = { ...session, items: session.items.slice(-MAX_ITEMS), savedAt: Date.now() };
  try {
    store.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Quota or blocked storage: keep the model history out and try once more.
    try {
      store.setItem(KEY, JSON.stringify({ ...trimmed, history: [] }));
    } catch {
      /* storage unavailable; the session lasts as long as the tab */
    }
  }
}

export function clearSession(store: KeyValueStore | null): void {
  try {
    store?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** History to send with the next utterance; starts over when it gets long. */
export function historyForNextTurn(history: Anthropic.MessageParam[]): { history: Anthropic.MessageParam[]; restarted: boolean } {
  if (history.length < MAX_HISTORY_MESSAGES) return { history, restarted: false };
  return { history: [], restarted: true };
}

/** localStorage or sessionStorage, or null when the browser blocks it. */
export function safeStorage(kind: 'local' | 'session'): KeyValueStore | null {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage;
    const probe = '__nyc-mon-sim-probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** In-memory store for when the browser blocks Web Storage. */
export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
