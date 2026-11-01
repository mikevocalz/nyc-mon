import type { StyleProp, ViewStyle } from 'react-native';
import type { ArcadeRiveSource } from '../game-controls/ArcadeRiveSurface.types.ts';
import type { LobbyRiveBinding } from './lobby-rive-binding.ts';

/**
 * Props of the Rive artboard behind one lobby part. Same shape as
 * `ArcadeRiveSurfaceProps` (../game-controls), except that `onBinding` hands
 * over a {@linkcode LobbyRiveBinding}.
 *
 * Decision (2026-10-15): BUILD a sibling surface rather than reuse
 * `ArcadeRiveSurface`, because its `onBinding` is typed on the controller's
 * `ArcadeRiveBinding` and never exposes the view model instance the lobby
 * binding needs. Proposal to lane C1 (reported, not edited): give
 * `ArcadeRiveSurface` a `createBinding(instance)` factory prop so this file,
 * its two forks and `use-lobby-rive-binding.ts` can be deleted.
 *
 * @see {@linkcode ArcadeRiveSource} for where the file, artboard and state machine come from.
 */
export interface LobbyRiveSurfaceProps {
  /** The loaded `.riv` (from `useRiveFile`). Absent: nothing renders and the kit housing is the whole control. */
  readonly riveFile: ArcadeRiveSource['file'] | undefined;
  readonly artboardName?: string;
  readonly stateMachineName?: string;
  /** Receives the live binding once the view model instance exists, and `null` when it goes away. */
  readonly onBinding: (binding: LobbyRiveBinding | null) => void;
  /**
   * Hands the artboard's authored semantics to the screen reader. Turn off
   * when the kit already names the same content, so readers meet one tree.
   * @default true
   */
  readonly exposeSemantics?: boolean;
  /** Stops the render loop (`RiveViewRef.pause()`); the app being in the background stops it too. @default false */
  readonly paused?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}
