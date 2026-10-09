import type { ReactNode } from 'react';
import type { HLynkKeyProps } from './HLynkKey.types';
import type { ShellLayout } from './layout';
import type { HLynkTier } from './tier';
import type { TrackpadProps } from './Trackpad.types';

/**
 * What the scanner LED reports, with its text equivalent. A lit, meaningful
 * LED without a label cannot be written (M01 08-handoff.md, D3, WCAG 1.4.1).
 * `progress` (0–1) rides on `incubating` only; it draws the reduced-motion
 * tick row.
 * @see HLynkShellProps.status
 */
export type HLynkStatus =
  | { led: 'off' }
  | { led: 'boot' }
  | { led: 'incubating'; label: string; progress: number }
  | { led: 'ready' | 'needsYou'; label: string };

/** `Omit` that keeps a union's variants apart. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Trackpad props as {@linkcode HLynkShellProps.trackpad} takes them: the shell supplies tier, shape and motion. */
export type ShellTrackpadProps = DistributiveOmit<TrackpadProps, 'tier' | 'shape' | 'reducedMotion'>;

/** Key props as {@linkcode HLynkShellProps.keys} takes them: the shell supplies tier, role and motion. */
export type ShellKeyProps = Omit<HLynkKeyProps, 'tier' | 'role' | 'reducedMotion'>;

/** Power sequence; M01 drives it `off` → `booting` → `on`. */
export type HLynkPower = 'off' | 'booting' | 'on';

/**
 * Props for `HLynkShell`, the persistent H-Lynk frame around companion
 * screens (DIRECTION.md "Kit mapping"; M01 08-handoff.md "Public prop
 * contracts").
 */
export interface HLynkShellProps {
  /**
   * The tier (Decision #16). `standard` and `pro` draw the Core look with a
   * labelled development placeholder until their tokens are measured.
   * @default 'core'
   */
  tier?: HLynkTier;
  /**
   * Daylit or night (Decision #4). Changes the page behind the shell and the
   * scene inside the screen, never the body: plastic is plastic.
   * @default 'daylit'
   */
  scheme?: 'daylit' | 'night';
  /** The LED state and its text chip. @default { led: 'off' } */
  status?: HLynkStatus;
  /** From the sim-core adapter; drives every authored reduced sibling in the chrome. */
  reducedMotion: boolean;
  /**
   * Force a layout. Omitted: measured, compact when the control row would get
   * under 120 pt, and compact while the software keyboard is up (D-16g).
   */
  layout?: ShellLayout;
  /** Contents of the screen. */
  screen: ReactNode;
  /** Extra status-row content beside the LED chip (meters, the trackpad's labelled equivalents). */
  statusRow?: ReactNode;
  trackpad: ShellTrackpadProps;
  /** The four keys. A key without `onPress`, or left out, renders disabled; it is never hidden. */
  keys?: Partial<Record<'home' | 'menu' | 'back' | 'forward', ShellKeyProps>>;
  /** While not `on`, every control is disabled and the screen is dark. @default 'on' */
  power?: HLynkPower;
  /** Spoken once, politely, when `power` reaches `on` from `off` or `booting`. @default `m01.a11y.power_on` "H-Lynk on" */
  powerOnAnnouncement?: string;
  /** Hide the whole shell from assistive tech (the M01 first-run boot, which lowers away). @default false */
  accessibilityHidden?: boolean;
  /** Safe-area insets in points. Omitted: read from the platform. Stories pass them to show a device. */
  insets?: { topPt: number; bottomPt: number };
  /** Prefix for part test IDs: `-shell`, `-led`, `-screen`, `-trackpad`, `-key-home` and so on (`m01` gives `m01-shell`). */
  testIDPrefix?: string;
}
