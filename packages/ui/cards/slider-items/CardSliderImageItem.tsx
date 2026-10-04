'use client';
import { brand } from '@acme/theme';
import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { Badge } from '../../Badge';
import { Article, Heading, Paragraph, Text } from '../../html';
import { Image, type ImageProps } from '../../Image';
import { CornerCutFrame } from '../../neon/CornerCutFrame';
import { useReducedMotion } from '../../backgrounds/use-reduced-motion';
import { View } from '../../tw';
import { BeamFrame } from '../BeamFrame';
import type {
  CardSliderImageAspect, CardSliderImageFrame, CardSliderImageItemData,
} from '../card-slider.types';
import { NotchFrame } from '../NotchFrame';
import { DEFAULT_NOTCH } from '../notch';
import { DISTRICT_NAME, TONE_CLASSES, resolveTone, toneHex, toneInput } from '../tones';

const item = tv({
  slots: {
    // Notch: the top rail is the tone face, so the notch bites the rail, never the photo.
    face: 'overflow-hidden',
    photo: 'relative w-full overflow-hidden bg-ink-900',
    chip: 'absolute right-3 top-3 z-10',
    band: 'absolute inset-x-0 bottom-0 z-10',
    // A setback step on the band's top edge: the cornice of the district tone.
    step: 'h-2 w-24 md:w-32',
    body: 'flex-row items-end gap-3 px-4 pb-3 pt-2 md:px-5 md:pb-4',
    text: 'min-w-0 flex-1',
    title: 'my-0 font-display text-base leading-tight md:text-lg',
    subtitle: 'my-0 mt-0.5 text-xs leading-snug opacity-85 md:text-sm',
    meta: 'shrink-0 font-display text-sm leading-tight md:text-base',
    plate: 'h-1.5',
  },
  variants: {
    aspect: {
      // Phones get 4:3: a 16:9 card a phone wide is too short for the band.
      wide: { photo: 'aspect-[4/3] md:aspect-video' },
      classic: { photo: 'aspect-[4/3]' },
      tall: { photo: 'aspect-[4/5]' },
    },
    frame: {
      notch: { face: 'pt-2.5' },
      cornerCut: {},
      beam: {},
    },
  },
});

export interface CardSliderImageItemProps extends CardSliderImageItemData {
  /** Frame shape, matching the Card variants. Default notch. */
  frame?: CardSliderImageFrame;
  /** Photo ratio. Default classic (4:3). */
  aspect?: CardSliderImageAspect;
  /**
   * Load now instead of lazily. Set it on the slides visible on first paint;
   * everything else loads as it nears the viewport.
   */
  priority?: boolean;
  /** Web `sizes` hint for the photo. Default matches a 1, 2 then 3 up slider. */
  sizes?: string;
  /** Heading level for the title. Default 3. */
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const DEFAULT_SIZES = '(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw';

/**
 * An image slide for CardSlider (NeonBlade's image cards). The photo fills
 * a notch, corner-cut or beam frame at a fixed ratio; a solid band in the
 * district tone carries the title, a second line and a reading; a district
 * chip sits top right. The band is a solid block, not a gradient wash, so the
 * text holds its contrast on any photo.
 *
 * The photo is the kit Image (next/image on web, expo-image on native):
 * cover fit, a blurred placeholder while it loads, lazy unless `priority`.
 */
export function CardSliderImageItem({
  image, title, subtitle, meta, district, tone: toneProp, chip,
  frame = 'notch', aspect = 'classic', priority = false, sizes = DEFAULT_SIZES, titleLevel = 3, className,
}: CardSliderImageItemProps) {
  const tone = resolveTone(toneProp, district);
  const t = TONE_CLASSES[tone];
  const hex = toneHex(tone);
  const reduced = useReducedMotion();
  const s = item({ aspect, frame });

  // Kit Image types `src` as Next's; Metro's asset number and Vite's URL go through as-is.
  const src = image.source as ImageProps['src'];
  const photo = (
    <View className={s.photo()}>
      <Image
        fill
        src={src}
        alt={image.alt}
        sizes={sizes}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        // Files are already 1200px WebP; no optimiser runs in Storybook or Metro.
        unoptimized
        placeholder={image.blurDataURL ? 'blur' : 'empty'}
        blurDataURL={image.blurDataURL}
        contentFit="cover"
        // The kit wraps the photo in a relative box; fill the aspect box.
        className="h-full w-full"
      />
      <Badge
        variant="neon"
        shape="rectangle"
        size="sm"
        district={district}
        color={tone}
        label={chip ?? DISTRICT_NAME[district]}
        className={s.chip()}
      />
      <View className={s.band()}>
        <View aria-hidden className={`${s.step()} ${t.face}`} />
        <View className={`${s.body()} ${t.face}`}>
          <View className={s.text()}>
            <Heading level={titleLevel} numberOfLines={2} className={`${s.title()} ${t.onFace}`}>{title}</Heading>
            {subtitle ? <Paragraph numberOfLines={1} className={`${s.subtitle()} ${t.onFace}`}>{subtitle}</Paragraph> : null}
          </View>
          {meta ? <Text numberOfLines={1} className={`${s.meta()} ${t.onFace}`}>{meta}</Text> : null}
        </View>
        <View aria-hidden className={`${s.plate()} ${t.plate}`} />
      </View>
    </View>
  );

  let framed: ReactNode;
  if (frame === 'notch') {
    framed = (
      <NotchFrame shape={DEFAULT_NOTCH} fill={hex.face} border={hex.keyline} depthColor={hex.plate} className={s.face()}>
        {photo}
      </NotchFrame>
    );
  } else if (frame === 'cornerCut') {
    framed = (
      <CornerCutFrame tone={toneInput(tone)} variant="outline" corner="bottom-right" cut={20} borderWidth={4} depth={6} glow="low" className={s.face()}>
        {photo}
      </CornerCutFrame>
    );
  } else {
    framed = (
      <BeamFrame
        corner="bottom-right"
        cut={20}
        borderWidth={4}
        fill={brand.night}
        track={hex.deep}
        beam={hex.highlight}
        tail={hex.face}
        beamB={toneHex(tone === 'carolina' ? 'royal' : 'carolina').highlight}
        depthColor={hex.keyline}
        variant="single"
        duration={4}
        durationB={6}
        still={reduced}
        className={s.face()}
      >
        {photo}
      </BeamFrame>
    );
  }

  return <Article className={className}>{framed}</Article>;
}
