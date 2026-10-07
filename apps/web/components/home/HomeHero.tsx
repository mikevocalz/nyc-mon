'use client';

import dynamic from 'next/dynamic';
import { brand } from '@acme/theme';
import { BrandLogo, Image, LinkButton, SceneSection, SegmentedControl, SolidPanel, type ImageProps } from '@acme/ui';
import { Fieldset, Figcaption, Figure, Heading, Legend, List, ListItem, Paragraph, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { useDistrictStore } from '@acme/spatial';
import { DISTRICT_COPY, DISTRICTS } from '@acme/spatial/copy';
import { TEMP_HERO_ART } from './art';
import { Eyebrow } from './Eyebrow';
import { W01_COPY } from './copy';

const DISTRICT_OPTIONS = DISTRICTS.map((value) => ({ value, label: DISTRICT_COPY[value].name }));

// The live city is a WebGPU scene: keep its code out of the entry chunk (it
// only mounts when SceneSection nears the viewport anyway) and never block LCP.
// Import the module directly — the @acme/ui barrel is server-resolved and a
// dynamic namespace import would pull the whole surface into one chunk.
const CityBlocks = dynamic(
  () => import('@acme/ui/backgrounds/CityBlocks').then((m) => m.CityBlocks),
  { ssr: false },
);

export interface HomeHeroProps {
  /** The three Baby names, in starter slot order (from @acme/content). */
  starters: readonly string[];
}

/**
 * W01 hero as key art: the picked district's live city behind everything,
 * a daylit editorial plate on the left, and on the right a framed city
 * photograph with the NYC-MON seal stamped over its corner. The `mfx-*`
 * markers are the entrance beats and `mpx-*` the scroll drift — both are
 * authored in ./motion.ts through Kinetrell; without motion they render as
 * a static composition.
 */
export function HomeHero({ starters }: HomeHeroProps) {
  const district = useDistrictStore((s) => s.district);
  const setDistrict = useDistrictStore((s) => s.setDistrict);
  const copy = W01_COPY.hero;
  // The hero frame is the LCP image — preload it explicitly (SolitoImage
  // drops next/image's `priority`, so the link does the work instead).
  const heroSrc =
    typeof TEMP_HERO_ART.source === 'object' && TEMP_HERO_ART.source !== null && 'src' in TEMP_HERO_ART.source
      ? (TEMP_HERO_ART.source as { src: string }).src
      : String(TEMP_HERO_ART.source);

  return (
    <SceneSection
      className="min-h-[640px] md:min-h-[92dvh]"
      id="trg-hero"
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
      <link rel="preload" as="image" href={heroSrc} fetchPriority="high" />
      <View
        data-testid="w01-hero"
        className="mx-auto w-full max-w-screen-xl flex-1 items-center justify-center gap-10 px-4 py-12 sm:px-6 md:flex-row md:gap-8 md:py-20 lg:gap-14 lg:px-8"
      >
        <View id="mpx-hero-cluster" className="w-full min-w-0 md:order-2 md:flex-[5_1_0%]">
          <Figure id="mfx-hero-art" className="m-0 gap-2">
            <View className="relative w-full md:ml-auto md:max-w-[420px]">
              <Image
                src={TEMP_HERO_ART.source as ImageProps['src']}
                alt={TEMP_HERO_ART.alt}
                fill
                priority
                loading="eager"
                {...({ fetchPriority: 'high' } as object)}
                sizes="(min-width: 768px) 34vw, 92vw"
                unoptimized
                placeholder="blur"
                blurDataURL={TEMP_HERO_ART.blurDataURL}
                district="midtown"
                className="aspect-[16/10] w-full md:aspect-[4/5]"
              />
              <View id="mfx-hero-seal" className="absolute -bottom-5 left-3 md:-left-8">
                <View className="md:hidden">
                  <BrandLogo size={112} />
                </View>
                <View className="hidden md:flex lg:hidden">
                  <BrandLogo size={168} />
                </View>
                <View className="hidden lg:flex">
                  <BrandLogo size={208} />
                </View>
              </View>
            </View>
            <Figcaption className="m-0 mt-6 text-right">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-200">
                {TEMP_HERO_ART.title}
              </Text>
              <Text className="text-[11px] uppercase tracking-[0.18em] text-ink-400">
                {` — ${TEMP_HERO_ART.place}`}
              </Text>
            </Figcaption>
          </Figure>
        </View>

        <View id="mpx-hero-panel" className="w-full min-w-0 md:order-1 md:flex-[7_1_0%]">
          <SolidPanel surface="page" depth="lg" className="gap-6 px-5 py-8 md:px-10 md:py-12">
            <View id="mfx-hero-eyebrow">
              <Eyebrow>{copy.eyebrow}</Eyebrow>
            </View>
            <Heading
              level={1}
              id="mfx-hero-title"
              className="my-0 font-display text-[2.75rem] uppercase leading-[0.95] tracking-tight text-text sm:text-6xl lg:text-7xl"
            >
              {copy.title}
            </Heading>
            <Paragraph id="mfx-hero-body" className="my-0 max-w-[38rem] text-base leading-7 text-text-secondary md:text-lg md:leading-8">
              {copy.body}
            </Paragraph>
            <View id="mfx-hero-cta">
              <LinkButton
                title={copy.cta}
                href={copy.ctaHref}
                variant="cta"
                size="lg"
                testID="w01-cta"
              />
            </View>
            <List
              aria-label={copy.startersLabel}
              id="mfx-hero-starters"
              className="m-0 list-none flex-row flex-wrap gap-x-5 gap-y-1 p-0"
            >
              {starters.map((name) => (
                <ListItem key={name} className="text-sm font-semibold text-text-muted md:text-base">
                  {name}
                </ListItem>
              ))}
            </List>
            <View id="mfx-hero-districts">
              <Fieldset data-testid="w01-district" className="m-0 gap-2 border-0 p-0">
                <Legend className="mb-2 p-0 text-sm font-semibold text-text">{copy.districtLabel}</Legend>
                <SegmentedControl options={DISTRICT_OPTIONS} value={district} onChange={setDistrict} district={district} />
              </Fieldset>
            </View>
          </SolidPanel>
        </View>
      </View>
    </SceneSection>
  );
}
