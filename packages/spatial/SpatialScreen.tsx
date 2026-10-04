'use client';

import { BrandLogo, CircuitButton, GlyphCity, GridCard, GridFloor, Heading, Text } from '@acme/ui';
import { neon } from '@acme/theme';
import { Platform, useWindowDimensions } from 'react-native';
import { ScrollView, Section, View } from '@acme/ui/tw';
import { RiveStage } from './rive/RiveStage';
import { ForkSpatialLayout, getSpatialForkCapabilities } from './ForkSpatialLayout';
import { SpatialViroExperience } from './SpatialViroExperience';
import { TabletopSessionPanel } from './TabletopSessionPanel';
import { gridRace } from './gridRaceStore';
import { tabletopSession, useTabletopSessionStore } from './tabletopSessionStore';

const RIVE_DEMO = 'https://cdn.rive.app/animations/vehicles.riv';

export function SpatialScreen() {
  const capabilities = getSpatialForkCapabilities();
  // The hero fills most of the first screen so the grid floor shows below it
  // before the cards scroll in over it.
  const { height: windowHeight } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const showRace = useTabletopSessionStore((state) => state.spatialViewOpen);
  const setShowRace = useTabletopSessionStore((state) => state.setSpatialViewOpen);

  const tools = (
    <GridCard eyebrow="Runtime" title="Spatial backend">
      <Text className="text-sm text-white/75">
        {capabilities.metaSpatialWindows ? 'Meta Layout spatial window' : 'Inline / Viro spatial fallback'}
      </Text>
      <Text className="text-xs text-white/65">
        Viro Rive surface: {capabilities.viroRivePanel ? 'fork bridge detected' : 'stock fallback'}
      </Text>
    </GridCard>
  );

  return (
    <ForkSpatialLayout panel={tools}>
      {/* NeonBlade Grid Floor in the NYC Mon palette: orange lines, royal glow,
          carolina horizon haze on night. Slow scroll; reduced motion stops it. */}
      {/* On web the document scrolls, so an unbounded floor would stretch to the
          content height and push the horizon off-screen. Pin it to the
          viewport there and let the inner ScrollView scroll instead. */}
      <GridFloor
        className={isWeb ? 'h-dvh max-h-dvh' : 'flex-1'}
        horizon={0.45}
        columns={24}
        rows={18}
        speed={0.35}
        opacity={0.85}
        lineColor={neon.line}
        glowColor={neon.glow}
        horizonGlowColor={neon.glowSoft}
        bgColor={neon.bg}
      >
        <View pointerEvents="none" className="absolute inset-x-0 top-0 h-[45%]">
          <GlyphCity
            className="flex-1"
            variant="megacity"
            colorPrimary={neon.glow}
            colorSecondary={neon.line}
            colorTertiary={neon.glowSoft}
            opacity={0.5}
          />
        </View>
        <ScrollView
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-screen-2xl gap-6 px-4 py-8 sm:px-6 lg:px-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section
            className={`items-center justify-center gap-6 md:flex-row md:gap-10 ${isWeb ? 'min-h-[82dvh]' : ''}`}
            // Native has no dvh; web uses the class so SSR and hydration agree.
            style={isWeb ? undefined : { minHeight: windowHeight * 0.82 }}
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
            <View className="max-w-3xl flex-1 gap-4 md:order-1">
              <Heading level={1} size="display-sm" className="text-center text-primary md:text-left">
                Every block has a legend.
              </Heading>
              <Text className="max-w-2xl text-center text-white/80 md:text-left">
                Race light cycles across a neon New York grid on your phone, in the browser, or in a
                Quest or Pico headset. One codebase drives all of them.
              </Text>
              <View className="mt-2 flex-row flex-wrap justify-center gap-3 md:justify-start">
                <CircuitButton
                  tone="orange"
                  variant="solid"
                  onPress={() => {
                    if (showRace) {
                      gridRace.enterGateway();
                      tabletopSession.getState().reset();
                      setShowRace(false);
                    } else {
                      tabletopSession.getState().reset();
                      gridRace.startRace();
                      setShowRace(true);
                    }
                  }}
                >
                  {showRace ? 'Exit the race' : 'Start a 37-cycle race'}
                </CircuitButton>
                <CircuitButton onPress={() => { tabletopSession.getState().reset(); gridRace.enterGateway(); setShowRace(true); }}>
                  Enter the VR grid
                </CircuitButton>
              </View>
            </View>
          </Section>

          <View className="gap-4 lg:flex-row">
            <GridCard className="flex-1" title="One renderer for every screen">
              <Text className="text-sm leading-6 text-white/75">The grid floor, the skyline and the glyph city are Skia drawings that run unchanged on Expo and the web.</Text>
            </GridCard>
            <GridCard className="flex-1" title="Controls in team colours" tone="carolina">
              <Text className="text-sm leading-6 text-white/75">Grid cards and circuit buttons read their colours from the NYC Mon tokens, so a palette change lands everywhere at once.</Text>
            </GridCard>
            <GridCard className="flex-1" title="A race you can stand in" tone="orange">
              <Text className="text-sm leading-6 text-white/75">Light cycles turn at right angles, leave walls behind them, boost, and derez on contact. AI rivals fill the empty seats.</Text>
            </GridCard>
          </View>

          <TabletopSessionPanel onLaunch={() => setShowRace(true)} />

          {showRace ? (
            <View className="min-h-[460px] overflow-hidden border border-structure/40 bg-black/70">
              <SpatialViroExperience />
            </View>
          ) : (
            <GridCard title="Headset ready" tone="orange">
              <Text className="text-sm leading-6 text-white/75">
                Choose Enter the VR grid to load the shared Viro scene. Quest and Pico run the same scene module as this preview.
              </Text>
            </GridCard>
          )}

          <View className="gap-3">
            <Text className="text-base font-semibold text-accent">
              Rive surface
            </Text>
            <RiveStage source={RIVE_DEMO} />
          </View>
        </ScrollView>
      </GridFloor>
    </ForkSpatialLayout>
  );
}
