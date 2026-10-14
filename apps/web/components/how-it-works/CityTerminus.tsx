import { breakpoints } from '@acme/theme';
import { DISTRICT_TONE, LinkButton, TONE_CLASSES, type District } from '@acme/ui';
import { Heading, List, ListItem, Paragraph, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { ArtTile } from './ArtTile';
import { photoArt } from './art';
import { W04_COPY } from './copy';

/** North to south, then Mega City: the order a rider reads them on a line map (as home's SignageBoard). */
const ROUTE: readonly District[] = ['harlem', 'midtown', 'downtown', 'megacity'];

/**
 * The end of the line: after Care, the loop goes out into the city. A bento
 * from `lg`: the Brooklyn Bridge at night as the big tile over two rows, the
 * world's line beside it, and under that the four districts as a signage
 * board with the link to walk one. All of it is the home page's copy.
 */
export function CityTerminus() {
  const copy = W04_COPY.city;
  return (
    <Section aria-labelledby="w04-city-title" data-testid="w04-city" id="trg-hiw-city" className="relative gap-8 pl-16 md:pl-36">
      {/* The terminus: a ring where the route line ends. */}
      <View aria-hidden id="trg-hiw-terminus" className="absolute left-0 top-0 h-12 w-12 items-center justify-center md:h-24 md:w-24">
        <View id="mpx-hiw-terminus" className="h-10 w-10 rounded-full border-8 border-signage-black bg-orange-500 md:h-16 md:w-16 md:border-[12px]" />
      </View>
      <View className="gap-4 md:grid md:grid-cols-2 md:gap-5 lg:grid-cols-12">
        <ArtTile
          id="mfx-hiw-city-0"
          art={photoArt('megacity-brooklyn-bridge-night', `(min-width: ${breakpoints.lg}) 40rem, (min-width: ${breakpoints.md}) 50vw, 100vw`, { left: '50%', top: '55%' })}
          frame="aspect-[4/3] border-2 border-ink-950 md:row-span-2 md:aspect-auto md:min-h-[26rem] lg:col-span-7 lg:row-span-2"
        />
        <View id="mfx-hiw-city-1" className="justify-end gap-4 lg:col-span-5 lg:col-start-8 lg:row-start-1">
          <Heading
            level={2}
            id="w04-city-title"
            className="my-0 font-display text-display-md uppercase leading-heading text-text lg:text-display-lg lg:leading-heading"
          >
            {copy.title}
          </Heading>
          <Paragraph className="my-0 max-w-content-measure text-base leading-7 text-text-secondary md:text-lg md:leading-8">
            {copy.body}
          </Paragraph>
        </View>
        <View id="mfx-hiw-city-2" className="gap-5 bg-signage-black px-5 py-6 md:px-6 lg:col-span-5 lg:col-start-8 lg:row-start-2">
          <Paragraph className="my-0 text-base font-semibold leading-6 text-silver-200">{copy.body2}</Paragraph>
          <List aria-label={copy.boardLabel} className="m-0 list-none gap-0 p-0">
            {ROUTE.map((district, i) => {
              const d = copy.districts[district];
              return (
                <ListItem key={district} className="relative flex-row items-start gap-4 pb-4">
                  {i < ROUTE.length - 1 ? <View aria-hidden className="absolute bottom-0 left-2 top-2 w-1 bg-silver-500" /> : null}
                  <View aria-hidden className={`relative mt-1 h-5 w-5 shrink-0 rounded-full border-2 border-signage-black ${TONE_CLASSES[DISTRICT_TONE[district]].face}`} />
                  <View className="min-w-0 gap-0.5">
                    <Text className="font-display text-xl uppercase leading-heading text-signage-white">{d.name}</Text>
                    {d.streets ? <Text className="text-sm text-silver-200">{d.streets}</Text> : null}
                  </View>
                </ListItem>
              );
            })}
          </List>
          <LinkButton title={copy.cta} href={copy.ctaHref} district="downtown" testID="w04-city-cta" />
        </View>
      </View>
    </Section>
  );
}
