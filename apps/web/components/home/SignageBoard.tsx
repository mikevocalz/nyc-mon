import { DISTRICT_TONE, TONE_CLASSES, type District } from '@acme/ui';
import { Heading, List, ListItem, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { DISTRICT_COPY } from '@acme/spatial/copy';
import { W01_COPY } from './copy';
import { sectionMarker } from './sections';
import { sectionText, type CmsSectionProps } from './cms';

const ROUTE: readonly District[] = ['harlem', 'midtown', 'downtown', 'megacity'];
export function SignageBoard({ cms }: CmsSectionProps = {}) {
  return <Section {...sectionMarker('signage')} aria-labelledby="w01-signage-title" data-testid="w01-signage" className="w-full bg-signage-black">
    <View className="mx-auto w-full max-w-screen-xl gap-6 px-4 py-10 sm:px-6 md:py-12 lg:px-8">
      <Heading level={2} id="w01-signage-title" className="my-0 font-sans text-base font-semibold text-silver-200">{sectionText(cms, 'title', W01_COPY.signage.title)}</Heading>
      <List role="list" className="m-0 list-none p-0 lg:grid lg:grid-cols-4">
        {ROUTE.map((district, i) => {
          const copy = DISTRICT_COPY[district];
          const streets = sectionText(cms, `districts.${district}.streets`, copy.streets ?? '');
          return <ListItem key={district} className="relative flex-row items-start gap-4 pb-7 lg:flex-col lg:gap-4 lg:pb-0 lg:pr-6">
            {i === ROUTE.length - 1 ? null : <View aria-hidden className="absolute bottom-0 left-2.5 top-3 w-1 bg-silver-500 lg:bottom-auto lg:left-3 lg:right-0 lg:top-2.5 lg:h-1 lg:w-auto" />}
            <View aria-hidden className={`relative h-6 w-6 shrink-0 rounded-full border-2 border-signage-black ${TONE_CLASSES[DISTRICT_TONE[district]].face}`} />
            <View className="min-w-0 gap-1">
              <Text className="font-display text-display-board uppercase text-signage-white">{sectionText(cms, `districts.${district}.name`, copy.name)}</Text>
              {streets ? <Text className="text-sm text-silver-200">{streets}</Text> : null}
            </View>
          </ListItem>;
        })}
      </List>
    </View>
  </Section>;
}
