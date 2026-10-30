import { Image, TONE_CLASSES, type ControlTone, type ImageProps } from '@acme/ui';
import { Figcaption, Figure, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { artPosition, type ArtEntry } from '../home/art';
import { PlaceCaption } from '../home/PlaceCaption';
import { W02_COPY } from './copy';

/** "002": the Dex number as the roster prints it at display size. */
export const dexDigits = (dexId: number) => String(dexId).padStart(3, '0');

/**
 * A picture filling its box. The box (aspect, size, border) comes from the
 * caller. `drift` wraps the image in a layer that overhangs the box by the
 * largest parallax step, so a scrubbed drift (motion.ts) never shows an edge.
 */
export function ArtFill({
  entry,
  drift,
  eager = false,
}: {
  entry: ArtEntry;
  drift?: string;
  eager?: boolean;
}) {
  const image = (
    <Image
        unoptimized
      src={entry.src as ImageProps['src']}
      alt={entry.alt}
      fill
      framed={false}
      sizes={entry.sizes}
      priority={eager}
      loading={eager ? 'eager' : 'lazy'}
      placeholder={entry.blurDataURL ? 'blur' : undefined}
      blurDataURL={entry.blurDataURL}
      contentPosition={artPosition(entry)}
      className="h-full w-full"
    />
  );
  if (!drift) return image;
  return (
    <View id={drift} className="absolute inset-x-0 -bottom-[9%] -top-[9%]">
      {image}
    </View>
  );
}

/** "Concept art" as a signage plate pinned to a corner of a creature picture. */
export function ConceptCaption({ label = W02_COPY.conceptArt, className = 'bottom-0 left-0' }: { label?: string; className?: string }) {
  return (
    <Figcaption className={`absolute m-0 bg-signage-black px-3 py-1.5 ${className}`}>
      <Text className="text-xs font-semibold uppercase tracking-widest text-signage-white">{label}</Text>
    </Figcaption>
  );
}

/** A street photograph's figure with its district plate, as on the home page's world bento. */
export function StreetFigure({ entry, className, drift }: { entry: ArtEntry; className: string; drift?: string }) {
  return (
    <Figure className={`relative m-0 overflow-hidden bg-ink-900 ${className}`}>
      <ArtFill entry={entry} drift={drift} />
      <PlaceCaption entry={entry} className="bottom-0 left-0" />
    </Figure>
  );
}

/** The Dex chip: "No. 002" on the slot tone's face. */
export function DexChip({ dexId, tone, large = false }: { dexId: number; tone: ControlTone; large?: boolean }) {
  const t = TONE_CLASSES[tone];
  return (
    <Text
      className={`self-start font-display ${t.face} ${t.onFace} ${large ? 'px-4 pb-1.5 pt-2 text-2xl md:text-3xl' : 'px-2.5 py-1 text-sm'}`}
    >
      {W02_COPY.index.dex(dexId)}
    </Text>
  );
}

/** A route bullet: the tone's disc on a night keyline, as on the home district board. */
export function RouteDisc({ tone, className = 'h-6 w-6' }: { tone: ControlTone; className?: string }) {
  return <View aria-hidden className={`shrink-0 rounded-full border-2 border-signage-black ${TONE_CLASSES[tone].face} ${className}`} />;
}
