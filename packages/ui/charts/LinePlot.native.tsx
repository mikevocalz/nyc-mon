import { useMemo } from 'react';
import { Circle, Group, Line, vec } from 'react-native-skia';
import { LineGraph, type GraphPoint, type SelectionDotProps } from 'react-native-graph';
import {
  useAnimatedReaction, useDerivedValue, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { brand } from '@acme/theme';
import { withAlpha } from '../neon/colors';
import { View } from '../tw';
import { keylineFor } from './district-tones';
import type { LinePlotProps } from './LinePlot.types';

const SPRING = { mass: 1, stiffness: 900, damping: 50 } as const;

/**
 * The NYC-MON selection dot for react-native-graph: a solid disc on a
 * keyline ring over a thin rule, the same mark the web plot draws.
 * Everything runs on the UI thread from the graph's shared values.
 */
function NycSelectionDot({ isActive, color, circleX, circleY }: SelectionDotProps) {
    const keyline = keylineFor(color);
    const radius = useSharedValue(0);
    useAnimatedReaction(
      () => isActive.get(),
      (active) => {
        radius.set(withSpring(active ? 1 : 0, SPRING));
      },
    );
    const ring = useDerivedValue(() => radius.get() * 8);
    const face = useDerivedValue(() => radius.get() * 5.5);
    const ruleOpacity = useDerivedValue(() => radius.get() * 0.35);
    const top = useDerivedValue(() => vec(circleX.get(), 0));
    // Taller than any chart; the canvas clips it.
    const bottom = useDerivedValue(() => vec(circleX.get(), 2000));
    return (
      <Group>
        <Line p1={top} p2={bottom} color={brand.white} opacity={ruleOpacity} strokeWidth={1} />
        <Circle cx={circleX} cy={circleY} r={ring} color={keyline} />
        <Circle cx={circleX} cy={circleY} r={face} color={color} />
      </Group>
    );
}

const toPoints = (values: number[]): GraphPoint[] => values.map((value, i) => ({ value, date: new Date(i) }));

/**
 * Native: react-native-graph's AnimatedLineGraph (Skia v3 via the
 * react-native-graph patch in patches/). One graph per layer, all sharing the
 * same x/y range and padding so they line up:
 *   glow halo (optional) < keyline < series line with gradient fill.
 * Only the first series takes the pan gesture; it renders last so it sits on
 * top for touches, and the rest ignore pointer events.
 */
export function LinePlot({
  series, range, strokeWidth, area, keylines, glow, selectable, indicator, onSelect, reduced, pad,
}: LinePlotProps) {
  const count = series[0]?.values.length ?? 0;
  const graphRange = useMemo(
    () => ({ x: { min: new Date(0), max: new Date(Math.max(1, count - 1)) }, y: range }),
    [count, range],
  );
  const layers = useMemo(() => series.map((s) => ({ ...s, points: toPoints(s.values) })), [series]);

  const common = {
    range: graphRange,
    horizontalPadding: pad,
    verticalPadding: pad,
    panGestureDelay: 0,
  } as const;

  return (
    <View className="absolute inset-0">
      {[...layers].reverse().map((s, ri) => {
        const i = layers.length - 1 - ri;
        const interactive = i === 0;
        return (
          <View key={i} className="absolute inset-0" pointerEvents={interactive ? 'auto' : 'none'}>
            {glow !== 'none' ? (
              <View className="absolute inset-0" pointerEvents="none">
                <LineGraph
                  {...common}
                  animated
                  points={s.points}
                  color={withAlpha(s.color, glow === 'high' ? 0.35 : 0.22)}
                  lineThickness={strokeWidth + (glow === 'low' ? 6 : 10)}
                  // Native graph View: style, the library takes no className.
                  style={{ flex: 1 }}
                />
              </View>
            ) : null}
            {keylines ? (
              <View className="absolute inset-0" pointerEvents="none">
                <LineGraph {...common} animated points={s.points} color={s.keyline} lineThickness={strokeWidth + 4} style={{ flex: 1 }} />
              </View>
            ) : null}
            <LineGraph
              {...common}
              animated
              points={s.points}
              color={s.color}
              lineThickness={strokeWidth}
              gradientFillColors={area ? [withAlpha(s.color, i === 0 ? 0.55 : 0.3), withAlpha(s.color, 0.04)] : undefined}
              enablePanGesture={selectable && interactive}
              enableIndicator={indicator && interactive}
              indicatorPulsating={indicator && interactive && !reduced}
              SelectionDot={interactive ? NycSelectionDot : null}
              onPointSelected={interactive ? (p) => onSelect?.(p.date.getTime()) : undefined}
              onGestureEnd={interactive ? () => onSelect?.(null) : undefined}
              style={{ flex: 1 }}
            />
          </View>
        );
      })}
    </View>
  );
}
