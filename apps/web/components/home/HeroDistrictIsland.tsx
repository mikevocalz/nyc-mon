'use client';
/**
 * The hero's two client islands (PS-008, PS-013). Everything else in the hero
 * is server HTML passed in as children. Both read the one district store
 * through its direct module path: the `@acme/spatial` barrel also exports the
 * Viro and Rive scenes, and importing it here put a 446 KB chunk on `/`.
 */
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { brand } from '@acme/theme';
import { SceneSection, SegmentedControl } from '@acme/ui';
import { Fieldset, Legend } from '@acme/ui/html';
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
 * The hero section with the picked district's city drawn behind its server
 * content. The section reserves its own height from the content, so the
 * canvas arriving never moves anything; it pauses while scrolled away.
 */
export function HeroCity({ id, cityLabels, className, children }: { id: string; cityLabels: Record<string, string>; className: string; children: ReactNode }) {
  const district = useDistrictStore((s) => s.district);
  return (
    <SceneSection
      id={id}
      className={className}
      placeholderColor={brand.night}
      scene={({ paused }) => (
        <CityBlocks
          paused={paused}
          district={district}
          overlay
          className="absolute inset-0"
          accessibilityLabel={cityLabels[district]}
        />
      )}
    >
      {children}
    </SceneSection>
  );
}

/** The district control: a radio group (PS-012), keyboard-complete, no drag. */
export function HeroDistrictPicker({ label }: { label: string }) {
  const district = useDistrictStore((s) => s.district);
  const setDistrict = useDistrictStore((s) => s.setDistrict);
  return (
    <Fieldset data-testid="w01-district" className="m-0 gap-2 border-0 bg-ink-950 p-3">
      <Legend className="float-left mb-2 w-full p-0 text-sm font-semibold text-silver-100">{label}</Legend>
      <SegmentedControl options={DISTRICT_OPTIONS} value={district} onChange={setDistrict} district={district} />
    </Fieldset>
  );
}
