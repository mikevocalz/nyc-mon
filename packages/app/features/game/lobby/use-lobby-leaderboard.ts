'use client';
import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { createUnavailableLeaderboardSource, type LeaderboardSource } from '@acme/core';
import type { LeaderboardModel } from '@acme/ui/lobby';
import { toLeaderboardModel } from './leaderboard-model.ts';
import { lobbyStore } from './lobby.store.ts';

// The panel's data path (Master Directive v2 §3 "Rive leaderboard"; §14
// fixture 11). The source today is `createUnavailableLeaderboardSource`:
// every load answers `error / no-ranking-authority`, which the model maps
// to `unavailable`. A load never throws and never touches `resume`, so a
// leaderboard outage cannot block START. Previous rows stay on screen while
// a refetch is in flight (`beginLeaderboardLoad`).

const defaultSource: LeaderboardSource = createUnavailableLeaderboardSource();

/** Loads one page into the store. Safe to call again; the latest answer wins. */
export async function loadLobbyLeaderboard(source: LeaderboardSource = defaultSource): Promise<void> {
  const store = lobbyStore.getState();
  store.beginLeaderboardLoad();
  const page = await source.load();
  lobbyStore.getState().setLeaderboard(page);
}

/** Loads on mount and returns the panel model plus a retry. */
export function useLobbyLeaderboard(source: LeaderboardSource = defaultSource): { model: LeaderboardModel; retry: () => void } {
  const page = useStore(lobbyStore, (s) => s.leaderboard);
  const previous = useStore(lobbyStore, (s) => s.previousLeaderboard);
  useEffect(() => {
    void loadLobbyLeaderboard(source);
  }, [source]);
  const model = useMemo(() => toLeaderboardModel(page, previous), [page, previous]);
  const retry = useMemo(() => () => { void loadLobbyLeaderboard(source); }, [source]);
  return { model, retry };
}
