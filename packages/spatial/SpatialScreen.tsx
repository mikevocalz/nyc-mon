'use client';

import { BrandLogo, CircuitButton, CityBlocks, GridCard, Heading, SegmentedControl, SolidPanel, Text } from '@acme/ui';
import { List, ListItem } from '@acme/ui/html';
import { Platform, useWindowDimensions } from 'react-native';
import { Pressable, ScrollView, Section, View } from '@acme/ui/tw';
import { ForkSpatialLayout, getSpatialForkCapabilities } from './ForkSpatialLayout';
import { SpatialViroExperience } from './SpatialViroExperience';
import { useDistrictStore, type District } from './districtStore';
import { DISTRICT_COPY, DISTRICTS, HOME_COPY } from './homeCopy';

const DISTRICT_OPTIONS = DISTRICTS.map((value) => ({ value, label: DISTRICT_COPY[value].name }));

function DistrictList({ active, onPick }: { active: District; onPick: (d: District) => void }) {
  return (
    <List className="m-0 list-none gap-3 p-0 md:flex-row">
      {DISTRICTS.map((district) => {
        const copy = DISTRICT_COPY[district];
        const selected = district === active;
        return (
          <ListItem key={district} className="flex-1">
            <Pressable
              role="button"
              aria-pressed={selected}
              aria-label={`Show ${copy.name}`}
              onPress={() => onPick(district)}
              className={`h-full gap-1 border-2 px-4 py-3 transition-colors duration-fast motion-reduce:transition-none ${
                selected ? 'border-orange-950 bg-orange-500' : 'border-ink-950 bg-ink-800 hover:bg-ink-700'
              }`}
            >
              <Text className={`font-display text-lg ${selected ? 'text-ink-950' : 'text-ink-50'}`}>{copy.name}</Text>
              <Text className={`text-sm leading-6 ${selected ? 'text-ink-900' : 'text-silver-300'}`}>{copy.line}</Text>
            </Pressable>
          </ListItem>
        );
      })}
    </List>
  );
}

export interface SpatialScreenProps {
  /**
   * Hands the district to a headset's immersive activity. Resolves true when
   * it did (PICO, through expo-pico), false to fall back to the inline view.
   * Only the Expo app passes this; web and phones use the inline view.
   */
  enterImmersive?: () => Promise<boolean>;
}

export function SpatialScreen({ enterImmersive }: SpatialScreenProps = {}) {
  const capabilities = getSpatialForkCapabilities();
  const { height: windowHeight } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const district = useDistrictStore((state) => state.district);
  const setDistrict = useDistrictStore((state) => state.setDistrict);
  const cityOpen = useDistrictStore((state) => state.cityOpen);
  const setCityOpen = useDistrictStore((state) => state.setCityOpen);

  // Runtime diagnostic for headset builds. Web visitors never see it: it named
  // the backend ("Inline / Viro spatial fallback"), which is debug, not copy (PS-031).
  const tools = isWeb ? undefined : (
    <GridCard eyebrow="Runtime" title="Spatial backend">
      <Text className="text-sm text-white/75">
        {capabilities.metaSpatialWindows ? 'Meta Layout spatial window' : 'Inline / Viro spatial fallback'}
      </Text>
    </GridCard>
  );

  return (
    <ForkSpatialLayout panel={tools}>
      {/* The district is the background: switching it redraws the city below
          the hero. On web the document scrolls, so the city is pinned to the
          viewport there and the inner ScrollView scrolls instead. */}
      <CityBlocks
        className={isWeb ? 'h-dvh max-h-dvh' : 'flex-1'}
        district={district}
        overlay
        accessibilityLabel={`${DISTRICT_COPY[district].name} street grid`}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-screen-2xl gap-6 px-4 py-8 sm:px-6 lg:px-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section
            className={`items-center justify-center gap-6 md:flex-row md:gap-10 ${isWeb ? 'min-h-[78dvh]' : ''}`}
            // Native has no dvh; web uses the class so SSR and hydration agree.
            style={isWeb ? undefined : { minHeight: windowHeight * 0.78 }}
          >
            <View className="md:order-2">
              <View className="md:hidden">
                <BrandLogo size={208} />
              </View>
              <View className="hidden md:flex lg:hidden">
                <BrandLogo size={280} />
              </View>
              <View className="hidden lg:flex">
                <BrandLogo size={340} />
              </View>
            </View>
            {/* The copy sits on a solid ink slab: over the live city it was
                unreadable, and the brand is solid blocks, not translucent glass. */}
            <View className="max-w-3xl flex-1 md:order-1">
              <SolidPanel tone="ink" depth="lg" className="gap-4 px-5 py-6 md:px-8 md:py-8">
                {/* Palette step, not `primary`: the ink slab is night in both
                    themes, and `primary` drops to orange-700 in light (2.55:1 here). */}
                <Heading level={1} size="display-sm" className="my-0 text-center text-orange-500 md:text-left">
                  {HOME_COPY.tagline}
                </Heading>
                <Text className="max-w-2xl text-center text-ink-50 md:text-left">{HOME_COPY.intro}</Text>
                <View className="items-center md:items-start">
                  <SegmentedControl aria-label="District" options={DISTRICT_OPTIONS} value={district} onChange={setDistrict} />
                </View>
                <View className="mt-2 flex-row flex-wrap justify-center gap-3 md:justify-start">
                  <CircuitButton tone="orange" variant="solid" onPress={async () => {
                      if (!cityOpen && enterImmersive && (await enterImmersive())) return;
                      setCityOpen(!cityOpen);
                    }}>
                    {cityOpen ? HOME_COPY.closeCity : HOME_COPY.openCity}
                  </CircuitButton>
                </View>
              </SolidPanel>
            </View>
          </Section>

          <DistrictList active={district} onPick={setDistrict} />

          {cityOpen ? (
            <View className="min-h-[460px] overflow-hidden border-2 border-ink-950 bg-ink-950">
              <SpatialViroExperience />
            </View>
          ) : (
            <GridCard title={HOME_COPY.headsetTitle} tone="orange">
              <Text className="text-sm leading-6 text-white/75">{HOME_COPY.headsetBody}</Text>
            </GridCard>
          )}
        </ScrollView>
      </CityBlocks>
    </ForkSpatialLayout>
  );
}
