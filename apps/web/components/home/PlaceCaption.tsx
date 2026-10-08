import { DISTRICT_TONE, TONE_CLASSES } from '@acme/ui';
import { Figcaption, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import type { ArtEntry } from './art';
import { W01_COPY } from './copy';

/**
 * A photograph's caption as a signage plate pinned to a corner of its frame:
 * the district's disc, then "District, cross streets", or the district alone
 * where canon gives no place. Renders nothing for art without a district or
 * caption, which is how creature art (PS-028) stays uncaptioned: a Mon is not
 * a place.
 *
 * `landmark` drops the disc and the district name and prints "Landmark, cross
 * streets" instead. The hero uses it because it sits beside the district
 * picker, where a district name reads as the picked district (PS-026).
 */
export function PlaceCaption({ entry, className, landmark = false }: { entry: ArtEntry; className: string; landmark?: boolean }) {
  if (!entry.district || !entry.caption) return null;
  return (
    <Figcaption className={`absolute m-0 flex max-w-full flex-row items-center gap-2.5 bg-signage-black px-3 py-2 ${className}`}>
      {landmark ? null : (
        <View aria-hidden className={`h-3.5 w-3.5 shrink-0 rounded-full ${TONE_CLASSES[DISTRICT_TONE[entry.district]].face}`} />
      )}
      <Text className="text-sm font-semibold text-signage-white">
        {landmark
          ? W01_COPY.landmarkCaption(entry.caption.title, entry.caption.place)
          : W01_COPY.placeCaption(entry.district, entry.caption.place)}
      </Text>
    </Figcaption>
  );
}
