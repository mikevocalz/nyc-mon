'use client';

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Platform, findNodeHandle, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  CardSlider,
  Container,
  Heading,
  Image,
  SafeArea,
  StatusRow,
  Text,
  type ImageProps,
} from '@acme/ui';
import { Figure, Main, Section } from '@acme/ui/primitives';
import { View } from '@acme/ui/tw';
import { NYC_PHOTOS } from '../../../assets/photos';
import { eggs } from '@acme/content';
import { announcePolitely } from './announce';
import { copy, type OnboardingCopyId } from './copy';

/**
 * M02 Welcome: the three panels ride the kit's CardSlider in controlled mode
 * (`index`/`onIndexChange`), so Skip (jump to panel 3) and the full-width
 * Next drive the same track the dots and arrows do. Swipe, snap and the
 * reduced-motion no-animation step come from the slider; the 120 ms
 * cross-fade is the track snapping without animation.
 */

const LAST = 2;

interface PanelDef {
  n: 1 | 2 | 3;
  titleId: OnboardingCopyId;
  bodyId: OnboardingCopyId;
  altId: OnboardingCopyId;
  testID: string;
}

const PANELS: readonly PanelDef[] = [
  { n: 1, titleId: 'm02.p1.title', bodyId: 'm02.p1.body', altId: 'm02.p1.image.alt', testID: 'm02-panel-1' },
  { n: 2, titleId: 'm02.p2.title', bodyId: 'm02.p2.body', altId: 'm02.p2.image.alt', testID: 'm02-panel-2' },
  { n: 3, titleId: 'm02.p3.title', bodyId: 'm02.p3.body.a', altId: 'm02.p3.image.alt', testID: 'm02-panel-3' },
];

/** The proposed panel-1 photo (M02 handoff § Data; pending Mike's pick — the alt names the block, not who lives there). */
const P1_PHOTO = NYC_PHOTOS.find((p) => p.id === 'harlem-brownstone-stoops');

/** Bloodline caption copy id per starter (D7): keyed by `StarterEgg.bloodlineId`. */
const EGG_CAPTION: Record<string, OnboardingCopyId> = {
  F01: 'm02.p2.caption.f01',
  F02: 'm02.p2.caption.f02',
  F12: 'm02.p2.caption.f12',
};

/**
 * Egg silhouettes in starter slot order (eggs.ts slot order = starter order).
 * Unmarked by canon: Q11 (egg skins) is unanswered, so the only approved look
 * is "no colours or markings" — concrete/porcelain forms, deliberately drawn,
 * never a photo placeholder. Real captures swap in without a layout change.
 */
const EGG_SIZES = [
  { w: 62, h: 84 }, // #001 Metro Egg
  { w: 70, h: 96 }, // #008 Corner Egg
  { w: 58, h: 78 }, // #061 Prism Egg
] as const;

/** One porcelain egg silhouette: unmarked raised face with a hairline keyline. */
function EggShape({ w, h }: { w: number; h: number }) {
  return (
    <View
      className="border border-concrete-400 bg-surface-raised"
      style={{
        width: w,
        height: h,
        borderTopLeftRadius: w * 0.42,
        borderTopRightRadius: w * 0.42,
        borderBottomLeftRadius: w * 0.5,
        borderBottomRightRadius: w * 0.5,
      }}
    />
  );
}

/** Page-colored square rotated over the bottom-right corner: the hard corner cut. */
function CornerCut() {
  return (
    <View
      aria-hidden
      pointerEvents="none"
      className="absolute bg-bg"
      style={{ right: -16, bottom: -16, width: 32, height: 32, transform: [{ rotate: '45deg' }] }}
    />
  );
}

/** The framed panel visual: a keyed box, corner cut bottom-right, labelled as one image. */
function PanelFigure({ testID, alt, height, children }: { testID: string; alt: string; height: number; children: React.ReactNode }) {
  return (
    <View className="w-full" style={{ height }}>
      <Figure aria-label={alt} className="h-full w-full">
        <View
          testID={testID}
          className="relative h-full w-full overflow-hidden border-2 border-concrete-400 bg-surface-sunken"
          // RNW maps accessibilityRole="image" to role="img" on web; on web the
          // <figure> above already carries the label, so the native group label
          // stays off the DOM tree to avoid a double announcement.
          accessibilityRole="image"
          accessibilityLabel={Platform.OS === 'web' ? undefined : alt}
          accessible={Platform.OS !== 'web'}
        >
          <View className="h-full w-full" aria-hidden importantForAccessibility="no-hide-descendants">
            {children}
          </View>
          <CornerCut />
        </View>
      </Figure>
    </View>
  );
}

