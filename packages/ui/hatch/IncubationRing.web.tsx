'use client';
import Svg, { Path } from 'react-native-svg';
import { arcPath, stopArcs } from '../care/ring-model';
import { RING_COLORS } from './ring-colors';
import { RingFrame, RingStops, ringLayout } from './IncubationRing.shared';
import { isChoiceRing, RING_STROKE, type IncubationRingCountdownProps, type IncubationRingProps } from './IncubationRing.types';
import { useCountdownProgress } from './use-countdown';

export type { IncubationRingProps };

function Countdown({ startedAt, endsAt, reducedMotion, sizePt = 64, centre, testID }: IncubationRingCountdownProps) {
  const { c, r } = ringLayout(sizePt, RING_STROKE.countdown);
  const p = useCountdownProgress(startedAt, endsAt, reducedMotion);
  return (
    <RingFrame
      testID={testID}
      sizePt={sizePt}
      centre={centre}
      canvas={(
        <Svg width={sizePt} height={sizePt}>
          <Path d={arcPath(c, c, r, 0, 360)} stroke={RING_COLORS.track} strokeWidth={RING_STROKE.countdown} fill="none" />
          {p > 0 ? (
            <Path
              d={arcPath(c, c, r, 0, 360 * p)}
              stroke={p >= 1 ? RING_COLORS.full : RING_COLORS.fill}
              strokeWidth={RING_STROKE.countdown}
              fill="none"
            />
          ) : null}
        </Svg>
      )}
    />
  );
}

/**
 * PLATFORM FORK (web): the same ring as SVG (react-native-svg), so a page
 * with a ring does not pull in CanvasKit. Stops are DOM radios with roving
 * tabindex; the countdown re-renders once a second (once a minute reduced).
 */
export function IncubationRing<V extends number>(props: IncubationRingProps<V>) {
  if (!isChoiceRing(props)) return <Countdown {...props} />;
  const { stops, value, progress, sizePt, scheme = 'daylit', centre, accessibilityLabel, testID } = props;
  const { c, r } = ringLayout(sizePt, RING_STROKE.choice);
  const arcs = stopArcs(stops.length, RING_STROKE.gap, r);
  const chosen = stops.findIndex((s) => s.value === value);
  return (
    <RingFrame
      testID={testID}
      sizePt={sizePt}
      centre={centre}
      group={{ label: accessibilityLabel }}
      canvas={(
        <Svg width={sizePt} height={sizePt}>
          {arcs.map((a, i) => (
            <Path
              key={i}
              d={arcPath(c, c, r, a.startDeg, a.sweepDeg)}
              stroke={i === chosen ? RING_COLORS.selected[scheme] : RING_COLORS.unselected}
              strokeWidth={RING_STROKE.choice}
              fill="none"
            />
          ))}
          {chosen >= 0 && progress !== undefined && progress > 0 ? (
            <Path
              d={arcPath(c, c, r, arcs[chosen]!.startDeg, arcs[chosen]!.sweepDeg * Math.min(1, progress))}
              stroke={RING_COLORS.full}
              strokeWidth={RING_STROKE.choice}
              fill="none"
            />
          ) : null}
        </Svg>
      )}
    >
      <RingStops {...props} />
    </RingFrame>
  );
}
