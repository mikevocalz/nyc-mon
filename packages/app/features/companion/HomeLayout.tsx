'use client';

import { memo, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { IDLE_PRESENCE, resolveSceneMode } from '@acme/core/sim';
import type { MonSceneInput } from '@acme/core/types';
import {
  Button, CreatureStage, HLynkShell, HLynkStage, Image, MonStillReaction, SheetSurface, useHLynkStageWide, useReducedMotion,
  type ImageProps,
} from '@acme/ui';
import { View } from '@acme/ui/tw';
import { useShallow } from 'zustand/react/shallow';
import { deepLinkStore } from '../onboarding/notify-route';
import { selectSceneInput, useMonStore } from '../mon/mon.store';
import { companionCopy } from './copy';
import { setHomeMenuOpen, useHomeStageStore, type HomeChrome } from './home-stage.store';
import { useMinuteClockDriver } from './minute-clock';
import { artFor } from './mon-identity';
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

/** The companion menu (Menu key, Q42 keeps screen names): Dex and Journal, by screen name. */
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

/** Subscribes to the stage store; the router slot is a sibling, so republishing never re-renders a route. */
function ShellHost() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const wide = useHLynkStageWide();
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
    <HLynkStage leading={wide ? stage.leading : undefined} trailing={wide ? stage.trailing : undefined} testID="home-stage">
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