/** Panel 1: the real block — Harlem brownstone stoops, no Mon in frame. */
function CityArt() {
  if (P1_PHOTO === undefined) return null;
  return (
    <Image
      fill
      framed={false}
      src={P1_PHOTO.source as ImageProps['src']}
      alt=""
      unoptimized
      placeholder={P1_PHOTO.blurDataURL ? 'blur' : 'empty'}
      blurDataURL={P1_PHOTO.blurDataURL}
      contentFit="cover"
      className="h-full w-full"
    />
  );
}

/**
 * Panel 2: the three eggs on one ground line, still, each with its Bloodline
 * caption. Captions are hidden from assistive tech — the figure's alt reads
 * every name and Bloodline already (07-a11y).
 */
function EggsArt() {
  return (
    <View className="flex-1 items-center justify-center px-4">
      <View className="flex-row items-end justify-center gap-8">
        {eggs.map((egg, i) => (
          <EggShape key={egg.speciesId} w={EGG_SIZES[i]?.w ?? 62} h={EGG_SIZES[i]?.h ?? 84} />
        ))}
      </View>
      {/* One ground line under the three, then a caption per egg. */}
      <View aria-hidden className="mt-0.5 h-px w-4/5 bg-concrete-400" />
      <View className="mt-3 flex-row items-start justify-center gap-4">
        {eggs.map((egg) => (
          <Text
            key={egg.speciesId}
            variant="caption"
            tone="muted"
            className="w-24 text-center"
            testID={`m02-p2-caption-${egg.bloodlineId.toLowerCase()}`}
          >
            {copy(EGG_CAPTION[egg.bloodlineId] ?? 'm02.p2.caption.f01')}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * Panel 3: a restrained kit-drawn H-Lynk Core front view (Decision #16): matte
 * red body, black scanner head with the red emitter, dark screen, black key
 * row with the red-ringed trackpad. HLynkShell is a full-screen chrome, not a
 * placeable visual, so the figure draws the silhouette like panel 2's eggs.
 */
function HLynkArt() {
  return (
    <View className="flex-1 items-center justify-center">
      <View className="relative w-[148px] bg-hlynk-core-body p-2" style={{ height: 200 }}>
        {/* Antenna stub, top-left. */}
        <View aria-hidden className="absolute -top-1.5 left-2 h-2.5 w-1.5 bg-hlynk-core-black" />
        {/* Black scanner head with the red emitter. */}
        <View className="h-7 flex-row items-center justify-end bg-hlynk-core-black px-1.5">
          <View className="h-2 w-2 rounded-full bg-led-on" />
        </View>
        {/* Screen in its black bezel. */}
        <View className="mt-2 bg-hlynk-core-black p-1.5" style={{ height: 104 }}>
          <View className="flex-1 bg-surface-sunken" />
        </View>
        {/* Control row: home, menu, trackpad, back, forward. */}
        <View className="mt-2 h-9 flex-row items-center justify-between px-0.5">
          <View className="h-3 w-3 bg-hlynk-core-black" />
          <View className="h-3 w-3 bg-hlynk-core-black" />
          <View className="h-8 w-8 border-2 border-hlynk-core-ring bg-hlynk-core-black" />
          <View className="h-3 w-3 bg-hlynk-core-black" />
          <View className="h-3 w-3 bg-hlynk-core-black" />
        </View>
      </View>
    </View>
  );
}

const ART = [CityArt, EggsArt, HLynkArt] as const;

export interface WelcomeScreenProps {
  /**
   * Show the offline status row (m02.status.offline). The M02 handoff sources
   * this from "app connectivity adapter" — none exists yet (no expo-network /
   * NetInfo dependency is installed), so the route leaves it false until one
   * lands.
   */
  offline?: boolean;
}

/**
 * M02 Welcome carousel. Skip lives top-right on panels 1–2 and jumps TO panel
 * 3 (never past it: the Get started / Sign in split is P1). Get started → M04
 * `/(auth)/age`; the quieter sign-in link → M03 `/(auth)/sign-in?intent=sign-in`.
 */
export function WelcomeScreen({ offline = false }: WelcomeScreenProps) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const headingRef = useRef<unknown>(null);
  const announced = useRef(false);
  const { height: winHeight } = useWindowDimensions();
  // The spec's 62% share for the panel visual, bounded so the caption band,
  // progress tiles and actions keep their space on an SE.
  const figureHeight = Math.min(Math.round(winHeight * 0.44), 380);

  // Page-change announcement and focus move to the new heading (07-a11y).
  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      return;
    }
    announcePolitely(copy('m02.progress.a11y', { n: page + 1 }));
    if (Platform.OS !== 'web' && headingRef.current !== null) {
      const tag = findNodeHandle(headingRef.current as never);
      if (typeof tag === 'number') AccessibilityInfo.setAccessibilityFocus(tag);
    }
  }, [page]);

  // Android back on panels 2–3 returns to the previous panel; on panel 1 it leaves the app.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 0) return false;
      setPage((p) => Math.max(0, p - 1));
      return true;
    });
    return () => sub.remove();
  }, [page]);

  const pageLabel = copy('m02.progress.a11y', { n: page + 1 });
  const atLast = page === LAST;

  return (
    <Main className="flex-1 bg-bg" testID="m02-main">
      <SafeArea className="flex-1" edges={['top', 'bottom']}>
        <Container width="full" className="flex-1">
          <View className="mx-auto w-full max-w-[560px] flex-1 px-4">
            {/* Skip: top-right, 16 pt in — hidden on panel 3 (nothing to skip to). */}
            <View className="h-14 flex-row items-center justify-end pt-1">
              {!atLast ? (
                <View testID="m02-skip">
                  <Button
                    variant="ghost"
                    size="md"
                    tone="royal"
                    title={copy('m02.skip')}
                    aria-label={copy('m02.skip')}
                    accessibilityHint={copy('m02.skip.a11y.hint')}
                    onPress={() => setPage(LAST)}
                  />
                </View>
              ) : null}
            </View>

            {/* The panels: figure on top, caption band below, dots and arrows
                between the band and the actions (progressPosition below-content). */}
            <CardSlider
              label={copy('m02.carousel.label')}
              index={page}
              onIndexChange={setPage}
              visibleCount={1}
              gap={16}
              showButtons
              buttonPosition="bottom"
              progressStyle="dots"
              progressPosition="below-content"
              loop={false}
              autoPlay={false}
              tone="royal"
              className="flex-1"
            >
              {PANELS.map((panel) => {
                const Art = ART[panel.n - 1] ?? CityArt;
                return (
                  // col-reverse: the caption band is first in the tree (heading → body,
                  // the a11y focus order) while the figure still draws on top.
                  <Section
                    key={panel.n}
                    testID={panel.testID}
                    className="flex-col-reverse justify-end"
                    aria-label={copy('m02.progress.a11y', { n: panel.n })}
                  >
                    <View className="mt-4 min-h-[96px]">
                      <Heading
                        ref={panel.n - 1 === page ? (headingRef as never) : undefined}
                        level={panel.n === 1 ? 1 : 2}
                        size="title"
                        testID={`m02-p${panel.n}-title`}
                      >
                        {copy(panel.titleId)}
                      </Heading>
                      <Text testID={`m02-p${panel.n}-body`} className="mt-2">
                        {copy(panel.bodyId)}
                      </Text>
                    </View>
                    <PanelFigure testID={`m02-p${panel.n}-image`} alt={copy(panel.altId)} height={figureHeight}>
                      <Art />
                    </PanelFigure>
                  </Section>
                );
              })}
            </CardSlider>

            {/* Offline first run: no network is needed until sign-in. */}
            {offline ? (
              <View className="mt-4" testID="m02-status-offline">
                <StatusRow items={[{ id: 'offline', label: copy('m02.status.offline'), tone: 'neutral' }]} />
              </View>
            ) : null}

            {/* Actions, pinned below the progress row: Next on 1–2; the two intents on 3 (P1). */}
            <View className="mt-4 pb-4" aria-label={pageLabel}>
              {!atLast ? (
                <View testID="m02-next">
                  <Button
                    variant="ghost"
                    size="md"
                    fullWidth
                    tone="royal"
                    title={copy('m02.next')}
                    onPress={() => setPage((p) => Math.min(LAST, p + 1))}
                  />
                </View>
              ) : (
                <View className="gap-3">
                  <View testID="m02-cta-get-started">
                    <Button
                      variant="cta"
                      size="lg"
                      fullWidth
                      title={copy('m02.p3.cta.primary')}
                      accessibilityHint={copy('m02.p3.cta.primary.a11y.hint')}
                      onPress={() => router.push('/(auth)/age')}
                    />
                  </View>
                  <View testID="m02-cta-sign-in" className="items-center">
                    <Button
                      variant="ghost"
                      size="md"
                      tone="royal"
                      title={copy('m02.p3.cta.secondary')}
                      accessibilityHint={copy('m02.p3.cta.secondary.a11y.hint')}
                      onPress={() => router.push('/(auth)/sign-in?intent=sign-in')}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        </Container>
      </SafeArea>
    </Main>
  );
}
