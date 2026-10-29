'use client';

import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import { create } from 'zustand';
import { saveIO } from '../onboarding/save-store';
import { onboardingStorage } from '../onboarding/storage';
import {
  appendConflicts, applySyncReply, onlineFrom, parseConflictLog, runSync,
  type ConflictEntry, type Online, type SyncOutcome, type SyncTransport,
} from './sync-model';

const LOG_KEY = 'sync-log';
const SEEN_KEY = 'sync-log-seen-at';

interface SyncState {
  /** From expo-network: true, false, or null until the OS answers. */
  readonly online: Online;
  /** A send is in flight. */
  readonly reconciling: boolean;
  /** The conflict log, newest first (persisted, capped). */
  readonly log: readonly ConflictEntry[];
  /** The newest log time the Caller has seen on the sync screen. */
  readonly seenAt: number;
  /** What the last attempt said, for the sync screen. */
  readonly lastOutcome: SyncOutcome | null;
}

/** M21 state. Written only by the functions below. */
export const useSyncStore = create<SyncState>()(() => ({
  online: null,
  reconciling: false,
  log: [],
  seenAt: 0,
  lastOutcome: null,
}));

/**
 * The server sender. None ships in Phase 1: the care endpoint
 * (`PUT /v1/mons/:id/care`) speaks `{ seq, delta, clientTime }`, not the
 * client's `CareWrite`, and no client for it exists yet. Until one is set,
 * an attempt reports `no-server` and the queue stays as it is.
 */
let transport: SyncTransport | null = null;

export function setSyncTransport(next: SyncTransport | null): void {
  transport = next;
}

/** Reads the persisted log. Call at app start, next to `hydrateMon`. */
export function hydrateSync(): void {
  const seen = Number(onboardingStorage.getString(SEEN_KEY) ?? '0');
  useSyncStore.setState({
    log: parseConflictLog(onboardingStorage.getString(LOG_KEY)),
    seenAt: Number.isFinite(seen) ? seen : 0,
  });
}

/** The sync screen was opened: every log line so far counts as seen. */
export function markSyncLogSeen(): void {
  const newest = useSyncStore.getState().log[0]?.at ?? 0;
  if (newest <= useSyncStore.getState().seenAt) return;
  onboardingStorage.set(SEEN_KEY, String(newest));
  useSyncStore.setState({ seenAt: newest });
}

/**
 * One sync attempt. Acks apply to the save as it is when the reply lands,
 * so care given during the send is kept. Never runs two sends at once.
 */
export async function syncNow(nowMs: number = Date.now()): Promise<SyncOutcome> {
  const { online, reconciling } = useSyncStore.getState();
  if (reconciling) return 'synced';
  const sending = online !== false && transport !== null;
  if (sending) useSyncStore.setState({ reconciling: true });
  try {
    const result = await runSync({ online, queue: saveIO.read()?.queue, transport, nowMs });
    if (result.reply !== undefined) {
      const save = saveIO.read();
      if (save !== undefined) saveIO.write({ ...save, queue: applySyncReply(save.queue, result.reply) });
    }
    if (result.conflicts.length > 0) {
      const log = appendConflicts(useSyncStore.getState().log, result.conflicts);
      onboardingStorage.set(LOG_KEY, JSON.stringify(log));
      useSyncStore.setState({ log });
    }
    useSyncStore.setState({ lastOutcome: result.outcome });
    return result.outcome;
  } finally {
    if (sending) useSyncStore.setState({ reconciling: false });
  }
}

function setOnline(next: Online): void {
  const previous = useSyncStore.getState().online;
  if (previous === next) return;
  useSyncStore.setState({ online: next });
  // Back online: send what waited. Only on a real offline → online edge.
  // A rejection here is a HatchIntegrityError (Law 6): report it, never hide it.
  if (previous === false && next !== false) void syncNow().catch((error: unknown) => console.error('[sync] reconnect sync failed', error));
}

let stopConnectivity: (() => void) | null = null;

/**
 * Starts the connectivity source once for the app (expo-network). Returns
 * the stop function; a second call returns the running one's.
 */
export function startConnectivity(): () => void {
  if (stopConnectivity !== null) return stopConnectivity;
  const subscription = addNetworkStateListener((state) => setOnline(onlineFrom(state)));
  getNetworkStateAsync()
    .then((state) => setOnline(onlineFrom(state)))
    .catch(() => undefined);
  stopConnectivity = () => {
    subscription.remove();
    stopConnectivity = null;
  };
  return stopConnectivity;
}
