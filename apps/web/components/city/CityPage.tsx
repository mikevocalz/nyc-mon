import { DISTRICTS, DISTRICT_COPY } from '@acme/spatial';
import { Image, SolidPanel } from '@acme/ui';
import { Article, Figure, Figcaption, Heading, List, ListItem, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { Eyebrow } from '../home/Eyebrow';
import { StreetGridBand } from './StreetGridBand';
import { W03_COPY } from './copy';
import { cityPhoto, cityPhotoHref } from './art';
import { CityMotion } from './CityMotion';
import { cityCardLayout } from './layout';

/** District accent bars, one brand colour per card. */
const CARD_ACCENTS = ['bg-orange-500', 'bg-royal-500', 'bg-carolina-500', 'bg-leaf-500'] as const;

/** W03, the product site's setting page: the four districts, then who shares them. */
export function CityPage() {
  const districts = W03_COPY.districts;
  const cast = W03_COPY.cast;
  return (
    <View id="w03-city" className="w-full flex-1 bg-bg">
      <CityMotion />
      <Section
        aria-labelledby="w03-districts-title"
        data-testid="w03-districts"
        data-section="city-districts"
        className="mx-auto w-full max-w-screen-xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8"
      >
        <View className="max-w-2xl gap-4">
          <Eyebrow>{districts.eyebrow}</Eyebrow>
          <Heading level={1} id="w03-districts-title" className="my-0 font-display text-3xl leading-tight text-text md:text-4xl">
            {districts.title}
          </Heading>
          <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">{districts.body}</Paragraph>
        </View>
        <View id="w03-atlas-start" className="h-px w-full" aria-hidden />
        <List id="w03-district-atlas" aria-label={districts.listLabel} className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-12">
          {DISTRICTS.map((district, i) => {
            const photo = cityPhoto(district);
            const leading = district === 'downtown';
            return (
              <ListItem key={district} className={cityCardLayout(district)}>
                <SolidPanel surface="page" depth="md" className="h-full overflow-hidden">
                  <Article aria-labelledby={`w03-${district}-title`} className="h-full">
                    {photo ? (
                      <Figure className={`m-0 ${leading ? 'flex-1' : ''}`}>
                        <View className={`relative overflow-hidden bg-surface-sunken ${leading ? 'aspect-[4/5] md:aspect-auto md:min-h-96 md:flex-1' : 'aspect-[3/2]'}`}>
                          <View id={`w03-photo-${district}`} data-testid={`w03-photo-${district}`} className="absolute inset-0">
                            <Image
                              src={cityPhotoHref(photo.source)} alt={photo.alt} fill framed={false}
                              className="h-full w-full" sizes={photo.sizes}
                              contentPosition={photo.position} loading={leading ? 'eager' : 'lazy'}
                              placeholder="blur" blurDataURL={photo.blurDataURL}
                            />
                          </View>
                        </View>
                        <Figcaption className="bg-signage-black px-5 py-2 text-sm text-signage-white">{photo.title}</Figcaption>
                      </Figure>
                    ) : null}
                    <View className="gap-3 px-5 py-6">
                      <View className={`h-1.5 w-12 ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`} aria-hidden />
                      <Heading level={2} id={`w03-${district}-title`} className="my-0 font-display text-2xl leading-tight text-text">
                        {DISTRICT_COPY[district].name}
                      </Heading>
                      <Paragraph className="my-0 text-base leading-7 text-text-secondary">{DISTRICT_COPY[district].line}</Paragraph>
                    </View>
                  </Article>
                </SolidPanel>
              </ListItem>
            );
          })}
        </List>
      </Section>

      <StreetGridBand />

      <Section
        aria-labelledby="w03-cast-title"
        data-testid="w03-cast"
        data-section="city-cast"
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
