'use client';
import type { ReactNode } from 'react';
import { View } from '../tw';

/**
 * Window width (dp) from which the stage used to open its side panes
 * (Material's expanded class). Kept for callers that still import it.
 */
export const HLYNK_STAGE_WIDE_PT = 840;

/**
 * Whether screens should hand their panel content to the stage's side panes.
 * Always false since Decision H-2 (docs/design/hlynk/ADAPTIVE.md): from
 * 600 pt the region beside the H-Lynk is the NYC-MON brand pane, so the
 * M13–M16 panels draw inside the shell's screen on every window, as they
 * already did below 840. A hook so call sites stay unchanged.
 */
export function useHLynkStageWide(): boolean {
  return false;
}

export interface HLynkStageProps {
  /** The `HLynkShell`. */
  children: ReactNode;
  /** Ignored since Decision H-2; screens draw this content inside the shell. */
  leading?: ReactNode;
  /** Ignored since Decision H-2; screens draw this content inside the shell. */
  trailing?: ReactNode;
  testID?: string;
}

/**
 * The host for the companion loop's shell. Decision: STRIKE the side panes
 * (2026-10-15). The M13 Quest layout put panes either side of a centred
 * 440 pt shell; the H-Lynk layout contract now gives a wide or folded window
 * two regions only, brand left and device right, and a third column would
 * either cross a Duo hinge or squeeze the device. The shell lays itself out.
 */
export function HLynkStage({ children, testID }: HLynkStageProps) {
  return <View testID={testID} className="flex-1 bg-bg">{children}</View>;
}
