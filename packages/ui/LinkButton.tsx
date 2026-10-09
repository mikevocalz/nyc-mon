'use client';
import { tv } from 'tailwind-variants';
import { Link } from './html';
import { Text } from './tw';
import { CornerCutFrame } from './neon/CornerCutFrame';
import { TONE_CLASSES, type ControlTone, type District } from './district';
import { controlLook, frameTone, type ButtonVariant } from './control-look';

const link = tv({
  slots: {
    root:
      'group inline-flex shrink-0 self-start flex-col items-stretch no-underline transition-transform duration-fast ' +
      'active:translate-x-[3px] active:translate-y-[3px] ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
      'motion-reduce:transition-none',
    label: 'whitespace-nowrap font-display tracking-wide',
  },
  variants: {
    size: {
      sm: { label: 'text-sm md:text-base' },
      md: { label: 'text-sm md:text-base' },
      lg: { label: 'text-base md:text-lg' },
    },
  },
  defaultVariants: { size: 'md' },
});

// Same face padding and cut as Button, so a LinkButton and a Button line up.
const CUT_FACE = {
  sm: { className: 'px-5 py-2.5', cut: 10 },
  md: { className: 'px-6 py-3 md:px-8 md:py-3.5', cut: 14 },
  lg: { className: 'px-8 py-4 md:px-10 md:py-5', cut: 18 },
} as const;

/** Variants a link can take: the solid looks. Ghost and outline stay on Button. */
export type LinkButtonVariant = Exclude<ButtonVariant, 'ghost' | 'outline' | 'hlynk-care'>;

export interface LinkButtonProps {
  title: string;
  /** Where the link goes. A real `<a href>` on web, so it works without JavaScript and opens in a new tab. */
  href: string;
  /** Same names as Button. `cta` is the page's one primary call to action. Default the solid district face. */
  variant?: LinkButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  tone?: ControlTone;
  district?: District;
  className?: string;
  'aria-label'?: string;
  testID?: string;
}

/**
 * A link that looks like Button: the corner-cut face inside an anchor. Use it
 * when the action navigates (a CTA to another page); Button stays for actions
 * that happen in place. Press feedback is the same sink as Button's.
 */
export function LinkButton({ title, href, variant, size = 'md', tone: toneProp, district, className, testID, ...a11y }: LinkButtonProps) {
  const { look, tone } = controlLook(variant, toneProp, district);
  const s = link({ size });
  const labelClass = s.label({ className: variant === 'cta' ? 'text-on-cta' : TONE_CLASSES[tone].onFace });
  return (
    <Link href={href} className={s.root({ className })} data-testid={testID} {...a11y}>
      <CornerCutFrame
        tone={frameTone(look, tone)}
        variant="solid"
        corner="bottom-right"
        cut={CUT_FACE[size].cut}
        depth={4}
        className={`flex-row items-center justify-center gap-2 ${CUT_FACE[size].className}`}
      >
        <Text className={labelClass}>{title}</Text>
      </CornerCutFrame>
    </Link>
  );
}
