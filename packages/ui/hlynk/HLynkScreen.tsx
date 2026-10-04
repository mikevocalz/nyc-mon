'use client';
import type { ReactNode } from 'react';
import { View } from '../tw';
import { HLYNK_GEOMETRY } from './layout';
import { resolveTier, type HLynkTier } from './tier';

/**
 * Props for `HLynkScreen`, the H-Lynk's display window. Placed by
 * {@linkcode HLynkShell} through its `screen` and `statusRow` props, or used
 * alone in a story or a non-chrome preview.
 */
export interface HLynkScreenProps {
  /** @default 'core' */
  tier?: HLynkTier;
  /** The scene: three.js canvas, Skia HUD and kit controls, layered per BUILD_PROMPT §3.1. */
  children?: ReactNode;
  /** Top row inside the screen: the LED's text chip and meters. Information is never LED-only. */
  statusRow?: ReactNode;
  /**
   * `3:4`: the H-Lynk's screen proportion. `fill`: full-bleed, for the compact
   * shell.
   * @default '3:4'
   */
  aspect?: '3:4' | 'fill';
  testID?: string;
}

/**
 * The 3:4 screen inside a black bezel lip. The bezel is the device; the
 * inside follows the page scheme (daylit or night, Decision #4), so wrap a
 * night scene in the shell's `scheme="night"` rather than painting it here.
 * Safe areas belong to the shell, not to the screen.
 */
export function HLynkScreen({ tier = 'core', children, statusRow, aspect = '3:4', testID }: HLynkScreenProps) {
  resolveTier(tier, 'HLynkScreen');
  return (
    <View
      testID={testID}
      className={`overflow-hidden border-hlynk-core-black bg-bg ${aspect === 'fill' ? 'flex-1 self-stretch' : 'w-full'}`}
      style={{ borderWidth: HLYNK_GEOMETRY.bezelPt, ...(aspect === '3:4' ? { aspectRatio: 3 / 4 } : null) }}
    >
      {statusRow ? <View className="flex-row flex-wrap items-center gap-2 px-3 pt-3">{statusRow}</View> : null}
      <View className="flex-1">{children}</View>
    </View>
  );
}
