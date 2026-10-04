'use client';
import '../rn-globals-shim';

import { useMemo } from 'react';
import { BlurMask, Canvas, Group, Path, Rect, Skia, vec, type SkPath } from 'react-native-skia';
import { palette } from '@acme/theme';
import { withAlpha } from '../neon/colors';
import type { ShadeSteps } from '../neon/shade';
import { buildingWindows, type Bar, type BarLayout } from './chart-model';
import type { District } from './district-tones';
import { useIntro, useIntroValue } from './use-intro';

export interface BarCanvasProps {
  layout: BarLayout;
  width: number;
  height: number;
  orientation: 'vertical' | 'horizontal';
  /** Shade steps per bar, aligned with layout.bars. */
  shades: ShadeSteps[];
  /** Lit-window colour. */
  light: string;
  district: District;
  /** Selected category, or -1. */
  selected: number;
  windows: boolean;
  /** Crown the tallest building with its district's landmark top. */
  crown: boolean;
  glow: number;
  reduced: boolean;
}

const poly = (pts: number[]) => {
  const b = Skia.PathBuilder.Make().moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) b.lineTo(pts[i]!, pts[i + 1]!);
  return b.close().detach();
};

/** Side wall up and to the right of the face. */
const sideWall = (b: Bar) => poly([b.x + b.w, b.y, b.x + b.w + b.depth, b.y - b.depth, b.x + b.w + b.depth, b.y + b.h - b.depth, b.x + b.w, b.y + b.h]);
/** Roof: the lit top surface. */
const roof = (b: Bar) => poly([b.x, b.y, b.x + b.depth, b.y - b.depth, b.x + b.w + b.depth, b.y - b.depth, b.x + b.w, b.y]);

/** The district's landmark top, drawn on the roof of the tallest building. */
function crownPath(b: Bar, district: District, next: Bar | undefined): SkPath {
  const cx = b.x + b.w / 2;
  const builder = Skia.PathBuilder.Make();
  switch (district) {
    case 'downtown': {
      // One-WTC-like taper into a spire.
      const s = Math.max(2, b.w * 0.08);
      builder.moveTo(b.x + b.w * 0.2, b.y).lineTo(cx - s, b.y - 10).lineTo(cx + s, b.y - 10).lineTo(b.x + b.w * 0.8, b.y).close();
      builder.addRect(Skia.XYWHRect(cx - 1, b.y - 26, 2, 16));
      break;
    }
    case 'midtown': {
      // Deco setbacks stepping up to a needle.
      builder.addRect(Skia.XYWHRect(b.x + b.w * 0.15, b.y - 6, b.w * 0.7, 6));
      builder.addRect(Skia.XYWHRect(b.x + b.w * 0.3, b.y - 12, b.w * 0.4, 6));
      builder.moveTo(cx - b.w * 0.12, b.y - 12).lineTo(cx, b.y - 24).lineTo(cx + b.w * 0.12, b.y - 12).close();
      break;
    }
    case 'harlem': {
      // Brownstone cornice: an overhanging band.
      builder.addRect(Skia.XYWHRect(b.x - 2, b.y - 4, b.w + b.depth + 4, 4));
      break;
    }
    case 'megacity': {
      // Sky bridge to the next building, a third of the way down.
      if (next) {
        const y = b.y + b.h * 0.3;
        const x0 = b.x + b.w + b.depth;
        builder.addRect(Skia.XYWHRect(x0, y, Math.max(0, next.x - x0), 5));
      }
      builder.addRect(Skia.XYWHRect(b.x + b.w * 0.25, b.y - 8, b.w * 0.5, 8));
      break;
    }
  }
  return builder.detach();
}

function windowPaths(bars: Bar[], light: string) {
  const lit = Skia.PathBuilder.Make();
  for (const b of bars) {
    if (b.value <= 0) continue;
    for (const w of buildingWindows(b)) lit.addRect(Skia.XYWHRect(w.x, w.y, w.w, w.h));
  }
  return { lit: lit.detach(), color: light };
}

type Grow = { scaleX: number } | { scaleY: number };

function scaleY(p: number): Grow[] {
  'worklet';
  return [{ scaleY: Math.max(0.001, p) }];
}
function scaleX(p: number): Grow[] {
  'worklet';
  return [{ scaleX: Math.max(0.001, p) }];
}

/**
 * NeonBarChart's drawing: every value is a solid building (face, side wall,
 * roof) standing on a street, lit windows as the accent, and the tallest one
 * crowned with its district's landmark top. The intro raises the skyline from
 * the street.
 */
export default function BarCanvas({
  layout, width, height, orientation, shades, light, district, selected, windows, crown, glow, reduced,
}: BarCanvasProps) {
  const vertical = orientation === 'vertical';
  const progress = useIntro(700, reduced);
  const transform = useIntroValue(progress, vertical ? scaleY : scaleX);

  const shapes = useMemo(
    () => layout.bars.map((b) => ({ bar: b, side: b.value >= 0 ? sideWall(b) : null, roof: b.value >= 0 ? roof(b) : null })),
    [layout],
  );
  const lit = useMemo(() => (windows && vertical ? windowPaths(layout.bars, light) : null), [windows, vertical, layout, light]);
  const tallestIndex = useMemo(() => {
    let best = -1;
    layout.bars.forEach((b, i) => {
      if (b.value > 0 && (best < 0 || b.value > layout.bars[best]!.value)) best = i;
    });
    return best;
  }, [layout]);
  const crownShape = useMemo(() => {
    if (!crown || !vertical || tallestIndex < 0) return null;
    const b = layout.bars[tallestIndex]!;
    return crownPath(b, district, layout.bars[tallestIndex + 1]);
  }, [crown, vertical, tallestIndex, layout, district]);

  const origin = vertical ? vec(0, layout.baseline) : vec(layout.baseline, 0);
  const dimmed = selected >= 0;

  return (
    // Skia surface: Canvas takes a style, not a className. Size is measured by the shell.
    <Canvas style={{ width, height }}>
      {/* The street the skyline stands on. */}
      {vertical ? (
        <Rect x={0} y={layout.baseline} width={width} height={Math.max(0, height - layout.baseline)} color={palette.ink[900]} />
      ) : (
        <Rect x={0} y={0} width={Math.max(0, layout.baseline)} height={height} color={palette.ink[900]} />
      )}
      <Group transform={transform} origin={origin}>
        {shapes.map(({ bar, side, roof: top }, i) => {
          const s = shades[i]!;
          const on = !dimmed || bar.index === selected;
          return (
            <Group key={i} opacity={on ? 1 : 0.45}>
              {on && dimmed && glow > 0 ? (
                <Rect x={bar.x} y={bar.y - bar.depth} width={bar.w + bar.depth} height={bar.h + bar.depth} color={withAlpha(s.highlight, 0.8)}>
                  <BlurMask blur={glow} style="outer" />
                </Rect>
              ) : null}
              <Rect x={bar.x} y={bar.y} width={bar.w} height={bar.h} color={on && dimmed ? s.top : s.face} />
              {side ? <Path path={side} color={s.side} /> : null}
              {top ? <Path path={top} color={s.highlight} /> : null}
              {crownShape && i === tallestIndex ? <Path path={crownShape} color={s.highlight} /> : null}
            </Group>
          );
        })}
        {lit ? <Path path={lit.lit} color={withAlpha(lit.color, 0.85)} /> : null}
      </Group>
    </Canvas>
  );
}
