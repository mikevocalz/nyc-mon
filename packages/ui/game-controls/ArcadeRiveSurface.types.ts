import type { StyleProp, ViewStyle } from 'react-native';
import type { RiveFile } from '@rive-app/react-native';
import type { ArcadeRiveBinding } from './rive-binding.ts';

/**
 * Where a control's artboard comes from: a loaded `.riv` (from `useRiveFile`)
 * plus the artboard and state machine lane B named in `rive.yaml`. Omitted
 * on a control: nothing renders and every binding write is a no-op, so the
 * touch, keyboard and accessibility paths keep working without the asset.
 *
 * @see {@linkcode ArcadeRiveSurfaceProps}
 */
export interface ArcadeRiveSource {
  readonly file: RiveFile;
  readonly artboardName?: string;
  readonly stateMachineName?: string;
}

/**
 * Props of the Rive artboard behind one control. Shared by the native and
 * web forks of `ArcadeRiveSurface`.
 */
export interface ArcadeRiveSurfaceProps {
  /** The loaded `.riv` (from `useRiveFile`). Absent while lane B's asset has not landed: nothing renders. */
  readonly riveFile: RiveFile | undefined;
  readonly artboardName?: string;
  readonly stateMachineName?: string;
  /**
   * Receives the live {@linkcode ArcadeRiveBinding} once the view model
   * instance exists, and `null` when it goes away. The control keeps the
   * binding in a ref and writes to it from its input path, never through a
   * React render.
   */
  readonly onBinding: (binding: ArcadeRiveBinding | null) => void;
  /**
   * Names this surface in `riveDiagnosticsStore` (missing View Model paths,
   * `RiveView` errors), e.g. `start-stop`. Defaults to the artboard name, then
   * `arcade`.
   */
  readonly diagnosticsName?: string;
  readonly style?: StyleProp<ViewStyle>;
}
