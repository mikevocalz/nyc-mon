'use client';
import Svg, { Path, Rect } from 'react-native-svg';
import { CARE_COLORS } from './care-colors';
import { CareRingFrame, notchRect } from './CareMeterRing.shared';
import { CARE_RING_SIZE, type CareMeterRingProps } from './CareMeterRing.types';
import { arcPath, clamp01 } from './ring-model';

export type { CareMeterRingProps };

/** PLATFORM FORK (web): the same ring as SVG, same props (M13 P1 "Web: SVG fallback"). */
export function CareMeterRing(props: CareMeterRingProps) {
  const { value, low, size = 'md', scheme = 'daylit' } = props;
  const { d, stroke } = CARE_RING_SIZE[size];
  const c = d / 2;
  const r = c - stroke / 2;
  const n = notchRect(d, stroke);
  const v = clamp01(value);
  return (
    <CareRingFrame
      props={props}
      canvas={(
        <Svg width={d} height={d}>
          <Path d={arcPath(c, c, r, 0, 360)} stroke={CARE_COLORS.track[scheme]} strokeWidth={stroke} fill="none" />
          {v > 0 ? <Path d={arcPath(c, c, r, 0, 360 * v)} stroke={CARE_COLORS.fill[scheme]} strokeWidth={stroke} fill="none" /> : null}
          {low ? <Rect x={n.x} y={n.y} width={n.width} height={n.height} fill={CARE_COLORS.notch[scheme]} /> : null}
        </Svg>
      )}
    />
  );
}
