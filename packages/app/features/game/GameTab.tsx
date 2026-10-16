'use client';
// The Game tab, lobby first (Master Directive v2 §3: "the Game tab opens a
// Rive-powered lobby before the 3D world loads"). `GameLobbyScreen` owns the
// tab until START's resume sequence has restored the session and camera;
// `GameScreen` mounts for `transition` and `game` so its first frame is the
// resumed one under the cover, and the lobby's Rive loops stop once the
// session is on screen (P4). GameScreen is imported by path, as the route
// file did, so the web bundle never pulls the renderer in.
//
// A STOP hands the tab back to the lobby (review finding H6): the binding
// lives as long as the tab does.
//
// Focus (review finding M19): the route passes `focused` from its own
// navigator, so packages/app needs no expo-router import.
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { View } from '@acme/ui/tw';
import { GameScreen } from './GameScreen.tsx';
import { GameLobbyScreen } from './lobby/GameLobbyScreen.tsx';
import { lobbyStore } from './lobby/lobby.store.ts';
import { bindReturnToLobby } from './lobby/return-to-lobby.ts';
import { worldSessionStore } from './world-resume/world-session.store.ts';

/** Props of {@linkcode GameTab}. */
export interface GameTabProps {
  /** Whether the Game route has navigation focus. @default true */
  readonly focused?: boolean;
}

export function GameTab({ focused = true }: GameTabProps = {}) {
  const phase = useStore(lobbyStore, (s) => s.phase);
  useEffect(() => bindReturnToLobby(worldSessionStore, lobbyStore), []);
  if (phase === 'lobby') return <GameLobbyScreen />;
  return (
    <View className="flex-1">
      <GameScreen focused={focused} />
      {phase === 'transition' ? (
        // The lobby stays mounted over the world while the cover holds, so the reveal is one frame.
        <View className="absolute inset-0">
          <GameLobbyScreen />
        </View>
      ) : null}
    </View>
  );
}
