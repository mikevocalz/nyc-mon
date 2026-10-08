'use client';

import { Button, LazyScene, StreetPulse, THEMES, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { W03_COPY } from './copy';

const DISTRICT = 'midtown';

/**
 * The Storybook Backgrounds/StreetPulse story (the kit's port of NeonBlade's
 * Datalines with Grid) between the setting and the cast, at the story's args
 * and size. The block under the mouse pointer lights up. Pulses keep running
 * while on screen; the pause button is what lets that pass WCAG 2.2.2.
 */
export function StreetGridBand() {
  const control = useInstanceStore(() => ({ stopped: false }));
  const stopped = useStore(control, (s) => s.stopped);
  const copy = W03_COPY.blocks;
  return (
    <View className="relative h-svh min-h-[32.5rem] w-full">
      <View aria-hidden className="absolute inset-0">
        <LazyScene className="flex-1" placeholderColor={THEMES[DISTRICT].sky[0]}>
          {({ paused }) => (
            <StreetPulse
              district={DISTRICT}
              cellSize={50}
              maxLines={12}
              baseSpeed={2}
              lineLength={150}
              spawnProbability={0.1}
              overlay={false}
              seed={1}
              hoverEffect
              paused={paused || stopped}
              className="flex-1"
            />
          )}
        </LazyScene>
      </View>
      <View className="absolute bottom-4 right-4 md:bottom-6 md:right-6">
        <Button
          size="sm"
          title={stopped ? copy.play : copy.pause}
          aria-pressed={stopped}
          onPress={() => control.setState({ stopped: !stopped })}
        />
      </View>
    </View>
  );
}
