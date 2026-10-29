import type { RiveLoaderPhase, RiveLoaderScheme } from './rive-loader-bindings.ts';

/** Props shared by the native and web RiveLoader forks. */
export interface RiveLoaderProps {
  /** Rendered size in px; the artboard is square. Default 160. */
  size?: number;
  /**
   * Drives the `Loader` state machine. Default `loading`. When the OS asks
   * for reduced motion, `loading` plays as `reduced`.
   */
  phase?: RiveLoaderPhase;
  /** Real progress 0-1 fills the corner-cut frame. Omit while the amount is unknown. */
  progress?: number;
  /** Which token column the colours come from. Default `dark`. */
  scheme?: RiveLoaderScheme;
  /** What is loading, for screen readers. Default "Loading". */
  label?: string;
  className?: string;
}
