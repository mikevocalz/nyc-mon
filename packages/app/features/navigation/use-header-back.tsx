'use client';
// The shell's Back: one decision (header-back.ts), drawn in one of two places.
// On rail hardware the shell header draws it at its left edge (RootShell).
// Where no header is drawn (phones, which show the bar at the bottom, and
// immersive moments on rail hardware) the screen draws it top-left in its
// content through ScreenBack. Never both.
// SOT-KEYWORDS: header back button screen back rail phone
import { usePathname, useRouter } from 'expo-router';
import { useStore } from 'zustand';
import { BackButton, useInstanceStore } from '@acme/ui';
import { useAdaptiveNavigationPlacement } from '@acme/ui/adaptive-panes/parts';
import { View } from '@acme/ui/tw';
import { useHomeStageStore } from '../companion/home-stage.store';
import { lobbyStore } from '../game/lobby/lobby.store.ts';
import { backAction, headerBack } from './header-back.ts';
import { HEADER_CONTROL_PT, fitToHeaderSlot } from './header-metrics.ts';
import { shellChromeVisible } from './shell-destinations';

/** Whether the shell's chrome shows, and whether that chrome includes the header (rail hardware only). */
export function useShellChrome(): { chrome: boolean; rail: boolean; header: boolean } {
  const placement = useAdaptiveNavigationPlacement();
  const pathname = usePathname() ?? '/';
  const immersive = useHomeStageStore((s) => s.immersive);
  const inCity = useStore(lobbyStore, (s) => s.phase !== 'lobby') && pathname.startsWith('/game');
  const chrome = shellChromeVisible(pathname) && !immersive && !inCity;
  return { chrome, rail: placement.rail, header: chrome && placement.rail };
}

/** The current route's Back (label and press), or null on a primary tab or a full-window route. */
export function useRouteBack(): { label: string | undefined; onPress: () => void } | null {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const back = headerBack(pathname);
  if (back === null) return null;
  return {
    label: back.label,
    onPress: () => {
      // Read the stack again at press time; it may have changed since render.
      const action = backAction(back, router.canGoBack());
      if (action.kind === 'pop') router.back();
      else router.replace(action.href as never);
    },
  };
}

/**
 * The header's Back tile, or null. RootShell hands it to the app header.
 * The header is one fixed height on every route, so the kit tile (64 pt from
 * md) is drawn in the bar's 44 pt control slot, scaled down to fit. Touches
 * follow the transform, so the target is the full 44 pt slot. It stays
 * invisible for the one frame before its size is known.
 */
export function HeaderBackButton() {
  const back = useRouteBack();
  const tile = useInstanceStore(() => ({ size: 0 }));
  const size = useStore(tile, (s) => s.size);
  if (back === null) return null;
  return (
    <View testID="header-back" style={{ width: HEADER_CONTROL_PT, height: HEADER_CONTROL_PT }} className="items-center justify-center">
      <View
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          tile.setState({ size: Math.max(width, height) });
        }}
        style={{ opacity: size === 0 ? 0 : 1, transform: [{ scale: fitToHeaderSlot(size) }] }}
      >
        <BackButton label={back.label} onPress={back.onPress} />
      </View>
    </View>
  );
}

/**
 * A screen's in-content Back, top-left under the safe area, for when the shell
 * draws no header. Renders nothing when the header carries Back instead.
 */
export function ScreenBack({ testID }: { testID: string }) {
  const { header } = useShellChrome();
  const back = useRouteBack();
  if (header || back === null) return null;
  return (
    <View testID={testID} className="flex-row px-4 pt-4">
      <BackButton label={back.label} onPress={back.onPress} />
    </View>
  );
}
