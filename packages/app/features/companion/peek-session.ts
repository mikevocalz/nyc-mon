import { peekQuality } from '@acme/core/sim';
import type { PeekRound } from '@acme/core/types';

/** The part of a Peek session that decides its one play write. */
export interface PeekSettleState {
  rounds: readonly PeekRound[];
  applied: boolean;
}

interface SettleStore {
  getState(): PeekSettleState;
  setState(patch: Pick<PeekSettleState, 'applied'>): void;
}

/**
 * Settles a Peek session's play: calls `write` with the session quality once,
 * and only when at least one round finished. Every exit path (Done, round
 * six, Back, Home, and the unmount cleanup for Android back or any other
 * route change) calls this; the `applied` flag keeps it to one write.
 * Returns whether this call wrote.
 */
export function settlePeekPlay(session: SettleStore, write: (quality: number) => void): boolean {
  const { rounds, applied } = session.getState();
  const quality = peekQuality(rounds);
  if (applied || quality === undefined) return false;
  session.setState({ applied: true });
  write(quality);
  return true;
}
