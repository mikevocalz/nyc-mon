'use client';

import { Button, GridFloor, LazyScene, THEMES, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { W01_COPY } from './copy';

// The Storybook Backgrounds/GridFloor story, as-is: the district skyline on
// top and the moving street grid below, at the story's default args.
const DISTRICT = 'midtown';

/**
 * The grid floor between the starters and care, at the Storybook story's size
 * and args. It keeps moving while on screen; the pause button is what lets
 * continuous motion pass WCAG 2.2.2. Reduced motion draws it still.
 */
export function GridBand() {
  const control = useInstanceStore(() => ({ stopped: false }));
  const stopped = useStore(control, (s) => s.stopped);
  const copy = W01_COPY.grid;
  return (
    <View className="relative h-svh min-h-[32.5rem] w-full">
      <View aria-hidden className="absolute inset-0">
        <LazyScene className="flex-1" placeholderColor={THEMES[DISTRICT].sky[0]}>
          {({ paused }) => (
            <GridFloor
              district={DISTRICT}
              horizon={0.45}
              columns={24}
              rows={18}
              speed={0.6}
              opacity={1}
              lineWidth={1}
              skyline
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
