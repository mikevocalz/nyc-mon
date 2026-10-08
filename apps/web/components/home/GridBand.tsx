'use client';

import { useEffect } from 'react';
import { GridScene, LazyScene, THEMES, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';

// The Storybook Backgrounds/GridScene story, as-is: the Mega City deck over the
// street grid at the story's default args.
const DISTRICT = 'megacity';

// Under WCAG 2.2.2 motion that starts on its own stops within 5 s, so the
// grid runs while on screen and holds its last frame after this long (PS-027).
const GRID_MOTION_MS = 4500;

function MovingGrid({ paused }: { paused: boolean }) {
  const motion = useInstanceStore(() => ({ settled: false }));
  const settled = useStore(motion, (s) => s.settled);
  useEffect(() => {
    if (paused || settled) return;
    const timer = setTimeout(() => motion.setState({ settled: true }), GRID_MOTION_MS);
    return () => clearTimeout(timer);
  }, [paused, settled, motion]);
  return (
    <GridScene
      district={DISTRICT}
      horizon={0.5}
      gap={0.08}
      columns={24}
      rows={18}
      speed={0.6}
      opacity={1}
      lineWidth={1}
      showCeiling
      showFloor
      paused={paused || settled}
      className="flex-1"
    />
  );
}

/** The grid scene between the starters and care, at the Storybook story's size and args. */
export function GridBand() {
  return (
    <View aria-hidden className="h-svh min-h-[32.5rem] w-full">
      <LazyScene className="flex-1" placeholderColor={THEMES[DISTRICT].sky[0]}>
        {({ paused }) => <MovingGrid paused={paused} />}
      </LazyScene>
    </View>
  );
}
