'use client';
import '../rn-globals-shim';
import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import { Canvas, Path, Skia } from 'react-native-skia';
import { stopArcs } from '../care/ring-model';
import { RING_COLORS } from './ring-colors';
import { RingFrame, RingStops, ringLayout } from './IncubationRing.shared';
import { isChoiceRing, RING_STROKE, type IncubationRingCountdownProps, type IncubationRingProps } from './IncubationRing.types';
import { useCountdownProgress } from './use-countdown.native';

export type { IncubationRingProps };

/** A Skia arc path, angles from 12 o'clock (Skia measures from 3 o'clock). */
function arc(c: number, r: number, startDeg: number, sweepDeg: number) {
  const oval = Skia.XYWHRect(c - r, c - r, r * 2, r * 2);
  return Skia.PathBuilder.Make().addArc(oval, startDeg - 90, Math.min(sweepDeg, 359.99)).detach();
}

function Countdown({ startedAt, endsAt, reducedMotion, sizePt = 64, centre, testID }: IncubationRingCountdownProps) {
  const { c, r } = ringLayout(sizePt, RING_STROKE.countdown);
  const progress = useCountdownProgress(startedAt, endsAt, reducedMotion);
  const ring = useMemo(() => arc(c, r, 0, 360), [c, r]);
  // Fill is signage white while it runs; the whole ring turns orange when full.
  const color = useDerivedValue(() => (progress.get() >= 1 ? RING_COLORS.full : RING_COLORS.fill));
  const end = useDerivedValue(() => progress.get());
  return (
    <RingFrame
      testID={testID}
      sizePt={sizePt}
      centre={centre}
      canvas={(
        <Canvas style={{ width: sizePt, height: sizePt }}>
          <Path path={ring} style="stroke" strokeWidth={RING_STROKE.countdown} color={RING_COLORS.track} />
          <Path path={ring} style="stroke" strokeWidth={RING_STROKE.countdown} color={color} start={0} end={end} />
        </Canvas>
      )}
    />
  );
}

/**
 * PLATFORM FORK (native): `IncubationRing` drawn with Skia (the repo's
 * `react-native-skia` alias, 3.0.2: `Canvas`, `Path` with `start`/`end` trim,
 * `Skia.PathBuilder.addArc`). M10 passes `stops`: a radio ring. M11 passes
 * `startedAt`/`endsAt`: a decorative countdown whose trim end is a shared
 * value, so the ring fills without React renders.
 */
export function IncubationRing<V extends number>(props: IncubationRingProps<V>) {
  if (!isChoiceRing(props)) return <Countdown {...props} />;
  const { stops, value, progress, sizePt, scheme = 'daylit', centre, accessibilityLabel, testID } = props;
  const { c, r } = ringLayout(sizePt, RING_STROKE.choice);
  const arcs = stopArcs(stops.length, RING_STROKE.gap, r);
  const chosen = stops.findIndex((s) => s.value === value);
  const selected = RING_COLORS.selected[scheme];
  return (
    <RingFrame
      testID={testID}
      sizePt={sizePt}
      centre={centre}
      group={{ label: accessibilityLabel }}
      canvas={(
        <Canvas style={{ width: sizePt, height: sizePt }}>
          {arcs.map((a, i) => (
            <Path
              key={i}
              path={arc(c, r, a.startDeg, a.sweepDeg)}
              style="stroke"
              strokeWidth={RING_STROKE.choice}
              color={i === chosen ? selected : RING_COLORS.unselected}
            />
          ))}
          {chosen >= 0 && progress !== undefined && progress > 0 ? (
            <Path
              path={arc(c, r, arcs[chosen]!.startDeg, arcs[chosen]!.sweepDeg * Math.min(1, progress))}
              style="stroke"
              strokeWidth={RING_STROKE.choice}
              color={RING_COLORS.full}
            />
          ) : null}
        </Canvas>
      )}
    >
      <RingStops {...props} />
    </RingFrame>
  );
}
