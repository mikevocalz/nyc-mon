import { DISTRICT_TONE, TONE_CLASSES } from '@acme/ui';
import { Figcaption, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import type { ArtEntry } from './art';
import { W01_COPY } from './copy';

/** Authored location captions retain their treatment; CMS replacements use their own caption, never a stale district. */
export function PlaceCaption({ entry, className, landmark = false }: { entry: ArtEntry; className: string; landmark?: boolean }) {
  if (!entry.caption) return null;
  return <Figcaption className={`absolute m-0 flex max-w-full flex-row items-center gap-2.5 bg-signage-black px-3 py-2 ${className}`}>
    {landmark || !entry.district ? null : <View aria-hidden className={`h-3.5 w-3.5 shrink-0 rounded-full ${TONE_CLASSES[DISTRICT_TONE[entry.district]].face}`} />}
    <Text className="text-sm font-semibold text-signage-white">{landmark || !entry.district ? W01_COPY.landmarkCaption(entry.caption.title, entry.caption.place) : W01_COPY.placeCaption(entry.district, entry.caption.place)}</Text>
  </Figcaption>;
}
