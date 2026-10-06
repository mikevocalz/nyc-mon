'use client';
import { useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { tv } from 'tailwind-variants';
import { brand } from '@acme/theme';
import { Article, Heading, Paragraph } from './primitives';
import { NIGHT_SCHEME, NightScope } from './NightScope';
import { CARD_DEPTH, splitCardClasses } from './surface-look';
import { View } from './tw';
import { CornerCutFrame } from './neon/CornerCutFrame';
import { ROUND_RADIUS } from './neon/corner-cut';
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
/*
  The notch face is the tone itself in both themes, so themed text dropped on
  it takes the tone's on-face step: night ink on the light tones, white on
  royal and brick. Muted and secondary collapse to the same step; no lighter
  step holds 4.5:1 on a tone face.
*/
const NOTCH_ON_INK =
  '[--color-text:var(--color-ink-950)] [--color-text-muted:var(--color-ink-950)] [--color-text-secondary:var(--color-ink-950)]';
const NOTCH_ON_WHITE =
  '[--color-text:var(--color-white)] [--color-text-muted:var(--color-white)] [--color-text-secondary:var(--color-white)]';

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
    ...toneVariantsList('notch', (t) => ({
      title: t.onFace, description: t.onFace, icon: '',
      face: Platform.OS === 'web' ? (t.onFace === 'text-ink-950' ? NOTCH_ON_INK : NOTCH_ON_WHITE) : '',
    })),
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
  /** Opt-in rounded corners (rounded-soft) for the corner-cut card. Default false: square, cut. Notch and beam keep their shape. */
  rounded?: boolean;
  /**
   * cornerCut (the default) is the night facade in a tone ring; notch is a
   * solid tone face; beam carries a travelling light. `default` is an alias
   * for cornerCut.
   */
  variant?: CardVariant;
  /**
   * 'night' (default) is the facade; 'page' is the ops console's daylit face
   * (04-components.md G1): a `surface-raised` panel with a `border` keyline,
   * themed text, no frame, plate, glow or cut.
   */
  surface?: 'night' | 'page';
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
export function Card({ variant = 'cornerCut', surface = 'night', ...props }: CardProps) {
  if (surface === 'page') return <PageCard {...props} />;
  return <NeonCard {...props} variant={variant === 'default' ? 'cornerCut' : variant} />;
}

/**
 * The `surface="page"` face (G1): one raised panel, themed type, no frame,
 * plate, glow or cut. Separate component so the NeonBlade hooks stay
 * unconditional.
 */
function PageCard({
  size = 'md', icon, title, description, titleLevel = 3,
  className, children, padded = true, rounded = false, ...articleProps
}: CardProps) {
  const { outer, inner } = splitCardClasses(className);
  const sizePad = padded ? { none: '', sm: 'p-4', md: 'p-5 md:p-6', lg: 'p-6 md:p-8', xl: 'p-8 md:p-10' }[size] : '';
  return (
    <Article className={`border border-border bg-surface-raised ${rounded ? 'rounded-soft' : ''} ${outer}`} {...articleProps}>
      <View className={`gap-3 ${sizePad} ${inner}`}>
        {icon ? <View aria-hidden className="mb-1 h-11 w-11 items-center justify-center border-2 border-border">{icon}</View> : null}
        {title ? <Heading level={titleLevel} className="my-0 font-display text-lg leading-tight text-text md:text-xl">{title}</Heading> : null}
        {description ? <Paragraph className="my-0 text-sm leading-relaxed text-text-secondary md:text-base">{description}</Paragraph> : null}
        {children}
      </View>
    </Article>
  );
}

function NeonCard({
  variant, tone: toneProp, district, size = 'md', icon, title, description, titleLevel = 3, glow,
  notchSides, notchSize, notchWidth, notchWidthV, notchSkew,
  corner = 'bottom-right', cornerSize = 20, beamVariant = 'single', beamToneB, duration = 4, durationB = 6,
  className, children, elevation = 'card', padded = true, rounded = false, surface: _surface, ...articleProps
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
  // cornerCut and beam faces are night in both themes: scheme-dark redeclares
  // every semantic token at its dark value (@acme/theme theme.css).
  const night = variant === 'notch' ? '' : NIGHT_SCHEME;
  const faceClass = s.face({ className: `${night} ${padded ? '' : 'overflow-hidden'} ${inner}` });

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
        radius={rounded ? ROUND_RADIUS : 0}
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
