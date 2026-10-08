import { DISTRICTS, DISTRICT_COPY } from '@acme/spatial';
import { SolidPanel } from '@acme/ui';
import { Article, Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { StreetGridBand } from './StreetGridBand';
import { W03_COPY } from './copy';

/** District accent bars, one brand colour per card. */
const CARD_ACCENTS = ['bg-orange-500', 'bg-royal-500', 'bg-carolina-500', 'bg-leaf-500'] as const;

/** W03, the product site's setting page: the four districts, then who shares them. */
export function CityPage() {
  const districts = W03_COPY.districts;
  const cast = W03_COPY.cast;
  return (
    <View className="w-full flex-1 bg-bg">
      <Section
        aria-labelledby="w03-districts-title"
        data-testid="w03-districts"
        className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8"
      >
        <View className="max-w-2xl gap-4">
          <Eyebrow>{districts.eyebrow}</Eyebrow>
          <Heading level={1} id="w03-districts-title" className="my-0 font-display text-3xl leading-tight text-text md:text-4xl">
            {districts.title}
          </Heading>
          <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">{districts.body}</Paragraph>
        </View>
        <List aria-label={districts.listLabel} className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2">
          {DISTRICTS.map((district, i) => (
            <ListItem key={district}>
              <SolidPanel surface="page" depth="md" className="h-full gap-3 overflow-hidden px-5 py-6">
                <View className={`-mx-5 -mt-6 mb-2 h-1.5 ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`} aria-hidden />
                <Article className="gap-3">
                  <Heading level={2} className="my-0 font-display text-2xl leading-tight text-text">
                    {DISTRICT_COPY[district].name}
                  </Heading>
                  <Paragraph className="my-0 text-base leading-7 text-text-secondary">{DISTRICT_COPY[district].line}</Paragraph>
                </Article>
              </SolidPanel>
            </ListItem>
          ))}
        </List>
      </Section>

      <StreetGridBand />

      <Section
        aria-labelledby="w03-cast-title"
        data-testid="w03-cast"
        className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8"
      >
        <View className="max-w-2xl gap-4">
          <Eyebrow>{cast.eyebrow}</Eyebrow>
          <Heading level={2} id="w03-cast-title" className="my-0 font-display text-3xl leading-tight text-text md:text-4xl">
            {cast.title}
          </Heading>
          <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">{cast.body}</Paragraph>
        </View>
        <List className="m-0 list-none gap-6 p-0 md:flex-row">
          {cast.items.map((item) => (
            <ListItem key={item.title} className="flex-1">
              <SolidPanel surface="page" depth="md" className="h-full gap-3 px-5 py-6">
                <Heading level={3} className="my-0 font-display text-2xl leading-tight text-text">
                  {item.title}
                </Heading>
                <Paragraph className="my-0 text-base leading-7 text-text-secondary">{item.line}</Paragraph>
              </SolidPanel>
            </ListItem>
          ))}
        </List>
      </Section>
    </View>
  );
}
