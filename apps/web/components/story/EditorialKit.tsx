import { Image, type ImageProps } from '@acme/ui';
import { Figure, Heading, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { pageMotion } from '@acme/theme';
import { artPosition, type ArtEntry } from '../home/art';
import { PlaceCaption } from '../home/PlaceCaption';
import { splitTitle } from './editorial';

/**
 * The editorial kit shared by /story and /city, in the home page's visual
 * language: signage-plate headlines with an offset second line, giant
 * chapter numerals, and photographs in hard frames with a place caption.
 * Server components; motion binds to the ids they are given (route-motion.ts).
 */

const SIZE = {
  hero: 'text-display-hero leading-display md:text-display-2xl md:leading-display lg:text-[6.5rem] lg:leading-display',
  section: 'text-display-md leading-display md:text-display-lg md:leading-display xl:text-display-xl xl:leading-display',
  pin: 'text-display-lg leading-display md:text-display-2xl md:leading-display xl:text-[5.5rem] xl:leading-display',
  giant: 'text-display-lg leading-display md:text-display-2xl md:leading-display lg:text-[8rem] lg:leading-display',
} as const;

export type HeadlineTone =
  /** White type on signage-black plates: on the daylit page and over photographs. */
  | 'plate'
  /** No plate: white, then an orange second line, on the night bands. */
  | 'night'
  /** No plate: signage black on the daylit page, the second line in the royal page tone. */
  | 'day';

/**
 * A headline set as two signage lines, the second stepped in like the home
 * hero. The words are the copy: the lines join with a space, so the heading's
 * document text is the title exactly.
 */
export function SignageHeadline({
  title, level, id, tone, size = 'section', className = '', lineIds,
}: {
  title: string;
  level: 1 | 2 | 3;
  id: string;
  tone: HeadlineTone;
  size?: keyof typeof SIZE;
  className?: string;
  /** Motion ids for each line, when a timeline moves the lines apart. */
  lineIds?: readonly [string, string];
}) {
  const lines = splitTitle(title);
  const plate = tone === 'plate';
  return (
    <Heading
      level={level}
      id={id}
      className={`my-0 flex flex-col items-start gap-2 font-display uppercase md:gap-3 ${SIZE[size]} ${className}`}
    >
      {lines.map((line, i) => {
        const last = i === lines.length - 1;
        const color =
          tone === 'night' ? (i > 0 ? 'text-orange-500' : 'text-ink-50')
          : tone === 'day' ? (i > 0 ? 'text-tone-royal-text' : 'text-text')
          : 'text-signage-white';
        return (
          <Text
            key={line}
            {...(lineIds ? { id: lineIds[i] } : {})}
            className={`block w-fit max-w-full font-display ${color} ${plate ? 'bg-signage-black px-3 pb-1.5 pt-2.5 md:px-5 md:pb-2 md:pt-3.5' : ''} ${i > 0 ? 'ml-6 md:ml-16 xl:ml-24' : ''}`}
          >
            {last ? line : `${line} `}
          </Text>
        );
      })}
    </Heading>
  );
}

/** A giant chapter numeral. Decorative: the eyebrow and heading carry the meaning. */
const NUMERAL = {
  lg: 'text-[6rem] md:text-[9rem] xl:text-[11rem]',
  md: 'text-[5rem] md:text-[7rem]',
} as const;

export function ChapterNumeral({
  value, night = false, id, className = '', size = 'lg',
}: { value: string; night?: boolean; id?: string; className?: string; size?: keyof typeof NUMERAL }) {
  return (
    <Text
      aria-hidden
      {...(id ? { id } : {})}
      className={`block font-display leading-none ${NUMERAL[size]} ${night ? 'text-orange-500' : 'text-ink-950'} ${className}`}
    >
      {value}
    </Text>
  );
}

/** The drifting layer overhangs its frame by the largest parallax step, so a drift never shows an edge. */
const OVERHANG = `-${pageMotion.parallax.max}%`;

/**
 * A photograph in a hard frame with its place caption plate. With `driftId`
 * the image sits on an overhanging layer that route-motion drifts on desktop.
 */
export function PhotoFrame({
  entry, className, driftId, captionAt = 'bottom-0 left-0', eager = false,
}: {
  entry: ArtEntry;
  className: string;
  driftId?: string;
  captionAt?: string;
  eager?: boolean;
}) {
  const image = (
    <Image
      src={entry.src as ImageProps['src']}
      alt={entry.alt}
      fill
      framed={false}
      sizes={entry.sizes}
      loading={eager ? 'eager' : 'lazy'}
      priority={eager}
      placeholder="blur"
      blurDataURL={entry.blurDataURL}
      contentPosition={artPosition(entry)}
      className="h-full w-full"
    />
  );
  return (
    <Figure className={`relative m-0 w-full overflow-hidden bg-ink-900 ${className}`}>
      {driftId ? (
        <View id={driftId} className="absolute inset-x-0" style={{ top: OVERHANG, bottom: OVERHANG }}>
          {image}
        </View>
      ) : (
        <View className="absolute inset-0">{image}</View>
      )}
      <PlaceCaption entry={entry} className={captionAt} />
    </Figure>
  );
}
