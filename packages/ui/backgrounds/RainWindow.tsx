'use client';

import { brand, palette } from '@acme/theme';
import type { NeonColorInput } from '../neon/colors';
import type { District } from './district-theme';
import { QuadBackground } from './QuadBackground';
import { useLayers, type SolidBackgroundBaseProps } from './QuadBackground.shared';
import { rainWindowLayers } from './rain-window-model';

/**
 * Rain on a city window at night: the district's skyline through wet glass,
 * angled rain outside, beads and rivulets on the pane, and a solid window
 * frame in front (brownstone wood in Harlem).
 *
 * The port of NeonBlade UI's Pluviophile (MIT, see THIRD-PARTY-NOTICES.md).
 * It keeps its props: `dropColor`, `dropCount`, `speed`, `angle`,
 * `dropMinLength`, `dropMaxLength`, `dropWidth`, `opacity` and
 * `backgroundColor`.
 */
export interface RainWindowProps extends SolidBackgroundBaseProps {
  /** The view and the frame material. Default harlem. */
  district?: District;
  /** NeonBlade name. Default carolina-200. */
  dropColor?: NeonColorInput;
  /** NeonBlade name: streaks outside; beads on the glass scale with it. Default 150. */
  dropCount?: number;
  /** NeonBlade name: px per frame at 60 fps. Default 12. */
  speed?: number;
  /** NeonBlade name: degrees from vertical, -60 to 60. Default -15. */
  angle?: number;
  /** NeonBlade name. Default 15. */
  dropMinLength?: number;
  /** NeonBlade name. Default 40. */
  dropMaxLength?: number;
  /** NeonBlade name. Default 1. */
  dropWidth?: number;
  /** NeonBlade name: rain opacity, 0 to 1. Default 0.75. */
  opacity?: number;
  /** NeonBlade name: sky colour. Default night. */
  backgroundColor?: string;
  /** The window frame. Default true. */
  frame?: boolean;
  /** Default 1. */
  seed?: number;
}

export function RainWindow({
  district = 'harlem',
  dropColor = palette.carolina[200],
  dropCount = 150,
  speed = 12,
  angle = -15,
  dropMinLength = 15,
  dropMaxLength = 40,
  dropWidth = 1,
  opacity = 0.75,
  backgroundColor = brand.night,
  frame = true,
  seed = 1,
  ...rest
}: RainWindowProps) {
  const layers = useLayers(rainWindowLayers, {
    district, dropColor, dropCount, speed, angle, dropMinLength, dropMaxLength, dropWidth,
    opacity: Math.max(0, Math.min(1, opacity)), backgroundColor, frame, seed,
  });
  return <QuadBackground {...rest} layers={layers} background={backgroundColor} />;
}
