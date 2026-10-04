'use client';
import '../rn-globals-shim';

import { useMemo } from 'react';
import { BlurMask, Canvas, CornerPathEffect, Group, Path, Skia, vec } from 'react-native-skia';
import { withAlpha } from '../neon/colors';
import type { ShadeSteps } from '../neon/shade';
import { polar, type Segment } from './chart-model';
import { useIntro, useIntroValue } from './use-intro';

export interface DonutCanvasProps {
  size: number;
  segments: Segment[];
  /** Shade steps per segment, aligned with `segments`. */
  shades: ShadeSteps[];
  inner: number;
  outer: number;
  /** Depth of the solid edge under the ring, in px. */
  depth: number;
  cornerRadius: number;
  /** Selected data index, or -1. */
  selected: number;
  glow: number;
  reduced: boolean;
}

function ringSegment(cx: number, cy: number, inner: number, outer: number, start: number, sweep: number) {
  const s = Math.min(sweep, 359.99);
  const o = Skia.XYWHRect(cx - outer, cy - outer, outer * 2, outer * 2);
  const i = Skia.XYWHRect(cx - inner, cy - inner, inner * 2, inner * 2);
  // Skia measures from 3 o'clock; segments are measured from 12.
  return Skia.PathBuilder.Make()
    .arcToOval(o, start - 90, s, true)
    .arcToOval(i, start - 90 + s, -s, false)
    .close()
    .detach();
}

function spin(p: number) {
  'worklet';
  return [{ rotate: (1 - p) * -0.7 }, { scale: 0.82 + 0.18 * p }];
}

/**
 * NeonDonutChart's drawing: a solid ring of segments on a darker edge (a
 * puck, like a badge medallion), the selected segment popped out with an
 * accent glow. The intro winds the ring in.
 */
export default function DonutCanvas({
  size, segments, shades, inner, outer, depth, cornerRadius, selected, glow, reduced,
}: DonutCanvasProps) {
  const cx = size / 2;
  const cy = size / 2 - depth / 2;
  const progress = useIntro(800, reduced);
  const transform = useIntroValue(progress, spin);

  const paths = useMemo(
    () =>
      segments.map((seg) => {
        const lift = seg.index === selected ? 7 : 0;
        const off = polar(0, 0, lift, seg.mid);
        return { seg, off, path: ringSegment(cx + off.x, cy + off.y, inner, outer, seg.start, seg.sweep) };
      }),
    [segments, selected, cx, cy, inner, outer],
  );

  return (
    // Skia surface: Canvas takes a style, not a className.
    <Canvas style={{ width: size, height: size }}>
      <Group transform={transform} origin={vec(cx, cy)}>
        {/* Solid edge: every segment again, dropped by `depth`, in its side shade. */}
        <Group transform={[{ translateY: depth }]}>
          {paths.map(({ seg, path }, i) => (
            <Path key={`edge-${seg.index}`} path={path} color={shades[i]!.deep}>
              {cornerRadius > 0 ? <CornerPathEffect r={cornerRadius} /> : null}
            </Path>
          ))}
        </Group>
        {paths.map(({ seg, path }, i) => {
          const s = shades[i]!;
          const on = selected < 0 || seg.index === selected;
          return (
            <Group key={seg.index} opacity={on ? 1 : 0.5}>
              {seg.index === selected && glow > 0 ? (
                <Path path={path} color={withAlpha(s.highlight, 0.9)}>
                  <BlurMask blur={glow} style="outer" />
                </Path>
              ) : null}
              <Path path={path} color={seg.index === selected ? s.top : s.face}>
                {cornerRadius > 0 ? <CornerPathEffect r={cornerRadius} /> : null}
              </Path>
            </Group>
          );
        })}
      </Group>
    </Canvas>
  );
}
