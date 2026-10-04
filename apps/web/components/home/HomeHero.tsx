'use client';

import { brand } from '@acme/theme';
import { BrandLogo, CityBlocks, LinkButton, SceneSection, SegmentedControl, SolidPanel } from '@acme/ui';
import { Fieldset, Heading, Legend, List, ListItem, Paragraph } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { useDistrictStore } from '@acme/spatial';
import { DISTRICT_COPY, DISTRICTS } from '@acme/spatial/copy';
import { W01_COPY } from './copy';

const DISTRICT_OPTIONS = DISTRICTS.map((value) => ({ value, label: DISTRICT_COPY[value].name }));

export interface HomeHeroProps {
  /** The three Baby names, in starter slot order (from @acme/content). */
  starters: readonly string[];
}

/**
 * W01 hero: the copy on a daylit plate on the left, the NYC-MON seal on the
 * right (D12), the picked district's city behind both. Text and seal are
 * server HTML; the city canvas mounts on the client after first paint.
 */
export function HomeHero({ starters }: HomeHeroProps) {
  const district = useDistrictStore((s) => s.district);
  const setDistrict = useDistrictStore((s) => s.setDistrict);
  const copy = W01_COPY.hero;

  return (
    <SceneSection
      className="min-h-[640px] md:min-h-[78dvh]"
      placeholderColor={brand.night}
      scene={() => (
        <CityBlocks
          district={district}
          overlay
          className="absolute inset-0"
          accessibilityLabel={copy.cityLabel(DISTRICT_COPY[district].name)}
        />
      )}
    >
      <View
        data-testid="w01-hero"
        className="mx-auto w-full max-w-screen-xl flex-1 items-center justify-center gap-8 px-4 py-10 sm:px-6 md:flex-row md:gap-10 md:py-16 lg:px-8"
      >
        <View className="items-center md:order-2 md:w-5/12">
          <View className="md:hidden">
            <BrandLogo size={208} />
          </View>
          <View className="hidden md:flex lg:hidden">
            <BrandLogo size={280} />
          </View>
          <View className="hidden lg:flex">
            <BrandLogo size={360} />
          </View>
        </View>

        <View className="w-full md:order-1 md:w-7/12">
          <SolidPanel surface="page" depth="lg" className="gap-6 px-5 py-7 md:px-8 md:py-9">
            <Heading
              level={1}
              className="my-0 font-display text-[2.5rem] uppercase leading-[0.98] tracking-tight text-text sm:text-5xl lg:text-6xl"
            >
              {copy.title}
            </Heading>
            <Paragraph className="my-0 max-w-[38rem] text-base leading-7 text-text-secondary md:text-lg md:leading-8">
              {copy.body}
            </Paragraph>
            <LinkButton title={copy.cta} href={copy.ctaHref} variant="cta" size="lg" testID="w01-cta" />
            <List aria-label={copy.startersLabel} className="m-0 list-none flex-row flex-wrap gap-x-5 gap-y-1 p-0">
              {starters.map((name) => (
                <ListItem key={name} className="text-sm font-semibold text-text-muted md:text-base">
                  {name}
                </ListItem>
              ))}
            </List>
            <Fieldset data-testid="w01-district" className="m-0 gap-2 border-0 p-0">
              <Legend className="mb-2 p-0 text-sm font-semibold text-text">{copy.districtLabel}</Legend>
              <SegmentedControl options={DISTRICT_OPTIONS} value={district} onChange={setDistrict} district={district} />
            </Fieldset>
          </SolidPanel>
        </View>
      </View>
    </SceneSection>
  );
}
