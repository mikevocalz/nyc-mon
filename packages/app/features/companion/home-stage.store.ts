'use client';

import { useId, useLayoutEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import type { CreatureFraming, CreaturePerformance, HLynkShellProps, HLynkStatus, ShellTrackpadProps, StillReaction } from '@acme/ui';

/**
 * The shell chrome a `/(home)` route asks for. The shell itself is mounted
 * once, in `/(home)/_layout.tsx`, so M11 → M12 → M09 → M13 never remounts the
 * shell or the creature (M12 continuity rule); each route only describes it.
 */
export interface HomeChrome {
  readonly status: HLynkStatus;
  readonly scheme: 'daylit' | 'night';
  readonly trackpad: ShellTrackpadProps;
  readonly keys?: HLynkShellProps['keys'];
  readonly statusRow?: ReactNode;
  readonly layout?: HLynkShellProps['layout'];
  readonly testIDPrefix: string;
  /** Whether the creature layer draws the Mon. False while the egg is still in its case. */
  readonly creature: boolean;
  readonly framing: CreatureFraming;
  readonly performance?: CreaturePerformance;
  /** A still reaction (tilt or lift); bump `key` to play it once. */
  readonly reaction?: { readonly kind: StillReaction; readonly key: number };
}

/** One route's contribution to the stage. */
export interface HomeStageEntry {
  /** Shell routes describe the chrome; bare routes (M17, M18, "Shell: none") leave it out. */
  readonly chrome?: HomeChrome;
  /** Drawn inside the H-Lynk screen, over the creature layer. */
  readonly screen?: ReactNode;
  /** Side panes on wide windows (`HLynkStage`). */
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
}

interface HomeStageState extends HomeStageEntry {
  readonly owner: string | null;
  /** True while a bare route is on top: the route draws full-window over the mounted shell. */
  readonly bare: boolean;
  readonly menuOpen: boolean;
}

const EMPTY: HomeStageState = {
  owner: null,
  bare: false,
  menuOpen: false,
  chrome: undefined,
  screen: undefined,
  leading: undefined,
  trailing: undefined,
};

/** Read by the layout's shell host; written only through {@linkcode useHomeStage}. */
export const useHomeStageStore = create<HomeStageState>()(() => EMPTY);

export function setHomeMenuOpen(open: boolean): void {
  useHomeStageStore.setState({ menuOpen: open });
}

/**
 * Publishes a route's chrome and in-screen content to the layout's shell host.
 * Call on every render of the route: the host re-renders, the route does not
 * (the host is a sibling of the router slot), so this never loops. Published
 * before paint, cleared on unmount only if this route still owns the stage.
 */
export function useHomeStage(entry: HomeStageEntry): void {
  const owner = useId();
  useLayoutEffect(() => {
    useHomeStageStore.setState({
      owner,
      bare: entry.chrome === undefined,
      chrome: entry.chrome ?? useHomeStageStore.getState().chrome,
      screen: entry.screen,
      leading: entry.leading,
      trailing: entry.trailing,
    });
  });
  useLayoutEffect(
    () => () => {
      if (useHomeStageStore.getState().owner === owner) {
        useHomeStageStore.setState({ owner: null, bare: false, screen: undefined, leading: undefined, trailing: undefined, menuOpen: false });
      }
    },
    [owner],
  );
}
