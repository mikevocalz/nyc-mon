'use client';

import { SkiaWebGate } from '../backgrounds/SkiaWebGate';
import type { LinePlotProps } from './LinePlot.types';

const loadSkia = () => import('./LinePlot.skia');

/**
 * Web: react-native-graph does not work here. Its AnimatedLineGraph feeds the
 * line path and the selection dot through Reanimated shared values, and on
 * CanvasKit those props never draw (verified in Storybook: the gradient
 * paints, the stroke does not, the dot sits at 0,0). StaticLineGraph draws
 * but has no fill and no pan. So web draws the same B-spline from
 * chart-model.smoothPath with static Skia props, with pointer selection.
 */
export function LinePlot(props: LinePlotProps) {
  return <SkiaWebGate load={loadSkia} props={props} />;
}
