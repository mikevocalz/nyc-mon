/**
 * The room's backdrop: the site's GridBand (apps/web/components/home/GridBand.tsx)
 * with the same components, props and Pause button. The button sits top right
 * because the room's action bar holds the bottom edge.
 *
 * GridFloor draws on WebGPU and falls back to Skia CanvasKit, which cannot
 * load inside the MCP Apps sandbox (skia-web-sandbox.ts). So the floor mounts
 * only once the kit's own GPU check (`useGpuSupport`, which requests the
 * adapter and the device) reports `supported`, and it unmounts again if the
 * device is lost (`pending`/`unsupported`) or if the kit falls back to Skia
 * anyway (a failed scene setup). In every other case the backdrop is
 * LazyScene's placeholder sky, what the site shows before a scene draws, and
 * the Pause button is hidden because nothing moves. It also hides under
 * reduced motion, when the floor draws still. WebGPU on Echo Show is
 * undocumented (PLATFORM-DOCS §2.7), so expect the sky on a device.
 */
import { Button, GridFloor, LazyScene, THEMES, useGpuSupport, useInstanceStore, useReducedMotion, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { useStore as useVanillaStore } from 'zustand';
import { W01_COPY } from '../../../../../apps/web/components/home/copy';
import { skiaFallbackStore } from './skia-web-sandbox.ts';

const DISTRICT = 'midtown';

export function GridBackdrop() {
  const control = useInstanceStore(() => ({ stopped: false }));
  const stopped = useStore(control, (s) => s.stopped);
  const support = useGpuSupport();
  const fellBack = useVanillaStore(skiaFallbackStore, (s) => s.requested);
  const reducedMotion = useReducedMotion();
  const copy = W01_COPY.grid;
  const drawing = support === 'supported' && !fellBack;

  return (
    <>
      <View aria-hidden className="absolute inset-0">
        <LazyScene className="flex-1" placeholderColor={THEMES[DISTRICT].sky[0]}>
          {({ paused }) =>
            drawing ? (
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
            ) : null
          }
        </LazyScene>
      </View>
      {drawing && !reducedMotion ? (
        <View className="absolute right-4 top-4 z-10">
          <Button
            size="sm"
            title={stopped ? copy.play : copy.pause}
            aria-pressed={stopped}
            onPress={() => control.setState({ stopped: !stopped })}
          />
        </View>
      ) : null}
    </>
  );
}
