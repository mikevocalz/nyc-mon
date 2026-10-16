import type { RiveFile } from '@rive-app/react-native';
import type { ArcadeRiveSource } from '../game-controls/ArcadeRiveSurface.types.ts';

/**
 * The lobby's artboards, each optional until its `.riv` is loaded. Sources
 * are lane B's builds under `packages/ui/rive/lobby/<project>/build/*.riv`
 * (`rive.yaml` `main:`): `start-angled` (host artboard `StartAngledHost`,
 * state machine `Host`), `leaderboard` (`Leaderboard`, `Host`) and
 * `game-transition` (`GameTransitionHost`, `Host`). The file's default
 * artboard is the host, so names may be omitted.
 *
 * Decision (2026-10-15): BUILD the lobby as the kit's artboard-per-control
 * composition (`StartStopPill`, `ArcadeSixButtons`): each kit housing owns
 * layout, safe areas and the layout profile, and hosts its own artboard.
 * DEFER mounting lane B's assembled `game-lobby` scene as one surface; its
 * header defers safe areas and the tablet cap to "the RN wrapper", which is
 * what these housings are. The binding paths are identical in both, so
 * {@linkcode LOBBY_VM_PATHS} drives either.
 *
 * @see {@linkcode lobbyRiveFromFiles}
 */
export interface GameLobbyRive {
  readonly start?: ArcadeRiveSource;
  readonly leaderboard?: ArcadeRiveSource;
  readonly transition?: ArcadeRiveSource;
}

/** Builds the three sources from already-loaded files with the files' default artboards. */
export function lobbyRiveFromFiles(files: { start?: RiveFile; leaderboard?: RiveFile; transition?: RiveFile }): GameLobbyRive {
  return {
    start: files.start ? { file: files.start } : undefined,
    leaderboard: files.leaderboard ? { file: files.leaderboard } : undefined,
    transition: files.transition ? { file: files.transition } : undefined,
  };
}
