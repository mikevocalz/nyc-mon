'use client';
import { useMemo, type ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { brand } from '@acme/theme';
import { Article, Heading, Paragraph } from './primitives';
import { NIGHT_SCHEME, NightScope } from './NightScope';
import { CARD_DEPTH, splitCardClasses } from './surface-look';
import { View } from './tw';
import { CornerCutFrame } from './neon/CornerCutFrame';
import type { CutCorner } from './neon/corner-cut';
import { NotchFrame } from './cards/NotchFrame';
import { BeamFrame, type BeamVariant } from './cards/BeamFrame';
import { DEFAULT_NOTCH, type NotchSide } from './cards/notch';
import { useReducedMotion } from './backgrounds/use-reduced-motion';
import { resolveControlTone, toneHex, toneInput, toneVariants, type ControlTone, type District } from './district';

/*
  The NYC-MON card. With no variant it is the corner-cut facade: a night face
  in a heavy district-tone ring over a solid depth plate, glow off, so any
  content a screen drops in stays the loudest thing. notch is a solid tone
  face with notches bitten out; beam is the night face whose ring carries a
  travelling light. Ported from NeonBlade UI's cards (MIT, see
  THIRD-PARTY-NOTICES.md).
*/
const neonCard = tv({
  slots: {
    face: 'gap-3',
    icon: 'mb-1 h-11 w-11 items-center justify-center border-2',
    title: 'my-0 font-display text-lg leading-tight md:text-xl',
    description: 'my-0 text-sm leading-relaxed md:text-base',
  },
  variants: {
    variant: {
      notch: { icon: 'border-ink-950 bg-ink-950' },
      cornerCut: { title: 'text-ink-50', description: 'text-silver-300' },
      beam: { title: 'text-ink-50', description: 'text-silver-300' },
    },
    size: {
      none: {},
      sm: { face: 'p-4' },
      md: { face: 'p-5 md:p-6' },
      lg: { face: 'p-6 md:p-8' },
      xl: { face: 'p-8 md:p-10' },
    },
    tone: toneVariants(() => ({})),
    notchTop: { true: { face: 'pt-7 md:pt-8' } },
  },
  compoundVariants: [
    // The notch face is the tone itself, so text and the icon tile take the on-face colour.
    ...toneVariantsList('notch', (t) => ({ title: t.onFace, description: t.onFace, icon: '' })),
    ...toneVariantsList('cornerCut', (t) => ({ icon: `${t.face} ${t.controlKeyline}` })),
    ...toneVariantsList('beam', (t) => ({ icon: `${t.face} ${t.controlKeyline}` })),
  ],
  defaultVariants: { size: 'md' },
});

function toneVariantsList(
  variant: 'notch' | 'cornerCut' | 'beam',
  pick: (c: import('./district').ToneClasses) => Record<string, string>,
) {
  const all = toneVariants(pick);
  return (Object.keys(all) as ControlTone[]).map((tone) => ({ variant, tone, class: all[tone] }));
}

export type CardVariant = 'default' | 'notch' | 'cornerCut' | 'beam';

export interface CardProps extends React.ComponentProps<typeof Article> {
  /**
   * cornerCut (the default) is the night facade in a tone ring; notch is a
   * solid tone face; beam carries a travelling light. `default` is an alias
   * for cornerCut.
   */
  variant?: CardVariant;
  /**
   * Legacy kit prop, read as the depth plate: flat drops it, card (default)
   * steps it 6px, raised 10px.
   */
  elevation?: keyof typeof CARD_DEPTH;
  /** Legacy kit prop: false drops the face padding so content can run edge to edge. Default true. */
  padded?: boolean;
  /** Colour family for the NeonBlade variants. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood: Downtown royal, Midtown orange, Harlem brick, Mega City carolina. */
  district?: District;
  /** NeonBlade variants: padding and type scale. Default md. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** NeonBlade variants: an icon in a solid tile above the title. */
  icon?: ReactNode;
  title?: string;
  description?: string;
  /** Heading level for `title`. Default 3. */
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Accent glow around the frame. Off by default: glow marks focus and active things, not every card. */
  glow?: boolean;
  // notch
  notchSides?: NotchSide[];
  notchSize?: number;
  notchWidth?: number;
  notchWidthV?: number;
  notchSkew?: number;
  // cornerCut and beam
  corner?: CutCorner;
  cornerSize?: number;
  // beam
  beamVariant?: BeamVariant;
  /** Second beam's tone for beamVariant="dual". Default carolina (royal on a carolina card). */
  beamToneB?: ControlTone;
  /** Seconds per lap. Default 4. */
  duration?: number;
  durationB?: number;
}

/**
 * `className` is split: layout classes (width, margin, flex-1, self-*) place
 * the card, everything else (gap, padding, row layout) styles the face that
 * holds the children, which is where the legacy card applied them.
 */
export function Card({ variant = 'cornerCut', ...props }: CardProps) {
  return <NeonCard {...props} variant={variant === 'default' ? 'cornerCut' : variant} />;
}

function NeonCard({
  variant, tone: toneProp, district, size = 'md', icon, title, description, titleLevel = 3, glow,
  notchSides, notchSize, notchWidth, notchWidthV, notchSkew,
  corner = 'bottom-right', cornerSize = 20, beamVariant = 'single', beamToneB, duration = 4, durationB = 6,
  className, children, elevation = 'card', padded = true, ...articleProps
}: CardProps & { variant: Exclude<CardVariant, 'default'> }) {
  const { outer, inner } = splitCardClasses(className);
  const depth = CARD_DEPTH[elevation];
  const tone = resolveControlTone(toneProp, district);
  const hex = toneHex(tone);
  const reduced = useReducedMotion();
  const sidesKey = (notchSides ?? DEFAULT_NOTCH.sides).join(',');
  const shape = useMemo(
    () => ({
      sides: sidesKey.split(',') as NotchSide[],
      size: notchSize ?? DEFAULT_NOTCH.size,
      width: notchWidth ?? DEFAULT_NOTCH.width,
      widthV: notchWidthV ?? DEFAULT_NOTCH.widthV,
      skew: notchSkew ?? DEFAULT_NOTCH.skew,
    }),
    [sidesKey, notchSize, notchWidth, notchWidthV, notchSkew],
  );
  const s = neonCard({
    variant, size: padded ? size : 'none', tone, notchTop: padded && variant === 'notch' && shape.sides.includes('top'),
  });
  const faceClass = s.face({ className: `${variant === 'notch' ? '' : NIGHT_SCHEME} ${padded ? '' : 'overflow-hidden'} ${inner}` });

  const body = (
    <>
      {icon ? <View aria-hidden className={s.icon()}>{icon}</View> : null}
      {title ? <Heading level={titleLevel} className={s.title()}>{title}</Heading> : null}
      {description ? <Paragraph className={s.description()}>{description}</Paragraph> : null}
      {children}
    </>
  );

  let frame: ReactNode;
  if (variant === 'notch') {
    frame = (
      <NotchFrame
        shape={shape}
        fill={hex.face}
        border={hex.keyline}
        depthColor={hex.plate}
        depth={depth}
        glow={glow ? hex.glow : undefined}
        className={faceClass}
      >
        {body}
      </NotchFrame>
    );
  } else if (variant === 'cornerCut') {
    frame = (
      <CornerCutFrame
        tone={toneInput(tone)}
        variant="outline"
        corner={corner}
        cut={cornerSize}
        borderWidth={4}
        depth={depth}
        glow={glow ? 'low' : false}
        className={faceClass}
      >
        {body}
      </CornerCutFrame>
    );
  } else {
    const toneB = beamToneB ?? (tone === 'carolina' ? 'royal' : 'carolina');
    frame = (
      <BeamFrame
        corner={corner}
        cut={cornerSize}
        borderWidth={4}
        fill={brand.night}
        track={hex.deep}
        beam={hex.highlight}
        tail={hex.face}
        beamB={toneHex(toneB).highlight}
        depthColor={hex.keyline}
        depth={depth}
        variant={beamVariant}
        duration={duration}
        durationB={durationB}
        still={reduced}
        className={faceClass}
      >
        {body}
      </BeamFrame>
    );
  }

  return (
    // The Article is the semantic card; the frame inside draws it.
    <Article className={outer} {...articleProps}>
      {variant === 'notch' ? frame : <NightScope>{frame}</NightScope>}
    </Article>
  );
}
