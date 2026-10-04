'use client';
import { motionTokens, type MotionStep } from '@acme/theme';
import { AnimatedView } from '../progress/motion';
import { View } from '../tw';
import { hiddenA11y } from './a11y';
import { HLYNK_GEOMETRY } from './layout';

const TAP: { full: MotionStep; reduced: MotionStep } = motionTokens['motion-tap'];
const PAD = HLYNK_GEOMETRY.trackpadPt;
const INSET = HLYNK_GEOMETRY.ringInsetPt;
const RING_PT = 3;

/** Size of the trackpad face for each shape, in points. */
export function trackpadSize(shape: 'square' | 'pill', sizePt?: number) {
  return shape === 'square'
    ? { width: sizePt ?? PAD, height: sizePt ?? PAD }
    : { width: sizePt ?? HLYNK_GEOMETRY.pillPt.width, height: HLYNK_GEOMETRY.pillPt.height };
}

/**
 * The trackpad's look, shared by both platform forks: a black face with the
 * red ring inset 4 pt so black always separates it from the red body
 * (`apple-500` on black, 4.99:1; touching the body it would be 1.30:1).
 * The hatch adds an orange rim outside the ring. Pressed: scale 0.97 (full)
 * or a white ring (reduced, `motion-tap`). Decorative to assistive tech; the
 * control that wraps it carries the name.
 */
export function TrackpadFace({
  shape, sizePt, accent, disabled, pressed, reducedMotion,
}: {
  shape: 'square' | 'pill';
  sizePt: number | undefined;
  accent: 'ring' | 'hatch';
  disabled: boolean;
  pressed: boolean;
  reducedMotion: boolean;
}) {
  const size = trackpadSize(shape, sizePt);
  const radius = shape === 'pill' ? 'rounded-full' : '';
  const ringColor = disabled
    ? 'border-led-off'
    : pressed && reducedMotion
      ? 'border-hlynk-core-glyph-pressed'
      : 'border-hlynk-core-ring';
  const step = reducedMotion ? TAP.reduced : TAP.full;
  const durationMs = step.kind === 'tween' ? step.durationMs : 120;
  const scale = !reducedMotion && pressed && step.kind === 'tween' && step.scale !== undefined ? step.scale : 1;
  const hatch = accent === 'hatch' && !disabled;
  return (
    <AnimatedView
      {...hiddenA11y(true)}
      className={`bg-hlynk-core-black ${radius}`}
      style={{
        pointerEvents: 'none',
        ...size,
        transform: [{ scale }],
        transitionProperty: ['transform'],
        transitionDuration: `${durationMs}ms`,
        transitionTimingFunction: 'ease-out',
      } as object}
    >
      {hatch ? (
        <View
          className={`absolute border-hlynk-core-hatch-rim ${radius}`}
          style={{ left: INSET, top: INSET, right: INSET, bottom: INSET, borderWidth: RING_PT }}
        />
      ) : null}
      <View
        className={`absolute ${ringColor} ${radius}`}
        style={{
          left: INSET + (hatch ? RING_PT + 2 : 0),
          top: INSET + (hatch ? RING_PT + 2 : 0),
          right: INSET + (hatch ? RING_PT + 2 : 0),
          bottom: INSET + (hatch ? RING_PT + 2 : 0),
          borderWidth: RING_PT,
        }}
      />
    </AnimatedView>
  );
}
