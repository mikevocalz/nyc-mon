'use client';

import { GridScene, LazyScene, THEMES } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { useDistrictStore } from '@acme/spatial/district';

/**
 * The street-grid scene between the starters and care, in the district picked
 * in the hero. Drawn as one still frame (PS-010, WCAG 2.2.2): a decorative band
 * never loops, and it mounts only near the viewport.
 */
export function GridBand() {
  const district = useDistrictStore((s) => s.district);
  return (
    <View aria-hidden className="h-40 w-full md:h-56">
      <LazyScene className="flex-1" placeholderColor={THEMES[district].sky[0]}>
        {() => <GridScene district={district} paused className="flex-1" />}
      </LazyScene>
    </View>
  );
}
