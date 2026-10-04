'use client';
import '../rn-globals-shim';

import { useMemo } from 'react';
import {
  BlurMask, Canvas, Circle, Group, Line, LinearGradient, Path, Skia, vec, type SkPath,
} from 'react-native-skia';
import { brand } from '@acme/theme';
import { withAlpha } from '../neon/colors';
import { useInstanceStore, useStore } from '../use-instance-store';
import { useLayoutSize } from '../use-layout-size';
import { View } from '../tw';
import { linePoints, nearestIndex, smoothPath, type PathCommand, type Point } from './chart-model';
import { GLOW_BLUR, type LinePlotProps } from './LinePlot.types';
import { useIntro } from './use-intro';

type PointerLike = { nativeEvent: { offsetX?: number; locationX?: number } };

function toPath(cmds: PathCommand[], close?: { bottom: number; first: Point; last: Point }): SkPath {
  const b = Skia.PathBuilder.Make();
  for (const c of cmds) {
    if (c.type === 'M') b.moveTo(c.x, c.y);
    else b.cubicTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
  }
  if (close) b.lineTo(close.last.x, close.bottom).lineTo(close.first.x, close.bottom).close();
  return b.detach();
}

/**
 * Web drawing of the line plot: the react-native-graph curve built from the
 * shared model with static Skia props. The intro is a left-to-right clip
 * reveal; selection follows the pointer (mouse, pen or a dragged finger).
 */
export default function LinePlotSkia({
  series, range, strokeWidth, area, keylines, glow, selectable, indicator, onSelect, reduced, pad,
}: LinePlotProps) {
  const { size, onLayout } = useLayoutSize();
  const { width, height } = size;
  const box = useMemo(() => ({ width, height, padX: pad, padY: pad }), [width, height, pad]);
  const selection = useInstanceStore<{ index: number }>(() => ({ index: -1 }));
  const selected = useStore(selection, (s) => s.index);
  const progress = useIntro(900, reduced);

  const shapes = useMemo(
    () =>
      series.map((s) => {
        const points = linePoints(s.values, range, box);
        const cmds = smoothPath(points);
        const line = points.length ? toPath(cmds) : null;
        const fill = points.length > 1 ? toPath(cmds, { bottom: height, first: points[0]!, last: points[points.length - 1]! }) : null;
        return { ...s, points, line, fill };
      }),
    [series, range, box, height],
  );

  const count = series[0]?.values.length ?? 0;
  const pick = (event: PointerLike) => {
    if (!selectable) return;
    const x = event.nativeEvent.offsetX ?? event.nativeEvent.locationX;
    if (x === undefined) return;
    const index = nearestIndex(x, count, box);
    if (index === selection.getState().index) return;
    selection.setState({ index });
    onSelect?.(index);
  };
  const clear = () => {
    if (selection.getState().index === -1) return;
    selection.setState({ index: -1 });
    onSelect?.(null);
  };

  const blur = GLOW_BLUR[glow];
  const lead = shapes[0];
  const dot = selected >= 0 ? lead?.points[selected] : undefined;
  const end = lead?.points[lead.points.length - 1];

  return (
    <View
      className="absolute inset-0"
      onLayout={onLayout}
      {...({ onPointerMove: pick, onPointerDown: pick, onPointerLeave: clear } as object)}
    >
      {/* Skia surface: Canvas takes a style, not a className. */}
      <Canvas style={{ flex: 1 }}>
        <Group clip={Skia.XYWHRect(0, 0, Math.max(1, width * progress), height)}>
          {area
            ? shapes.map((s, i) =>
                s.fill ? (
                  <Path key={`fill-${i}`} path={s.fill} style="fill">
                    <LinearGradient
                      start={vec(0, 0)}
                      end={vec(0, height)}
                      colors={[withAlpha(s.color, i === 0 ? 0.55 : 0.3), withAlpha(s.color, 0.04)]}
                    />
                  </Path>
                ) : null,
              )
            : null}
          {shapes.map((s, i) =>
            s.line ? (
              <Group key={`line-${i}`}>
                {blur > 0 ? (
                  <Path path={s.line} style="stroke" strokeWidth={strokeWidth + 2} color={withAlpha(s.color, 0.7)} strokeCap="round" strokeJoin="round">
                    <BlurMask blur={blur} style="normal" />
                  </Path>
                ) : null}
                {keylines ? (
                  <Path path={s.line} style="stroke" strokeWidth={strokeWidth + 4} color={s.keyline} strokeCap="round" strokeJoin="round" />
                ) : null}
                <Path path={s.line} style="stroke" strokeWidth={strokeWidth} color={s.color} strokeCap="round" strokeJoin="round" />
              </Group>
            ) : null,
          )}
        </Group>
        {dot ? (
          <Group>
            <Line p1={vec(dot.x, 0)} p2={vec(dot.x, height)} color={withAlpha(brand.white, 0.35)} strokeWidth={1} />
            {shapes.map((s, i) => {
              const p = s.points[selected];
              return p ? (
                <Group key={`dot-${i}`}>
                  <Circle cx={p.x} cy={p.y} r={strokeWidth + 5} color={s.keyline} />
                  <Circle cx={p.x} cy={p.y} r={strokeWidth + 2.5} color={s.color} />
                </Group>
              ) : null;
            })}
          </Group>
        ) : indicator && end && progress >= 1 ? (
          <Group>
            <Circle cx={end.x} cy={end.y} r={strokeWidth + 4} color={lead!.keyline} />
            <Circle cx={end.x} cy={end.y} r={strokeWidth + 1.5} color={lead!.color} />
          </Group>
        ) : null}
      </Canvas>
    </View>
  );
}
