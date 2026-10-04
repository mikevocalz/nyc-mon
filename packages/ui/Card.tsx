'use client';
import { useMemo, type ReactNode } from 'react';
import { tv, type VariantProps } from 'tailwind-variants';
import { brand } from '@acme/theme';
import { Article, Heading, Paragraph } from './primitives';
import { View } from './tw';
import { CornerCutFrame } from './neon/CornerCutFrame';
import type { CutCorner } from './neon/corner-cut';
import { NotchFrame } from './cards/NotchFrame';
import { BeamFrame, type BeamVariant } from './cards/BeamFrame';
import { DEFAULT_NOTCH, type NotchSide } from './cards/notch';
import { useReducedMotion } from './backgrounds/use-reduced-motion';
import { resolveTone, toneHex, toneInput, toneVariants, type ControlTone, type District } from './cards/tones';

const card = tv({
  base: 'rounded-card bg-surface-raised',
  variants: {
    elevation: {
      flat: 'border-2 border-border',
      card: 'border-2 border-border shadow-card',
      raised: 'border-2 border-border shadow-raised',
    },
    padded: { true: 'p-5', false: 'overflow-hidden' },
  },
  defaultVariants: { elevation: 'card', padded: true },
});

/*
  NeonBlade card variants: notch, cornerCut and beam. Solid first: notch is
  a solid tone face, cornerCut is a night face in a heavy tone ring with an
  accent glow, beam is a night face whose ring carries a travelling light.
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
    ...toneVariantsList('cornerCut', (t) => ({ icon: `${t.face} ${t.keyline}` })),
    ...toneVariantsList('beam', (t) => ({ icon: `${t.face} ${t.keyline}` })),
  ],
  defaultVariants: { size: 'md' },
});

function toneVariantsList(
  variant: 'notch' | 'cornerCut' | 'beam',
  pick: (c: import('./cards/tones').ToneClasses) => Record<string, string>,
) {
  const all = toneVariants(pick);
  return (Object.keys(all) as ControlTone[]).map((tone) => ({ variant, tone, class: all[tone] }));
}

export type CardVariant = 'default' | 'notch' | 'cornerCut' | 'beam';

export interface CardProps
  extends React.ComponentProps<typeof Article>,
    VariantProps<typeof card> {
  /** default is the kit card; notch, cornerCut and beam are the NeonBlade ports. */
  variant?: CardVariant;
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
  /** Accent glow. Default on for cornerCut, off for notch and beam. */
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

export function Card(props: CardProps) {
  const { variant = 'default', elevation, padded, className, ...rest } = props;
  if (variant === 'default') {
    const {
      tone: _t, district: _d, size: _s, icon, title, description, titleLevel = 3, glow: _g,
      notchSides: _ns, notchSize: _nz, notchWidth: _nw, notchWidthV: _nv, notchSkew: _nk,
      corner: _c, cornerSize: _cs, beamVariant: _bv, beamToneB: _bt, duration: _du, durationB: _db,
      children, ...articleProps
    } = rest;
    return (
      <Article className={card({ elevation, padded, className })} {...articleProps}>
        {icon ? <View className="mb-3">{icon}</View> : null}
        {title ? <Heading level={titleLevel} className="my-0 text-lg font-semibold text-text">{title}</Heading> : null}
        {description ? <Paragraph className="my-0 text-text-muted">{description}</Paragraph> : null}
        {children}
      </Article>
    );
  }
  return <NeonCard {...props} variant={variant} />;
}

function NeonCard({
  variant, tone: toneProp, district, size = 'md', icon, title, description, titleLevel = 3, glow,
  notchSides, notchSize, notchWidth, notchWidthV, notchSkew,
  corner = 'bottom-right', cornerSize = 20, beamVariant = 'single', beamToneB, duration = 4, durationB = 6,
  className, children, elevation: _e, padded: _p, ...articleProps
}: CardProps & { variant: Exclude<CardVariant, 'default'> }) {
  const tone = resolveTone(toneProp, district);
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
  const s = neonCard({ variant, size, tone, notchTop: variant === 'notch' && shape.sides.includes('top') });

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
        glow={glow ? hex.glow : undefined}
        className={s.face()}
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
        depth={6}
        glow={glow === false ? false : 'low'}
        className={s.face()}
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
        variant={beamVariant}
        duration={duration}
        durationB={durationB}
        still={reduced}
        className={s.face()}
      >
        {body}
      </BeamFrame>
    );
  }

  return (
    // The Article is the semantic card; the frame inside draws it.
    <Article className={className} {...articleProps}>
      {frame}
    </Article>
  );
}
