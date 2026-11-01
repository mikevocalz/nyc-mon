// Thin route: the feature owns the screen. GameTab opens the lobby first and
// mounts GameScreen once START has resumed (directive §3). The route passes
// tab focus so leaving the tab cancels held input (review finding M19).
import { useEffect } from 'react';
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useStore } from 'zustand';
import { GameTab } from '@acme/app/features/game/GameTab.tsx';
import { startLobbySession } from '@acme/app/features/game/lobby/GameLobbyScreen.tsx';
import { lobbyStore } from '@acme/app/features/game/lobby/lobby.store.ts';

export default function GameRoute() {
  // Dev builds only: nycmon://game?start=1 presses START once the resume has
  // loaded, so a device run can reach the city without a tap.
  const { start } = useLocalSearchParams<{ start?: string }>();
  const resumeReady = useStore(lobbyStore, (s) => s.resume !== null);
  useEffect(() => {
    if (__DEV__ && start === '1' && resumeReady) void startLobbySession();
  }, [start, resumeReady]);
  return <GameTab focused={useIsFocused()} />;
}
