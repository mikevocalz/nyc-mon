'use client';

import { memo, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { IDLE_PRESENCE, resolveSceneMode } from '@acme/core/sim';
import type { MonSceneInput } from '@acme/core/types';
import {
  Button, CreatureStage, HLynkShell, HLynkStage, Image, MonStillReaction, SheetSurface, useReducedMotion,
  useInstanceStore, type DeviceKey, type GlassView, type ImageProps,
} from '@acme/ui';
import { View } from '@acme/ui/tw';
import { useShallow } from 'zustand/react/shallow';
import { deepLinkStore } from '../onboarding/notify-route';
import { selectActiveMon, selectCareNow, selectSceneInput, useMonStore } from '../mon/mon.store';
import { companionCopy } from './copy';
import { PERSISTENT_LAYOUT, PersistentGlassStage, useGlassOn, useGlassScreen, useMonGlass } from './glass';
import { setHomeMenuOpen, useHomeStageStore, type HomeChrome } from './home-stage.store';
import { useMinuteClock, useMinuteClockDriver } from './minute-clock';
import { artFor, monIdentity } from './mon-identity';
import { allSpecies } from '@acme/content';

/** Flat phone scene (ADR 0011): the 2D window never asks for room or tabletop in this lane. */
const PHONE_SCENE = resolveSceneMode({ platform: 'phone', capabilities: null, anchors: undefined, preference: 'screen' });
const dexBySpecies = new Map(allSpecies.map((s) => [s.speciesId, s.dexId]));

/** The 2D Baby still for a scene, until the renderer's model slot replaces it (CreatureStage.renderStill). */
function renderStill(scene: MonSceneInput): ReactNode {
  const art = artFor('baby', dexBySpecies.get(scene.mon.speciesId) ?? null);
  if (art === undefined) return null;
  return (
    <View className="mb-[6%] w-[62%]" style={{ aspectRatio: art.width / art.height }}>
      <Image
        src={art.source as ImageProps['src']}
        alt={art.alt}
        fill
        framed={false}
        unoptimized
        className="h-full w-full"
      />
    </View>
  );
}

/** Before any route publishes (one frame at most), the shell sits dark and named. */
const IDLE_CHROME: HomeChrome = {
  status: { led: 'off' },
  scheme: 'night',
  trackpad: { label: '', disabled: true },
  testIDPrefix: 'home',
  creature: false,
  framing: 'home',
};

/** Memoised: a republish that leaves `chrome` and `reducedMotion` alone skips the creature. */
const CreatureLayer = memo(function CreatureLayer({ chrome, reducedMotion }: { chrome: HomeChrome; reducedMotion: boolean }) {
  const selector = useMemo(() => selectSceneInput(PHONE_SCENE, IDLE_PRESENCE), []);
  const scene = useMonStore(selector);
  const reaction = chrome.reaction;
  return (
    <CreatureStage<MonSceneInput>
      scene={chrome.creature ? (scene ?? null) : null}
      framing={chrome.framing}
      performance={chrome.performance}
      reducedMotion={reducedMotion}
      renderStill={(s) => (
        <MonStillReaction playKey={reaction?.key ?? 0} reaction={reaction?.kind ?? 'tilt'} reducedMotion={reducedMotion}>
          {renderStill(s)}
        </MonStillReaction>
      )}
    />
  );
});

/** The companion menu (Menu key, Q42 keeps screen names): Dex, Journal and Settings, by screen name. */
function CompanionMenu() {
  const router = useRouter();
  const open = useHomeStageStore((s) => s.menuOpen);
  const monId = useMonStore((s) => s.activeMonInstanceId);
  if (!open || monId === undefined) return null;
  const go = (href: Parameters<typeof router.push>[0]) => {
    setHomeMenuOpen(false);
    router.push(href);
  };
  return (
    <View className="absolute inset-x-0 bottom-0">
      <SheetSurface placement="in-screen" scheme="night" onClose={() => setHomeMenuOpen(false)} closeLabel={companionCopy('m14.close')} testID="home-menu">
        <View className="gap-target-gap">
          {([
            ['m13.bar.dex', `/(home)/mon/${monId}`, 'home-menu-dex'],
            ['m18.title', '/(home)/journal', 'home-menu-journal'],
            ['m13.menu.settings', '/(home)/settings', 'home-menu-settings'],
          ] as const).map(([id, href, testID]) => (
            <View key={testID} testID={testID}>
              <Button variant="outline" size="lg" fullWidth title={companionCopy(id)} onPress={() => go(href)} className="min-h-target" />
            </View>
          ))}
        </View>
      </SheetSurface>
    </View>
  );
}

/** With no route screen published, the glass shows the Baby large under its name and the route's status. */
const COMPANION_LAYOUT = PERSISTENT_LAYOUT;

/**
 * The ONE 3D H-Lynk for every `(home)` route on the 3D path, mounted here so
 * it survives route changes: routes publish their screens to it (GlassStage)
 * and it swaps the glass in place. Its Baby loads once. With no route screen
 * published (between routes, or a shell route that has none yet) the glass
 * shows the Baby under its name, the route's trackpad and keys stay mapped,
 * and the route's own controls stay live over it. No 2D shell, no photo.
 */
function PersistentGlass() {
  const router = useRouter();
  const stage = useHomeStageStore(useShallow((s) => ({ chrome: s.chrome, screen: s.screen, routed: s.glass !== null })));
  const chrome = stage.chrome ?? IDLE_CHROME;
  const mon = useMonStore(selectActiveMon);
  const nowMs = useMinuteClock((s) => s.nowMs);
  const care = useMonStore(useMemo(() => selectCareNow(nowMs), [nowMs]));
  const identity = mon === undefined ? undefined : monIdentity(mon);
  const { model, monClips } = useMonGlass(identity?.dexId ?? null, care);
  const statusLabel = 'label' in chrome.status ? (chrome.status.label ?? '') : '';
  const view: GlassView = {
    status: statusLabel !== '' ? { text: statusLabel, tone: chrome.status.led === 'needsYou' ? 'request' : 'neutral' } : null,
    title: identity?.name ?? '',
    subtitle: identity?.bloodlineLabel ?? '',
    rings: [],
    lines: [],
    actions: [],
  };
  const glass = useGlassScreen({ layout: COMPANION_LAYOUT, model: mon === undefined ? null : model, view });
  useEffect(() => {
    glass.bind({ monClips });
  });
  const chromeRef = useInstanceStore(() => ({ chrome }));
  useEffect(() => {
    chromeRef.setState({ chrome });
  });
  const fallbackKey = useCallback((key: DeviceKey) => {
    const c = chromeRef.getState().chrome;
    const keys = c.keys;
    if (key === 'activate') c.trackpad.onActivate?.();
    else if (key === 'prev') c.trackpad.onStep?.(-1);
    else if (key === 'next') c.trackpad.onStep?.(1);
    else if (key === 'back') (keys?.back?.onPress ?? (() => router.back()))();
    else if (key === 'home') keys?.home?.onPress?.();
    else if (key === 'menu') (keys?.menu?.onPress ?? (() => setHomeMenuOpen(!useHomeStageStore.getState().menuOpen)))();
  }, [chromeRef, router]);
  return (
    <PersistentGlassStage model={mon === undefined ? null : model} fallback={glass.screen} fallbackKey={fallbackKey} label={identity?.name ?? chrome.trackpad.label}>
      {stage.routed ? null : (
        <>
          {statusLabel !== '' ? <View testID={`${chrome.testIDPrefix}-status-a11y`} className="absolute left-0 top-0 h-px w-px opacity-0" accessible accessibilityLabel={statusLabel} /> : null}
          {/* A shell route with no glass of its own: its controls stay live over the stage. */}
          <View className="absolute inset-x-0 bottom-0 top-1/2" style={{ pointerEvents: 'box-none' }}>{stage.screen}</View>
          <CompanionMenu />
        </>
      )}
    </PersistentGlassStage>
  );
}

/** Subscribes to the stage store; the router slot is a sibling, so republishing never re-renders a route. */
function ShellHost() {
  const immersive = useHomeStageStore((s) => s.immersive);
  const glassFailed = useHomeStageStore((s) => s.glassFailed);
  const glassOn = useGlassOn(glassFailed);
  // Reduced motion, accessibility text sizes or no GPU: the 2D shell is the fallback.
  if (!glassOn) return immersive ? null : <Shell2D />;
  // A route with a full-window canvas of its own (M11's incubating egg, M12's hatch) draws everything itself.
  if (immersive) return null;
  // Every other route: the one persistent 3D H-Lynk, kept mounted across route changes.
  return <PersistentGlass />;
}

function Shell2D() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const stage = useHomeStageStore(
    useShallow((s) => ({ chrome: s.chrome, screen: s.screen, leading: s.leading, trailing: s.trailing, bare: s.bare })),
  );
  const chrome = stage.chrome ?? IDLE_CHROME;
  const keys: HomeChrome['keys'] = {
    back: { onPress: () => router.back() },
    menu: { onPress: () => setHomeMenuOpen(!useHomeStageStore.getState().menuOpen) },
    ...chrome.keys,
  };
  return (
    <HLynkStage leading={stage.bare ? undefined : stage.leading} trailing={stage.bare ? undefined : stage.trailing} testID="home-stage">
      <HLynkShell
        tier="core"
        scheme={chrome.scheme}
        status={chrome.status}
        reducedMotion={reducedMotion}
        layout={chrome.layout}
        trackpad={chrome.trackpad}
        keys={keys}
        statusRow={chrome.statusRow}
        accessibilityHidden={stage.bare}
        testIDPrefix={chrome.testIDPrefix}
        screen={
          <View className="flex-1">
            <CreatureLayer chrome={chrome} reducedMotion={reducedMotion} />
            <View className="flex-1" style={{ pointerEvents: 'box-none' }}>{stage.screen}</View>
            <CompanionMenu />
          </View>
        }
      />
    </HLynkStage>
  );
}

