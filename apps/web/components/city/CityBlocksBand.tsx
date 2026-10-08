'use client';

import dynamic from 'next/dynamic';
import { Button, LazyScene, THEMES, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { W03_COPY } from './copy';

// GPU/Skia scene code loads only on the client, near the viewport.
const CityBlocks = dynamic(() => import('@acme/ui/backgrounds/CityBlocks').then((m) => m.CityBlocks), { ssr: false });

const DISTRICT = 'midtown';

/**
 * The Storybook Backgrounds/CityBlocks story (the kit's port of NeonBlade's
 * Hexagons) between the setting and the cast, at the story's args and size.
 * The block under the mouse pointer lights up. Traffic keeps moving while on
 * screen; the pause button is what lets that pass WCAG 2.2.2.
 */
export function CityBlocksBand() {
  const control = useInstanceStore(() => ({ stopped: false }));
  const stopped = useStore(control, (s) => s.stopped);
  const copy = W03_COPY.blocks;
  return (
    <View className="relative h-svh min-h-[35rem] w-full">
      <View aria-hidden className="absolute inset-0">
        <LazyScene className="flex-1" placeholderColor={THEMES[DISTRICT].sky[0]}>
          {({ paused }) => (
            <CityBlocks
              district={DISTRICT}
              seed={1}
              streetWidth={10}
              windowLights
              traffic
              trafficDensity={1}
              trafficSpeed={1}
              hoverEffect
              overlay={false}
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
