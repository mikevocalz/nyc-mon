import { tv } from 'tailwind-variants';
import { ChevronDown } from '../icons';
import { View } from '../tw';
import { TONE_CLASSES, type ControlTone } from '../district';

/**
 * The kit's one disclosure chevron: a heavy down-chevron on a solid tone
 * tile, the same nameplate block the neon fields use for their labels. It
 * turns 180 degrees when the thing it opens is open (`open`), or points
 * right and turns down for a disclosure row (`direction="side"`). Every
 * dropdown, select and collapsible uses it, so they all read alike.
 * Decorative: the control that owns it carries the expanded state.
 */
const chevron = tv({
  slots: {
    tile: 'shrink-0 items-center justify-center border-2',
    icon: 'transition-transform duration-fast motion-reduce:transition-none',
  },
  variants: {
    size: {
      sm: { tile: 'h-5 w-5' },
      md: { tile: 'h-7 w-7' },
      lg: { tile: 'h-9 w-9' },
    },
    plain: {
      // No tile: the bare chevron in the tone's text step, for tight rows (nav links).
      true: { tile: 'border-0 bg-transparent' },
    },
  },
  defaultVariants: { size: 'md', plain: false },
});

const ICON_SIZE = { sm: 14, md: 18, lg: 22 } as const;

export interface NeonChevronProps {
  open?: boolean;
  /** down: points down, flips up when open (selects, menus). side: points right, turns down when open (disclosure rows). */
  direction?: 'down' | 'side';
  tone?: ControlTone;
  size?: 'sm' | 'md' | 'lg';
  /** Drop the tile and draw the chevron alone in the tone's text colour. */
  plain?: boolean;
  /** Greys the chevron for a disabled control. */
  disabled?: boolean;
  className?: string;
}

export function NeonChevron({
  open = false, direction = 'down', tone = 'orange', size = 'md', plain = false, disabled = false, className,
}: NeonChevronProps) {
  const t = TONE_CLASSES[tone];
  const s = chevron({ size, plain });
  const turn = direction === 'side' ? (open ? 'rotate-0' : '-rotate-90') : open ? 'rotate-180' : 'rotate-0';
  const tileColour = plain ? '' : disabled ? 'border-ink-700 bg-ink-800' : `${t.face} ${t.controlKeyline}`;
  const iconColour = disabled ? 'text-ink-400' : plain ? t.text : t.onFace;
  return (
    <View aria-hidden pointerEvents="none" className={s.tile({ className: `${tileColour} ${className ?? ''}` })}>
      {/* The turn sits on a View: a rotate class on the SVG itself resolves to a
          transform react-native-svg can't parse and crashes the icon on native. */}
      <View className={`${s.icon()} ${turn}`}>
        <ChevronDown size={ICON_SIZE[size]} strokeWidth={3} className={iconColour} />
      </View>
    </View>
  );
}