/**
 * `/(home)/_layout.tsx`: the H-Lynk shell and the creature layer, mounted once
 * for M11, M12, M09 and M13–M16, so the Mon never hard-cuts between them
 * (M12 continuity rule). Routes publish their chrome and in-screen content
 * through `useHomeStage` and render nothing themselves; bare routes (M17,
 * M18, "Shell: none") draw full-window over the mounted shell in the slot
 * layer. The slot stays at one place in the tree, so route state survives.
 * A route on the full-window 3D H-Lynk (M11 when the GPU stage runs) sets
 * `immersive` and the 2D shell is not mounted at all while it shows.
 */
export function HomeLayout({ children }: { children: ReactNode }) {
  useMinuteClockDriver();
  const router = useRouter();
  // M01 boots here for incubating / egg-ready / companion and arms a
  // hatch-ready tap that arrived during boot. Pushing it from this mount puts
  // it after M01's replace has committed (M12 B3).
  useEffect(() => {
    const link = deepLinkStore.takeArmed();
    if (link !== undefined) router.push({ pathname: link.pathname, params: { ...link.params } });
    // The router is a stable imperative handle; mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View className="flex-1 bg-bg">
      <ShellHost />
      <View className="absolute inset-0" style={{ pointerEvents: 'box-none' }}>{children}</View>
    </View>
  );
}
