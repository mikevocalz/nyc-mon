// Copy and kit components for each non-default Game state. Errors say what
// happened and what to do; none apologise. "No data" (empty) and "couldn't
// draw" (render-error) are different sentences (product-decisions §2).
import { Banner, Button, EmptyState } from '@acme/ui';
import { ArrowLoader } from '@acme/ui/progress';
import { View } from '@acme/ui/tw';
import { BUNDLED_CITY_NAME } from './city-data.ts';
import { gameCameraStore, gameScreenActions } from './game-session.ts';
import type { GameViewState } from './game-status.ts';
import type { Rect } from './hud-layout.ts';

const backToStart = () => gameCameraStore.getState().move({ type: 'reset' });

export function GameStatusLayer({ state, rect }: { state: GameViewState; rect: Rect }) {
  if (state === 'ready') return null;
  // Computed: banner rect from resolveGameHudLayout (shares the controls' region).
  const box = { left: rect.x, top: rect.y, width: rect.width };

  if (state === 'loading') {
    return (
      <View className="absolute items-center gap-2" style={box} pointerEvents="none">
        {/* ArrowLoader stops its CSS animation under reduced motion and keeps role=progressbar. */}
        <ArrowLoader district="harlem" accessibilityLabel={`Loading ${BUNDLED_CITY_NAME}`} />
      </View>
    );
  }

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

  // Blocking states fill the container with the kit EmptyState over the canvas background.
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
      title: 'This device can’t show the 3D city',
      description: 'The Game world needs WebGPU, which this device doesn’t offer. Your Mon and H-Lynk care still work.',
      action: null,
    },
  }[state];

  return (
    <View className="absolute inset-0 items-center justify-center bg-surface px-4">
      <EmptyState district="harlem" title={blocking.title} description={blocking.description} action={blocking.action ?? undefined} />
    </View>
  );
}
