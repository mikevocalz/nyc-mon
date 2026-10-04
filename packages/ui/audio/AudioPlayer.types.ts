import type { ControlTone, District } from '../district';

export interface AudioPlayerProps {
  /** File, remote or data: URI of the recording. */
  uri: string;
  /** Length in seconds, when the caller already knows it. */
  duration?: number;
  /** Levels captured at record time. Omitted, the player decodes the file. */
  levels?: readonly number[];
  /** Shown above the waveform. */
  label?: string;
  /** Colour family. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default midtown (orange). */
  district?: District;
  className?: string;
}
