'use client';

import { useEffect } from 'react';
import type { StoreApi } from 'zustand';
import { Button, GridFloor, LazyScene, THEMES, useInstanceStore, useReducedMotion, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { W01_COPY } from './copy';

// The Storybook Backgrounds/GridFloor story, as-is: the district skyline on
// top and the moving street grid below, at the story's default args.
const DISTRICT = 'midtown';

/**
 * How long the grid travels once it is on screen before it holds a still
 * frame: the hero city's window (PS-027), so WCAG 2.2.2's 5 s limit holds
 * without leaning on the button (PS-036).
 */
const GRID_MOTION_MS = 4500;

type GridMotion = { settled: boolean };

/**
 * The floor itself. The settle window starts the first time the band is
 * actually visible (LazyScene mounts it 600 px early), and restarts when the
 * visitor presses Play. Offscreen it is paused either way (PS-010).
 */
function SettlingGridFloor({ paused, motion }: { paused: boolean; motion: StoreApi<GridMotion> }) {
  const settled = useStore(motion, (s) => s.settled);
  useEffect(() => {
    if (paused || settled) return;
    const timer = setTimeout(() => motion.setState({ settled: true }), GRID_MOTION_MS);
    return () => clearTimeout(timer);
  }, [paused, settled, motion]);
  return (
    <GridFloor
      district={DISTRICT}
      horizon={0.45}
      columns={24}
      rows={18}
      speed={0.6}
      opacity={1}
      lineWidth={1}
      skyline
      paused={paused || settled}
      className="flex-1"
    />
  );
}

/**
 * The grid floor between the starters and care (PS-036). Its one purpose is
 * a spatial beat: the street running toward the reader carries them from the
 * eggs on the table out into the city where care happens. It travels for
 * 4.5 s once on screen, then holds still like the hero city; Play replays
 * the window and Pause stops it early. Reduced motion draws it still (the
 * kit's QuadBackground) and drops the button, which would control nothing.
 * It never loops while scrolled away.
 */
export function GridBand() {
  const motion = useInstanceStore<GridMotion>(() => ({ settled: false }));
  const settled = useStore(motion, (s) => s.settled);
  const reducedMotion = useReducedMotion();
  const copy = W01_COPY.grid;
  return (
    <View className="relative h-svh min-h-[32.5rem] w-full">
      <View aria-hidden className="absolute inset-0">
        <LazyScene className="flex-1" placeholderColor={THEMES[DISTRICT].sky[0]}>
          {({ paused }) => <SettlingGridFloor paused={paused} motion={motion} />}
        </LazyScene>
      </View>
      {reducedMotion ? null : (
        <View className="absolute bottom-4 right-4 md:bottom-6 md:right-6">
          <Button
            size="sm"
            title={settled ? copy.play : copy.pause}
            onPress={() => motion.setState({ settled: !settled })}
          />
        </View>
      )}
    </View>
  );
}
