'use client';
import '../rn-globals-shim';
import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { led, palette } from '@acme/theme';
import { View } from '../tw';
import { LID_OPEN_DEG } from './hatch-model';

/**
 * Proportions of the single-egg case, as shares of its side `S` (V11 ¶64–65;
 * M11 04-components.md drawing rules). Square footprint; the lid is the top
 * 38% of the front, the body the rest; the pad is a 40 pt square with a 12 pt
 * radius at iPhone SE scale, where the case is 193 pt wide.
 */
export const CASE = {
  lid: 0.38,
  handleW: 0.4,
  handleH: 0.1,
  pad: 40 / 193,
  padRadius: 12 / 40,
  /** pad centre from the left edge: right of centre, never a centre button */
  padX: 0.68,
  gasketPt: 2,
} as const;

const METAL_TOP = palette.concrete[300];
const METAL_BOTTOM = palette.concrete[500];

/** Brushed-metal face: `concrete-300` → `concrete-500`, top to bottom. */
function Metal({ id, w, h }: { id: string; w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={METAL_TOP} />
          <Stop offset="1" stopColor={METAL_BOTTOM} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
    </Svg>
  );
}

export interface CaseDrawingProps {
  sizePt: number;
  /** Lid angle in degrees, 0 shut to `LID_OPEN_DEG` open (overshoot allowed). UI thread. */
  lidDeg: SharedValue<number>;
  /** Pad emitter opacity 0–1. UI thread. */
  padGlow: SharedValue<number>;
  /** Orange seam light on the black gasket along the lid edge. */
  seamLit: boolean;
  scheme: 'daylit' | 'night';
  /** Reduced: the lid never rotates; the open frame cross-fades in instead. */
  reducedMotion: boolean;
  /** The egg in the cradle, visible once the lid lifts. */
  children?: ReactNode;
  /** Unique per instance so two cases on one page keep their own gradients (web SVG ids are global). */
  gradientId: string;
}

/**
 * The case drawing shared by `EggCase` (M10) and `CaptureCase` (M11, M12), so
 * the case is the same object on every screen (§2.4). Square corners
 * throughout: never round, never split red and white, no centre button. The
 * lid swings back on a hinge along its top edge (a perspective `rotateX`
 * about that edge); the folding handle lies flat as it opens. Decorative:
 * the wrapping component carries the one accessible image name.
 */
export function CaseDrawing({ sizePt: S, lidDeg, padGlow, seamLit, scheme, reducedMotion, children, gradientId }: CaseDrawingProps) {
  const lidH = S * CASE.lid;
  const bodyH = S - lidH;
  const handleH = S * CASE.handleH;
  const pad = S * CASE.pad;

  const lidStyle = useAnimatedStyle(() => {
    const deg = lidDeg.get();
    if (reducedMotion) return { opacity: 1 - Math.min(1, Math.max(0, deg / LID_OPEN_DEG)), transform: [{ perspective: S * 4 }, { rotateX: '0deg' }] };
    return { opacity: 1, transform: [{ perspective: S * 4 }, { rotateX: `${-deg}deg` }] };
  });
  const handleStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, lidDeg.get() / LID_OPEN_DEG));
    return { opacity: 1 - t, transform: [{ scaleY: 1 - t }] };
  });
  const eggStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, lidDeg.get() / 30)) }));
  const padStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, padGlow.get())) }));

  const edge = scheme === 'night' ? palette.concrete[400] : palette.concrete[700];

  return (
    <View style={{ width: S, height: S + handleH }}>
      {/* Folding top handle: three square bars. */}
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: (S * (1 - CASE.handleW)) / 2, width: S * CASE.handleW, height: handleH, transformOrigin: 'bottom' }, handleStyle]}
      >
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: palette.concrete[700] }} />
        <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, backgroundColor: palette.concrete[700] }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, backgroundColor: palette.concrete[700] }} />
      </Animated.View>

      <View style={{ position: 'absolute', top: handleH, left: 0, width: S, height: S, borderWidth: 1, borderColor: edge }}>
        {/* Body (lower front). */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: bodyH, overflow: 'hidden' }}>
          <Metal id={`${gradientId}-body`} w={S} h={bodyH} />
        </View>
        {/* Cradle: the egg sits here, behind the lid. */}
        {children ? (
          <Animated.View
            style={[{ position: 'absolute', left: S * 0.2, right: S * 0.2, top: lidH * 0.15, height: lidH + bodyH * 0.45, alignItems: 'center', justifyContent: 'center' }, eggStyle]}
          >
            {children}
          </Animated.View>
        ) : null}
        {/* Gasket between lid and body, with the seam light. */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: lidH - CASE.gasketPt / 2, height: CASE.gasketPt, backgroundColor: palette.signage.black }}>
          {seamLit ? <View style={{ position: 'absolute', left: 2, right: 2, top: 0, bottom: 0, backgroundColor: palette.orange[500] }} /> : null}
        </View>
        {/* Lid: hinge along its top (back) edge; the pad sits on its front, right of centre. */}
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: lidH - CASE.gasketPt / 2, overflow: 'hidden', transformOrigin: 'top', backfaceVisibility: 'hidden' }, lidStyle]}>
          <Metal id={`${gradientId}-lid`} w={S} h={lidH} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: palette.concrete[700] }} />
          <View
            style={{
              position: 'absolute',
              left: S * CASE.padX - pad / 2,
              top: (lidH - pad) / 2,
              width: pad,
              height: pad,
              borderRadius: pad * CASE.padRadius,
              backgroundColor: palette.signage.black,
              padding: Math.max(3, pad * 0.12),
            }}
          >
            {/* Lit emitter on the black inset: led-on on signage-black (4.99:1), never straight on the metal. */}
            <Animated.View style={[{ flex: 1, borderRadius: pad * CASE.padRadius * 0.6, backgroundColor: led.on }, padStyle]} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
