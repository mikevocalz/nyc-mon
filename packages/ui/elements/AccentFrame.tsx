'use client';
import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { useReducedMotion } from '../backgrounds/use-reduced-motion';
import type { NeonColorInput } from '../neon/colors';
import { AnimatedView, cssAnimation } from '../progress/motion';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { resolveAccent, resolveTone, TONE_CLASSES, type District, type Tone } from './tones';
import { cornerPieces, type Corner, type CornerStyle } from './accent-frame-model';

export type AccentFrameHoverEffect = 'expand' | 'glow' | 'pulse' | 'flicker' | 'none';
export type { CornerStyle };

/**
 * Corner accents built like the tops of buildings: stepped setbacks, or a
 * heavy cornice with dentils underneath. Ported from NeonBlade UI's
 * AccentFrame (MIT, see THIRD-PARTY-NOTICES.md), keeping its props; the thin
 * neon brackets became solid stacked blocks.
 */
export interface AccentFrameProps {
  children?: ReactNode;
  /** Primary corners (top-left, and bottom-left in quad). Defaults to the district tone. */
  color?: NeonColorInput | Tone;
  /** The opposite pair. Defaults to the district accent. */
  colorB?: NeonColorInput | Tone;
  /** Arm length in px. Default 28. */
  cornerLength?: number;
  /** Block thickness in px. Default 5. */
  cornerThickness?: number;
  /** Arm length while hovered with hoverEffect="expand". Default 48. */
  hoverLength?: number;
  /** Hover transition in ms. Default 300. */
  transitionDuration?: number;
  /**
   * setback: two stepped tiers, a Deco tower's shoulders.
   * cornice: a heavy cap with dentils, the brownstone roofline.
   * square: one solid L.
   * Default setback.
   */
  cornerStyle?: CornerStyle;
  /** duo: top-left and bottom-right. quad: all four. Default duo. */
  mode?: 'duo' | 'quad';
  /** What happens on pointer hover. Default expand. */
  hoverEffect?: AccentFrameHoverEffect;
  /** Glow strength for glow and pulse. Default medium. */
  glowIntensity?: 'low' | 'medium' | 'high';
  /** Run the hover effect all the time. Default false. */
  animated?: boolean;
  /** Fill inside the frame. Default none. */
  bgVariant?: 'none' | 'subtle' | 'solid';
  /** Default midtown. */
  district?: District;
  className?: string;
}

const frame = tv({
  slots: {
    root: 'relative px-6 py-4',
    corner: 'absolute',
    piece: 'absolute',
    content: 'relative z-10',
  },
  variants: {
    bg: {
      none: {},
      subtle: { root: 'bg-ink-900/50' },
      solid: { root: 'bg-ink-950' },
    },
  },
});

interface HoverState {
  hovered: boolean;
}

export function AccentFrame({
  children,
  color,
  colorB,
  cornerLength = 28,
  cornerThickness = 5,
  hoverLength = 48,
  transitionDuration = 300,
  cornerStyle = 'setback',
  mode = 'duo',
  hoverEffect = 'expand',
  glowIntensity = 'medium',
  animated = false,
  bgVariant = 'none',
  district = 'midtown',
  className,
}: AccentFrameProps) {
  const reduced = useReducedMotion();
  const store = useInstanceStore<HoverState>(() => ({ hovered: false }));
  const hovered = useStore(store, (st) => st.hovered);
  const active = animated || hovered;
  const s = frame({ bg: bgVariant });

  const toneA = resolveTone(district, color);
  const toneB = colorB !== undefined ? resolveTone(district, colorB) : resolveAccent(district, toneA);
  const corners: Corner[] = mode === 'quad' ? ['tl', 'tr', 'br', 'bl'] : ['tl', 'br'];
  const t = Math.max(2, cornerThickness);
  const length = hoverEffect === 'expand' && active ? hoverLength : cornerLength;
  const glowing = active && (hoverEffect === 'glow' || hoverEffect === 'pulse');
  const loop =
    active && hoverEffect === 'pulse'
      ? cssAnimation(reduced, 'pulse', 1200, { timing: 'ease-in-out' })
      : active && hoverEffect === 'flicker'
        ? cssAnimation(reduced, 'flicker', 1800)
        : undefined;
  const glowClass = glowIntensity === 'low' ? 'shadow-card' : glowIntensity === 'high' ? 'shadow-overlay' : '';

  // Pointer hover only; touch screens never fire these, and the frame stays at rest.
  const hoverHandlers = {
    onPointerEnter: () => store.setState({ hovered: true }),
    onPointerLeave: () => store.setState({ hovered: false }),
  };

  return (
    <View className={s.root({ className })} {...(hoverHandlers as object)}>
      {corners.map((corner) => {
        const tone = TONE_CLASSES[corner === 'tl' || corner === 'bl' ? toneA : toneB];
        const [v, h] = corner === 'tl' ? ['top', 'left'] : corner === 'tr' ? ['top', 'right'] : corner === 'br' ? ['bottom', 'right'] : ['bottom', 'left'];
        return (
          <AnimatedView
            key={corner}
            aria-hidden
            pointerEvents="none"
            className={s.corner()}
            // Animated: arm length transitions on hover; position and size come from px props.
            style={{
              [v]: -t / 2,
              [h]: -t / 2,
              width: length,
              height: length,
              transitionProperty: ['width', 'height'],
              transitionDuration: reduced ? '0ms' : `${transitionDuration}ms`,
              transitionTimingFunction: 'ease-out',
              ...loop,
            }}
          >
            {cornerPieces(cornerStyle, t).map((p, i) => (
              <View
                key={i}
                className={s.piece({
                  className: `${p.shade === 'face' ? tone.face : p.shade === 'side' ? tone.side : tone.top} ${glowing && p.shade === 'face' ? `${tone.glow} ${glowClass}` : ''}`,
                })}
                // Piece geometry is computed from the corner thickness (and arm %).
                style={{
                  [v]: p.y,
                  [h]: p.x,
                  width: p.width,
                  height: p.height,
                }}
              />
            ))}
          </AnimatedView>
        );
      })}
      <View className={s.content()}>{children}</View>
    </View>
  );
}
