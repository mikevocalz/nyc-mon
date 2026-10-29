'use client';
import type { ReactNode } from 'react';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { hiddenA11y } from '../hlynk/a11y';
import { View } from '../tw';
import { lcdColors, type LcdColors } from './lcd-model';

export interface LcdPanelProps {
  scheme: 'daylit' | 'night';
  /** Lights out: the panel inverts (daylit) or dims (night). */
  inverted: boolean;
  /** Cell pitch of the dot grid, pt. 0 hides the grid. @default 4 */
  pitch?: number;
  /** Draws the panel's content with its colours. */
  children: (colors: LcdColors) => ReactNode;
  testID?: string;
}

/**
 * The flat Mon Space LCD: a reflective paper panel by day, backlit at night,
 * inverted for lights out, with a faint black-matrix grid over the ground.
 * It is the 2D path for the screen (no GPU, Reduce Transparency, tests and
 * web renders); the WebGPU `MemoryLcd` draws the same content with ghosting
 * and bloom. No motion of its own, so Reduce Motion changes nothing here.
 */
export function LcdPanel({ scheme, inverted, pitch = 4, children, testID }: LcdPanelProps) {
  const colors = lcdColors(scheme, inverted);
  return (
    <View testID={testID} className="relative flex-1 overflow-hidden" style={{ backgroundColor: colors.ground, borderRadius: 6, borderCurve: 'continuous' }}>
      {pitch > 0 ? (
        <View {...(hiddenA11y(true) as object)} className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          <Svg width="100%" height="100%">
            <Defs>
              <Pattern id="lcd-grid" width={pitch} height={pitch} patternUnits="userSpaceOnUse">
                <Rect x={0} y={pitch - 0.5} width={pitch} height={0.5} fill={colors.grid} />
                <Rect x={pitch - 0.5} y={0} width={0.5} height={pitch} fill={colors.grid} />
              </Pattern>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#lcd-grid)" />
          </Svg>
        </View>
      ) : null}
      <View className="flex-1" style={{ pointerEvents: 'box-none' }}>{children(colors)}</View>
    </View>
  );
}
