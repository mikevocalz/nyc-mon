'use client';

import { useMemo } from 'react';
import { Button } from '../../Button';
import { Output } from '../../html';
import { SegmentedControl } from '../../SegmentedControl';
import type { SegmentedOption } from '../../SegmentedControl.types';
import { Switch } from '../../Switch';
import { View } from '../../tw';
import { useInstanceStore, useStore } from '../../use-instance-store';
import { DeviceStage, type DeviceCapture } from './DeviceStage';
import type { DeviceSceneParams } from './device-scene';
import { HUD_TABS, hudCaption, initialHudState, type HudContent, type HudTab } from './hud';
import { createHudScreen } from './hud-screen';

/** Labels for the controls under the stage. */
export interface HLynkHudStageControls {
  /** accessible name of the tab control */
  tabs: string;
  /** the side key button */
  sideKey: string;
  /** the sound switch */
  sound: string;
}

export interface HLynkHudStageProps {
  /** `placeholder`: the procedural H-Lynk Core. `h-lynk-entry`: the real model, same frame. */
  model?: DeviceSceneParams['model'];
  /** What the H-Lynk's screen shows, per tab. */
  hud: HudContent;
  controls: HLynkHudStageControls;
  /** Shown before the canvas mounts, without JavaScript, under reduced motion, and if no GPU backend starts. */
  capture: DeviceCapture;
  /** Visible caption under the stage. */
  caption: string;
  /** Accessible name of the stage figure. */
  label: string;
  /** Classes for the figure (width, placement). */
  className?: string;
}

/**
 * The H-Lynk with its HUD (PS-037): DeviceStage showing the five-tab screen,
 * with the tab control, the live caption, the side key and the sound switch
 * under it. The server renders the capture, the controls and the caption of
 * the default tab, so the caption is the screen's content as text even when
 * no canvas runs.
 *
 * One HUD store per stage holds the tab and the sound switch. The tab control
 * is the accessible source of truth; a tap on the 3D screen's tab bar writes
 * the same store, and the scene repaints only when it changes.
 */
export function HLynkHudStage({ model = 'placeholder', hud, controls, capture, caption, label, className }: HLynkHudStageProps) {
  const store = useInstanceStore(initialHudState);
  const tab = useStore(store, (s) => s.tab);
  const sound = useStore(store, (s) => s.sound);
  const screen = useMemo(() => createHudScreen(hud, store), [hud, store]);
  const options = useMemo<SegmentedOption<HudTab>[]>(
    () => HUD_TABS.map((value) => ({ value, label: hud.tabs[value] })),
    [hud],
  );

  return (
    <DeviceStage
      screen={screen}
      model={model}
      capture={capture}
      caption={caption}
      label={label}
      className={className}
      sound={sound}
      testID="w01-device-stage"
      captureTestID="w01-device-capture"
    >
      {({ pressSideKey }) => (
        <View testID="w01-hlynk-controls" className="gap-3">
          <SegmentedControl
            options={options}
            value={tab}
            onChange={(next) => store.setState({ tab: next })}
            aria-label={controls.tabs}
            tone="apple"
            className="w-full self-stretch"
            segmentClassName="basis-0 px-2 md:px-3"
          />
          <Output
            aria-live="polite"
            data-testid="w01-hlynk-readout"
            className="min-h-[4.5rem] text-sm leading-6 text-text"
          >
            {hudCaption(tab, hud)}
          </Output>
          <View className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <Button
              title={controls.sideKey}
              variant="outline"
              tone="apple"
              size="sm"
              onPress={pressSideKey}
              testID="w01-hlynk-side-key"
            />
            <Switch
              value={sound}
              onChange={(next) => store.setState({ sound: next })}
              label={controls.sound}
              tone="apple"
              className="w-auto"
            />
          </View>
        </View>
      )}
    </DeviceStage>
  );
}
