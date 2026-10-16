// `@acme/ui/lobby`: the Game tab's lobby (Master Directive v2 §3, §13).
// Pure parts first (contract, copy, binding), then the components.
export type {
  AngledStartState,
  EpochMs,
  LeaderboardModel,
  LeaderboardRow,
  RecoveryChoice,
  ResumeFailure,
  ResumeRecovery,
  ResumeSummary,
  StartVariant,
  ThemeVariant,
  TransitionPhase,
} from './lobby-contract.ts';
export { leaderboardStatusOf } from './lobby-contract.ts';
export {
  ALL_RECOVERY_CHOICES,
  LOBBY_COPY,
  failureLine,
  rankRegionLabel,
  rankStatusSpoken,
  recoveryActions,
  relativeAge,
  resumeDistrictLine,
  rowAccessibleLabel,
  staleAccessibleLabel,
  staleHeadline,
  startAccessibleName,
  startHint,
  type RecoveryAction,
} from './lobby-copy.ts';
export {
  LOBBY_ROWS_AUTHORED,
  LOBBY_ROW_FIELDS,
  LOBBY_VM_PATHS,
  createLobbyRiveBinding,
  type LobbyRiveBinding,
  type LobbyViewModelInstance,
  type LobbyViewModelList,
} from './lobby-rive-binding.ts';
export { DEFAULT_KEYLINE, DISTRICT_KEYLINE, keylineFor, leaderboardAccessibility, panelRowsOf, type LeaderboardAccessibility } from './leaderboard-style.ts';
export { isLobbyCovered, shouldPlayArtboard, type AppActivity } from './lobby-playback.ts';
export { lobbyRiveFromFiles, type GameLobbyRive } from './lobby-rive.ts';
export { LobbyRiveSurface } from './LobbyRiveSurface';
export type { LobbyRiveSurfaceProps } from './LobbyRiveSurface.types.ts';
export { useLobbyRiveBinding, type LobbyRiveBindingHandle } from './use-lobby-rive-binding.ts';
export { AngledStartButton, START_CUT_PT, START_HEIGHT_PT, type AngledStartButtonProps } from './AngledStartButton.tsx';
export {
  LeaderboardPanel,
  PANEL_HEADER_PT,
  PANEL_ROWS_RESERVED,
  PANEL_ROW_PT,
  type LeaderboardPanelProps,
} from './LeaderboardPanel.tsx';
export { GameTransition, type GameTransitionProps } from './GameTransition.tsx';
export { GameLobby, type GameLobbyProps } from './GameLobby.tsx';
