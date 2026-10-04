'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { listUnmetNeeds, type BootRoute } from '@acme/core/sim';
import {
  FadeIn,
  HLYNK_COPY,
  HLynkShell,
  SHELL_HANDOFF_MS,
  SafeArea,
  useReducedMotion,
  type HLynkPower,
  type HLynkStatus,
} from '@acme/ui';
import { View } from '@acme/ui/tw';
import { resolveBootPath } from './boot';
import { readSave } from './save-store';
import { copy } from './copy';
import { schemeForTime } from './time-scheme';

/** ms before `power` reaches `on`: the M01 emitter ramp (240 ms full, step-on reduced). */
const POWER_ON_MS = 240;
/** ms before the route replaces the boot: the M01 600 ms budget. */
const HANDOFF_MS = 600;

/**
 * The LED state the destination arrives with, from the resolved boot route
 * and the save it read (M01 § States). `off` covers every route that never
 * lights the LED.
 */
function destinationStatus(route: BootRoute, nowMs: number): HLynkStatus {
  const save = readSave();
  switch (route.kind) {
    case 'incubating': {
      const egg = save?.eggs.find((e) => e.eggId === route.eggId);
      const totalMs = (egg?.incubationMinutes ?? 15) * 60_000;
      const remaining = egg === undefined ? totalMs : Math.max(0, egg.incubationEndsAt - nowMs);
      const progress = Math.min(1, Math.max(0, 1 - remaining / totalMs));
      return { led: 'incubating', label: HLYNK_COPY['hlynk.led.incubating'], progress };
    }
    case 'egg-ready':
      return { led: 'ready', label: HLYNK_COPY['hlynk.led.ready'] };
    case 'companion': {
      const care = save?.care.find((c) => c.monInstanceId === route.monInstanceId);
      return care !== undefined && listUnmetNeeds(care).length > 0
        ? { led: 'needsYou', label: HLYNK_COPY['hlynk.led.needs_you'] }
        : { led: 'off' };
    }
    default:
      return { led: 'off' };
  }
}

/**
 * M01 Boot / power-on: resolves the session's route from the MMKV snapshot
 * synchronously (never the network), plays the H-Lynk Core waking — emitter,
 * one fan sweep, screen lights — and replaces itself with the destination
 * inside the 600 ms budget. First run lowers the shell away so M02/M04
 * stands without chrome (P4).
 */
export function BootScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [power, setPower] = useState<HLynkPower>('off');
  const resolved = useRef<{ route: BootRoute; path: Href; scheme: 'daylit' | 'night' } | null>(null);
  if (resolved.current === null) {
    const nowMs = Date.now();
    resolved.current = { ...resolveBootPath(nowMs), scheme: schemeForTime(nowMs) };
  }
  const { route, path, scheme } = resolved.current;
  const firstRun = route.kind === 'first-run';

  useEffect(() => {
    const rampMs = reducedMotion ? 0 : POWER_ON_MS;
    const bootTimer = setTimeout(() => setPower('booting'), 0);
    const onTimer = setTimeout(() => setPower('on'), rampMs);
    // First run: the shell lowers away after the screen lights (SHELL_HANDOFF_MS).
    const exitMs = (reducedMotion ? 0 : HANDOFF_MS - POWER_ON_MS) + POWER_ON_MS + (firstRun ? SHELL_HANDOFF_MS[reducedMotion ? 'reduced' : 'full'] : 0);
    const exitTimer = setTimeout(() => router.replace(path), exitMs);
    return () => {
      clearTimeout(bootTimer);
      clearTimeout(onTimer);
      clearTimeout(exitTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = destinationStatus(route, Date.now());
  return (
    <SafeArea className="flex-1 bg-bg">
      <FadeIn reducedMotion={reducedMotion} className="flex-1">
        <HLynkShell
          testIDPrefix="m01"
          tier="core"
          power={power}
          scheme={scheme}
          reducedMotion={reducedMotion}
          status={status}
          accessibilityHidden={firstRun}
          powerOnAnnouncement={copy('m01.a11y.power_on')}
          screen={<View testID="m01-screen-content" className="flex-1 bg-ink-950" />}
          trackpad={{ label: HLYNK_COPY['hlynk.trackpad.label'], disabled: true }}
        />
      </FadeIn>
    </SafeArea>
  );
}
