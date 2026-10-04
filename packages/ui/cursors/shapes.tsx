'use client';
// First: Reanimated reads __DEV__ at module load, and web bundlers don't define it.
import '../rn-globals-shim';

import Animated from 'react-native-reanimated';
import { tv } from 'tailwind-variants';
import { neonColor, type NeonColorInput } from '../neon/colors';
import { View } from '../tw';
import { Arrow } from './arrow';
import { Face } from './face';
import type { CursorGlow } from './types';

export interface CursorArrowProps {
  /** Height of the arrow in px. Default 28. */
  size?: number;
  /** Fill. Default orange. */
  color?: NeonColorInput;
  /** Outline. Default royal, the wordmark's outline. */
  outlineColor?: NeonColorInput;
}

/**
 * The NYC-MON pointer: a solid orange arrow on a thick royal outline with a
 * night drop under it and a lit bevel, the wordmark's build at cursor size.
 * Skia (CanvasKit on web), so native callers can use it too, e.g. at the end
 * of a controller ray.
 */
export function CursorArrow({ size = 28, color = 'orange', outlineColor = 'royal' }: CursorArrowProps) {
  return (
    // Computed geometry: the drawing's size is a numeric prop.
    <View aria-hidden style={{ width: size, height: size }}>
      <Arrow size={size} fill={neonColor(color).base} outline={neonColor(outlineColor).base} />
    </View>
  );
}

export interface ReticleShapeProps {
  /** Outer size in px. Default 44. */
  size?: number;
  /** Bracket and dot colour. Default orange. */
  color?: NeonColorInput;
  /** Keyline under the brackets. Default royal. */
  outlineColor?: NeonColorInput;
  /** Inner diamond. Default carolina. */
  accentColor?: NeonColorInput;
  /** Spin the brackets and the diamond. Default true. */
  animated?: boolean;
  /** Seconds per turn of the outer brackets. Default 8. */
  outerSpeed?: number;
  /** Seconds per turn of the inner diamond (counter-rotating). Default 5. */
  innerSpeed?: number;
}

const SPIN = { from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '360deg' }] } };
const SPIN_BACK = { from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '-360deg' }] } };

// Corner brackets of a rounded square: each is one corner of a bordered,
// rounded box. The royal keyline set is a little larger and thicker, so it
// shows on both sides of the orange set, like the wordmark's outline.
const reticle = tv({
  slots: {
    diamond: 'absolute left-[38%] top-[38%] h-[24%] w-[24%] rotate-45 rounded-sm border-2',
    dot: 'absolute left-[44%] top-[44%] h-[12%] w-[12%] rounded-full border-2',
  },
});
const KEYLINE = [
  'absolute h-[42%] w-[42%] left-[5%] top-[5%] rounded-tl-xl border-l-[7px] border-t-[7px]',
  'absolute h-[42%] w-[42%] right-[5%] top-[5%] rounded-tr-xl border-r-[7px] border-t-[7px]',
  'absolute h-[42%] w-[42%] bottom-[5%] right-[5%] rounded-br-xl border-b-[7px] border-r-[7px]',
  'absolute h-[42%] w-[42%] bottom-[5%] left-[5%] rounded-bl-xl border-b-[7px] border-l-[7px]',
] as const;
const BRACKETS = [
  'absolute h-[38%] w-[38%] left-[8%] top-[8%] rounded-tl-lg border-l-4 border-t-4',
  'absolute h-[38%] w-[38%] right-[8%] top-[8%] rounded-tr-lg border-r-4 border-t-4',
  'absolute h-[38%] w-[38%] bottom-[8%] right-[8%] rounded-br-lg border-b-4 border-r-4',
  'absolute h-[38%] w-[38%] bottom-[8%] left-[8%] rounded-bl-lg border-b-4 border-l-4',
] as const;

