// Copy and kit components for each non-default Game state. Errors say what
// happened and what to do; none apologise. "No data" (empty) and "couldn't
// draw" (render-error) are different sentences (product-decisions §2).
import { Banner, Button, EmptyState } from '@acme/ui';
import { LOBBY_COPY } from '@acme/ui/lobby';
import { ProgressBar } from '@acme/ui/progress';
import { useStore } from 'zustand';
import { View } from '@acme/ui/tw';
import { BUNDLED_CITY_NAME } from './city-data.ts';
import { gameCameraStore, gameScreenActions, gameScreenStore } from './game-session.ts';
import type { GameViewState } from './game-status.ts';
import type { Rect } from './hud-layout.ts';

const backToStart = () => gameCameraStore.getState().move({ type: 'reset' });

export function GameStatusLayer({ state, rect, region }: { state: GameViewState; rect: Rect; region: Rect }) {
  if (state === 'ready') return null;
  // Computed: banner rect from resolveGameHudLayout (shares the controls' region).
  const box = { left: rect.x, top: rect.y, width: rect.width };

  if (state === 'loading') return <WorldLoader />;

  if (state === 'empty') {
    // Non-blocking: the world stays live and touchable under a small banner.
    return (
      <View className="absolute" style={box} pointerEvents="box-none">
        <Banner
          tone="neutral"
          title="Nothing mapped here yet"
          description={`This sample covers ${BUNDLED_CITY_NAME}.`}
          action={<Button size="sm" district="harlem" title="Back to the Apollo" onPress={backToStart} />}
        />
      </View>
    );
  }

  // Blocking states cover the canvas with the kit EmptyState.
  const blocking = {
    'data-error': {
      title: 'The Harlem map didn’t load',
      description: 'The map file in this build is damaged. Update the app to get a working copy.',
      action: null,
    },
    'render-error': {
      title: 'The 3D view stopped drawing',
      description: 'The graphics driver reported an error. Try again; if it keeps happening, restart the app.',
      action: <Button district="harlem" title="Try again" onPress={gameScreenActions.retry} />,
    },
    unsupported: {
      title: 'This H-Lynk can’t show the 3D city',
      description: 'The Game world needs WebGPU, which this H-Lynk doesn’t offer. Your Mon and H-Lynk care still work.',
      action: null,
    },
  }[state];

  // The opaque cover spans the container; the message and its action sit in
  // one usable region (computed by resolveGameHudLayout) so neither straddles a hinge.
  return (
    <View className="absolute inset-0 bg-surface">
      <View
        className="absolute items-center justify-center px-4"
        style={{ left: region.x, top: region.y, width: region.width, height: region.height }}
      >
        <EmptyState district="harlem" title={blocking.title} description={blocking.description} action={blocking.action ?? undefined} />
      </View>
    </View>
  );
}

/**
 * The world's load gate: an opaque night cover with the kit's skyline bar and
 * its percentage, until the first frame lands. The value is the store's staged
 * `loadProgress` (LOAD_STAGES), never a timer. Swallows touches so nothing is
 * pressed on a half-built world.
 */
function WorldLoader() {
  const progress = useStore(gameScreenStore, (s) => s.loadProgress);
  return (
    <View className="absolute inset-0 items-center justify-center bg-ink-950 px-8">
      {/* Tablet: the skyline bar widens with the screen instead of staying phone-length. */}
      <View className="w-full max-w-[420px] md:max-w-[560px] lg:max-w-[640px]">
        <ProgressBar
          value={progress}
          district="harlem"
          size="lg"
          showLabel
          label={LOBBY_COPY.startLoading}
          accessibilityLabel={LOBBY_COPY.startLoadingA11y}
        />
      </View>
    </View>
  );
}
