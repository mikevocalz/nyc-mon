'use client';
/**
 * The hero's two client islands (PS-008, PS-013). Everything else in the hero
 * is server HTML passed in as children. Both read the one district store
 * through its direct module path: the `@acme/spatial` barrel also exports the
 * Viro and Rive scenes, and importing it here put a 446 KB chunk on `/`.
 */
import { useEffect, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { brand } from '@acme/theme';
import { SceneSection, SegmentedControl, useInstanceStore, useStore } from '@acme/ui';
import { Text, View } from '@acme/ui/tw';
import { useDistrictStore } from '@acme/spatial/district';
import { DISTRICT_COPY, DISTRICTS } from '@acme/spatial/copy';

const DISTRICT_OPTIONS = DISTRICTS.map((value) => ({ value, label: DISTRICT_COPY[value].name }));

// The WebGPU city stays out of the entry chunk and mounts only once
// SceneSection is near the viewport. Imported by module path: a dynamic
// import of the @acme/ui barrel would pull the whole kit into one chunk.
const CityBlocks = dynamic(
  () => import('@acme/ui/backgrounds/CityBlocks').then((m) => m.CityBlocks),
  { ssr: false },
);

/**
 * How long the city moves before it holds a still frame. WCAG 2.2.2 lets
 * motion that starts on its own run up to 5 s without a pause control (PS-027).
 */
const CITY_MOTION_MS = 4500;

/**
 * The hero section with the picked district's city drawn behind its server
 * content. The section reserves its own height from the content, so the
 * canvas arriving never moves anything. The city moves for under 5 s after
 * mount, then holds still; picking a district plays the new city for the
 * same window. It also pauses while scrolled away. The canvas is decorative
 * (aria-hidden in the kit), so the section is named by the hero headline.
 */
export function HeroCity({ id, labelledBy, className, children }: { id: string; labelledBy: string; className: string; children: ReactNode }) {
  const district = useDistrictStore((s) => s.district);
  const motion = useInstanceStore(() => ({ settled: false }));
  const settled = useStore(motion, (s) => s.settled);
  useEffect(() => {
    motion.setState({ settled: false });
    const timer = setTimeout(() => motion.setState({ settled: true }), CITY_MOTION_MS);
    return () => clearTimeout(timer);
  }, [district, motion]);
  return (
    <SceneSection
      id={id}
      aria-labelledby={labelledBy}
      className={className}
      placeholderColor={brand.night}
      scene={({ paused }) => (
        <CityBlocks paused={paused || settled} district={district} overlay className="absolute inset-0" />
      )}
    >
      {children}
    </SceneSection>
  );
}

const PICKER_LABEL_ID = 'w01-district-label';

/**
 * The district control: a radio group (PS-012), keyboard-complete, no drag.
 * The visible label names the group through aria-labelledby, so a screen
 * reader announces it once, on entering the group.
 */
export function HeroDistrictPicker({ label }: { label: string }) {
  const district = useDistrictStore((s) => s.district);
  const setDistrict = useDistrictStore((s) => s.setDistrict);
  return (
    <View data-testid="w01-district" className="gap-2 bg-ink-950 p-3">
      <Text {...({ id: PICKER_LABEL_ID } as object)} className="text-sm font-semibold text-silver-100">{label}</Text>
      {/* Below `sm` the four districts sit as a 2x2 grid instead of wrapping 3 + 1. */}
      <SegmentedControl
        options={DISTRICT_OPTIONS}
        value={district}
        onChange={setDistrict}
        district={district}
        className="w-full sm:w-auto"
        segmentClassName="basis-[40%] sm:basis-auto"
        aria-labelledby={PICKER_LABEL_ID}
      />
    </View>
  );
}