function Layer({ spin, seconds, children }: { spin: typeof SPIN | null; seconds: number; children: React.ReactNode }) {
  return (
    <View className="absolute inset-0">
      <Animated.View
        // Reanimated CSS animation: a continuous rotation can't be a class.
        style={[{ flex: 1 }, spin && seconds > 0 ? { animationName: spin, animationDuration: seconds * 1000, animationIterationCount: 'infinite', animationTimingFunction: 'linear' } : null]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * The NYC-MON reticle: a rounded square of four corner brackets on a royal
 * keyline, a counter-rotating diamond and a solid centre dot. Built from
 * plain views, so it draws the same on web and native with no canvas; spins
 * with Reanimated CSS animations unless `animated` is false.
 */
export function ReticleShape({
  size = 44,
  color = 'orange',
  outlineColor = 'royal',
  accentColor = 'carolina',
  animated = true,
  outerSpeed = 8,
  innerSpeed = 5,
}: ReticleShapeProps) {
  const c = neonColor(color).base;
  const o = neonColor(outlineColor).base;
  const a = neonColor(accentColor).base;
  const s = reticle();
  return (
    // Computed geometry: size is a numeric prop. Colours below are runtime props
    // on borders, which carry no colour class.
    <View aria-hidden className="relative" style={{ width: size, height: size }}>
      <Layer spin={animated ? SPIN : null} seconds={outerSpeed}>
        {KEYLINE.map((cls) => (
          <View key={cls} className={cls} style={{ borderColor: o }} />
        ))}
        {BRACKETS.map((cls) => (
          <View key={cls} className={cls} style={{ borderColor: c }} />
        ))}
      </Layer>
      <Layer spin={animated ? SPIN_BACK : null} seconds={innerSpeed}>
        <View className={s.diamond()} style={{ borderColor: a }} />
      </Layer>
      <View className={s.dot()} style={{ backgroundColor: c, borderColor: o }} />
    </View>
  );
}

export interface MouseFaceProps {
  /** Width and height of the face in px. Default 64. */
  size?: number;
  /** Line colour: a NeonBlade preset, a brand token or any CSS colour. Default orange. */
  color?: NeonColorInput;
  /** Glow colour. Default: the colour's paired glow (orange glows royal). */
  glowColor?: NeonColorInput;
  /** Line weight, in the same units as NeonBlade's fox. Default 2. */
  strokeWidth?: number;
  /** Glow around the lines. Default medium. */
  glowIntensity?: CursorGlow;
  /** Translucent face fill, 0 (lines only) to 1. Default 0. */
  fillOpacity?: number;
}

/** Glow radius per intensity, in px: NeonBlade's fox values. */
export const FACE_GLOW: Record<CursorGlow, number> = { none: 0, low: 3, medium: 6, high: 14 };

/**
 * The mouse face: NeonBlade's geometric fox face rebuilt as a mouse. Thin
 * round-capped lines, two big octagon ears with inner-ear lines, a long
 * pointed snout with a solid nose, eyes and whiskers, and a neon glow.
 * Skia (CanvasKit on web), so it also draws on native.
 */
export function MouseFace({
  size = 64,
  color = 'orange',
  glowColor,
  strokeWidth = 2,
  glowIntensity = 'medium',
  fillOpacity = 0,
}: MouseFaceProps) {
  const c = neonColor(color, glowColor);
  const glow = FACE_GLOW[glowIntensity];
  // Room around the face for the halo, which Skia would otherwise clip.
  const pad = Math.ceil(glow * 3) + 2;
  return (
    // Computed geometry: the face size and the glow margin are numeric props.
    <View aria-hidden className="relative" style={{ width: size, height: size }}>
      <View className="absolute" style={{ left: -pad, top: -pad }}>
        <Face
          size={size}
          pad={pad}
          strokeWidth={strokeWidth}
          color={c.base}
          glowColor={c.glow}
          glow={glow}
          fillOpacity={Math.min(1, Math.max(0, fillOpacity))}
        />
      </View>
    </View>
  );
}
