import { DISTRICT_TONE, TONE_CLASSES, type District } from '@acme/ui';
import { Heading, List, ListItem, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { DISTRICT_COPY } from '@acme/spatial/copy';
import { W01_COPY } from './copy';
import { sectionMarker } from './sections';

/**
 * Stops in route order, north to south, then Mega City: the order a rider
 * would read them on a line map. Not the store's order.
 */
const ROUTE: readonly District[] = ['harlem', 'midtown', 'downtown', 'megacity'];

/**
 * SIGNAGE (PS-014): a static district board in transit-signage logic. Each
 * stop is a district name at display size with one real cross street under
 * it, and a disc in the district's colour sitting on a single route line.
 * The district colour appears only in the disc. Vertical on phones, one row
 * from `lg`. Server-rendered; nothing on it moves.
 */
export function SignageBoard() {
  return (
    <Section
      {...sectionMarker('signage')}
      aria-labelledby="w01-signage-title"
      data-testid="w01-signage"
      className="w-full bg-signage-black"
    >
      <View className="mx-auto w-full max-w-screen-xl gap-6 px-4 py-10 sm:px-6 md:py-12 lg:px-8">
        <Heading level={2} id="w01-signage-title" className="my-0 font-sans text-base font-semibold text-silver-200">
          {W01_COPY.signage.title}
        </Heading>
        <List className="m-0 list-none p-0 lg:grid lg:grid-cols-4">
          {ROUTE.map((district, i) => {
            const copy = DISTRICT_COPY[district];
            const last = i === ROUTE.length - 1;
            return (
              <ListItem key={district} className="relative flex-row items-start gap-4 pb-7 lg:flex-col lg:gap-4 lg:pb-0 lg:pr-6">
                {/* The route line: down the left on phones, across the top from lg. It stops at the last disc. */}
                {last ? null : (
                  <View
                    aria-hidden
                    className="absolute bottom-0 left-2.5 top-3 w-1 bg-silver-500 lg:bottom-auto lg:left-3 lg:right-0 lg:top-2.5 lg:h-1 lg:w-auto"
                  />
                )}
                <View
                  aria-hidden
                  className={`relative h-6 w-6 shrink-0 rounded-full border-2 border-signage-black ${TONE_CLASSES[DISTRICT_TONE[district]].face}`}
                />
                <View className="min-w-0 gap-1">
                  <Text className="font-display text-display-board uppercase text-signage-white">{copy.name}</Text>
                  <Text className="text-sm text-silver-200">{copy.streets}</Text>
                </View>
              </ListItem>
            );
          })}
        </List>
      </View>
    </Section>
  );
}
