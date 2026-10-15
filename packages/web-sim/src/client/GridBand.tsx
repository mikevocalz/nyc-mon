import { Component, type ReactNode } from 'react';
import { Button, GridFloor, LazyScene, THEMES, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';

// apps/web/components/home/GridBand.tsx, composed the same way with the same
// props. The strings are W01_COPY.grid from apps/web/components/home/copy.ts,
// repeated here so this page doesn't import the Next app.
const GRID_COPY = { pause: 'Pause animation', play: 'Play animation' } as const;
const DISTRICT = 'midtown';

/**
 * The site's grid floor band: the district skyline over the moving street
 * grid. The pause button is what lets continuous motion pass WCAG 2.2.2.
 * Reduced motion draws it still.
 */
export function GridBand() {
  const control = useInstanceStore(() => ({ stopped: false }));
  const stopped = useStore(control, (s) => s.stopped);
  const copy = GRID_COPY;
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

/**
 * The band is decoration. If its GPU or CanvasKit path throws (a lost WebGPU
 * device with no WebGL to fall back on), drop the band and keep the simulator
 * up instead of letting the error unmount the page.
 */
export class GridBandBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.warn('[web-sim] grid band disabled:', error instanceof Error ? error.message : error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
