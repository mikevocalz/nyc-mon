'use client';

import { CircuitButton, GridCard, Text, TextField } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { useTabletopSessionStore } from './tabletopSessionStore';

export function TabletopSessionPanel({
  onLaunch,
}: {
  onLaunch: () => void;
}) {
  const mode = useTabletopSessionStore((state) => state.mode);
  const playerName = useTabletopSessionStore((state) => state.playerName);
  const joinCode = useTabletopSessionStore((state) => state.joinCode);
  const roomDisplayCode = useTabletopSessionStore((state) => state.roomDisplayCode);
  const localized = useTabletopSessionStore((state) => state.localized);
  const ready = useTabletopSessionStore((state) => state.ready);
  const error = useTabletopSessionStore((state) => state.error);
  const setPlayerName = useTabletopSessionStore((state) => state.setPlayerName);
  const setJoinCode = useTabletopSessionStore((state) => state.setJoinCode);
  const beginHost = useTabletopSessionStore((state) => state.beginHost);
  const beginGuest = useTabletopSessionStore((state) => state.beginGuest);
  const beginSolo = useTabletopSessionStore((state) => state.beginSolo);
  const reset = useTabletopSessionStore((state) => state.reset);

  const launch = (begin: () => boolean) => {
    if (begin()) onLaunch();
  };

  return (
    <GridCard eyebrow="Tabletop duel" title="Play on a real table" tone="orange">
      <View className="gap-4">
        <Text className="text-sm leading-6 text-white/75">
          Enter your name before creating or joining a shared tabletop. The host scans a real
          table or floor, taps a surface, previews the futuristic Grid mat, and locks placement
          before the room code is created. Player 2 then joins and localizes into that exact frame.
        </Text>

        <Text className="text-xs leading-5 text-carolina-200/80">
          Quest placement uses the Horizon OS room model. Run Physical Space / Space Setup once if
          table or floor surfaces do not appear. Player 2 cannot Ready until the shared frame and
          co-location channel both confirm localization to the same physical Grid.
        </Text>

        <TextField
          label="Player name"
          value={playerName}
          placeholder="Enter name"
          onChangeText={setPlayerName}
          hint="1–16 characters. This name is bound into the Rive scoreboard."
        />

        <View className="flex-row flex-wrap gap-3">
          <CircuitButton onPress={() => launch(beginHost)} variant="solid">
            Create table
          </CircuitButton>
          <CircuitButton tone="orange" onPress={() => launch(beginSolo)}>
            Solo against AI
          </CircuitButton>
        </View>

        <View className="gap-3 border-t border-structure/25 pt-4">
          <TextField
            label="Join table"
            value={joinCode}
            placeholder="K7M2QX"
            onChangeText={setJoinCode}
            hint="Enter the host's six-character Viro room code."
          />
          <CircuitButton tone="orange" onPress={() => launch(beginGuest)} variant="solid">
            Join table
          </CircuitButton>
        </View>

        {mode !== 'idle' ? (
          <View className="gap-1 border-t border-structure/30 pt-3">
            <Text className="text-sm font-semibold text-carolina-300">
              {mode === 'host' ? 'Hosting' : mode === 'guest' ? 'Joined' : 'Solo'} as {playerName}
            </Text>
            {roomDisplayCode ? (
              <Text className="text-lg font-bold tracking-widest text-orange-300">
                Room {roomDisplayCode}
              </Text>
            ) : null}
            <Text className="text-xs text-white/70">
              {localized ? 'Grid localized' : 'Waiting for shared-frame localization'}. {ready ? 'Ready.' : 'Not ready yet.'}
            </Text>
            <CircuitButton onPress={reset}>Leave session</CircuitButton>
          </View>
        ) : null}

        {error ? <Text className="text-sm text-danger">{error}</Text> : null}
      </View>
    </GridCard>
  );
}
