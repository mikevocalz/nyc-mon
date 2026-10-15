'use client';
import '../rn-globals-shim';
import { useEffect, useMemo } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { Canvas, Path, Rect, Skia } from 'react-native-skia';
import { CARE_COLORS } from './care-colors';
import { CareRingFrame, notchRect } from './CareMeterRing.shared';
import { CARE_RING_SIZE, type CareMeterRingProps } from './CareMeterRing.types';
import { clamp01 } from './ring-model';

export type { CareMeterRingProps };

/**
 * PLATFORM FORK (native): a care meter drawn with Skia (`react-native-skia`
 * 3.0.2 `Path` trim `end` fed a shared value). A new value eases in over
 * 300 ms on the UI thread; reduced motion jumps. Skia draws state, never owns
 * it: `value` comes from `selectCareNow` on every minute tick.
 */
export function CareMeterRing(props: CareMeterRingProps) {
  const { value, low, size = 'md', scheme = 'daylit', reducedMotion } = props;
  const { d, stroke } = CARE_RING_SIZE[size];
  const r = d / 2 - stroke / 2;
  const ring = useMemo(
    () => Skia.PathBuilder.Make().addArc(Skia.XYWHRect(d / 2 - r, d / 2 - r, r * 2, r * 2), -90, 359.99).detach(),
    [d, r],
  );
  const end = useSharedValue(clamp01(value));
  useEffect(() => {
    end.set(reducedMotion ? clamp01(value) : withTiming(clamp01(value), { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [value, reducedMotion, end]);
  const n = notchRect(d, stroke);
  return (
    <CareRingFrame
      props={props}
      canvas={(
        <Canvas style={{ width: d, height: d }}>
          <Path path={ring} style="stroke" strokeWidth={stroke} color={CARE_COLORS.track[scheme]} />
          <Path path={ring} style="stroke" strokeWidth={stroke} color={CARE_COLORS.fill[scheme]} start={0} end={end} />
          {low ? <Rect x={n.x} y={n.y} width={n.width} height={n.height} color={CARE_COLORS.notch[scheme]} /> : null}
        </Canvas>
      )}
    />
  );
}
