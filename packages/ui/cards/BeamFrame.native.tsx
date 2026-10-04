import { useEffect, useMemo } from 'react';
import { Canvas, Group, Path, Rect, Skia, vec } from 'react-native-skia';
import {
  cancelAnimation, Easing, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { View } from '../tw';
import { useLayoutSize } from '../use-layout-size';
import { cornerCutPolygon, insetCut } from '../neon/corner-cut';
import { beamWidth, rotorSize, type BeamFrameProps } from './BeamFrame.types';

function polygonPath(points: [number, number][], dx = 0, dy = 0) {
  const builder = Skia.PathBuilder.Make();
  points.forEach(([x, y], i) => (i === 0 ? builder.moveTo(x + dx, y + dy) : builder.lineTo(x + dx, y + dy)));
  return builder.close().build();
}

const TAU = Math.PI * 2;
const STILL = (35 / 180) * Math.PI;

/**
 * Lap angle as a Reanimated shared value. Native views cannot be clipped to
 * the cut-corner polygon, so a CSS-animated rotor view (the web fork) would
 * spill past the cut. Here the rotor is drawn in Skia inside a clip group,
 * and its angle is a Reanimated 4 `withRepeat(withTiming)` loop passed to
 * Skia as an animated prop: no React render per frame.
 */
function useLap(seconds: number, still: boolean, reverse: boolean, start: number): SharedValue<number> {
  const angle = useSharedValue(start);
  useEffect(() => {
    if (still) {
      angle.set(start);
      return undefined;
    }
    angle.set(start);
    angle.set(withRepeat(withTiming(start + (reverse ? -TAU : TAU), { duration: seconds * 1000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(angle);
  }, [angle, seconds, still, reverse, start]);
  return angle;
}

/**
 * Native: one Skia canvas behind the content draws the depth plate, the
 * track ring, the rotating beam clipped to the frame, and the face. Content
 * sits on top, inset by the track width.
 */
export function BeamFrame({
  children, className, corner = 'bottom-right', cut = 20, borderWidth = 3,
  fill, track, beam, tail, beamB, depthColor, depth = 6,
  variant = 'single', duration = 4, durationB = 6, still = false,
}: BeamFrameProps) {
  const { size, onLayout } = useLayoutSize();
  const { width, height } = size;
  const s = rotorSize(width, height);
  const bar = beamWidth(width, height);
  const cx = width / 2;
  const cy = height / 2;

  const paths = useMemo(() => {
    const c = corner === 'none' ? 0 : cut;
    const k = corner === 'none' ? 'all' : corner;
    const outer = cornerCutPolygon(width, height, c, k);
    const inner = cornerCutPolygon(width - borderWidth * 2, height - borderWidth * 2, insetCut(c, borderWidth), k);
    return { outer: polygonPath(outer), depth: polygonPath(outer, depth, depth), inner: polygonPath(inner, borderWidth, borderWidth) };
  }, [width, height, corner, cut, borderWidth, depth]);

  const lapA = useLap(duration, still, false, STILL);
  const lapB = useLap(durationB, still || variant !== 'dual', true, STILL + Math.PI);
  const transformA = useDerivedValue(() => [{ rotate: lapA.get() }]);
  const transformB = useDerivedValue(() => [{ rotate: lapB.get() }]);
  // Pulse: brightness follows the lap, dimmest halfway round.
  const opacityA = useDerivedValue(() =>
    variant === 'pulse' ? 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(lapA.get() - STILL)) : 1,
  );

  const top = cy - s / 2;

  return (
    <View className="relative" onLayout={onLayout}>
      {/* Skia surface: Canvas takes a style, not a className. Sized past the frame by the depth plate. Decorative. */}
      <Canvas aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: width + depth, height: height + depth, pointerEvents: 'none' }}>
        {depth > 0 ? <Path path={paths.depth} color={depthColor} /> : null}
        <Path path={paths.outer} color={track} />
        <Group clip={paths.outer}>
          <Group origin={vec(cx, cy)} transform={transformA} opacity={opacityA}>
            <Rect x={cx - bar} y={top} width={bar * 2} height={s / 2} color={tail} />
            <Rect x={cx - bar / 2} y={top} width={bar} height={s / 2} color={beam} />
          </Group>
          {variant === 'dual' && beamB ? (
            <Group origin={vec(cx, cy)} transform={transformB}>
              <Rect x={cx - bar / 2} y={top} width={bar} height={s / 2} color={beamB} />
            </Group>
          ) : null}
        </Group>
        <Path path={paths.inner} color={fill} />
      </Canvas>
      {/* Computed: the inset equals the borderWidth prop. */}
      <View className={className} style={{ margin: borderWidth }}>
        {children}
      </View>
    </View>
  );
}
