'use client';
// The app's one navigation shell, around the root stack. Drawn exactly once,
// so rotating, folding or moving between route groups never mounts a second
// rail: the header (rail hardware), the physical-right rail (rail hardware),
// the five-tab bar (phones) and the left drawer. Routes that own the whole
// window (onboarding, auth, legal, the immersive hatch, the city) hide the
// chrome; the routes themselves keep the same place in the tree either way.
// SOT-KEYWORDS: root shell single rail header drawer bottom bar rotation
import type { ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import { useAdaptiveNavigationPlacement } from '@acme/ui/adaptive-panes/parts';
import { View } from '@acme/ui/tw';
import { lobbyStore } from '../game/lobby/lobby.store.ts';
import { useHomeStageStore } from '../companion/home-stage.store';
import { ShellBottomBar, ShellDrawer, ShellRail } from './ShellNav';
import { activeDrawerItem, activeShellDestination, shellChromeVisible } from './shell-destinations';
import { useShellNavigate } from './use-shell-navigate';

export function RootShell({ children, header }: { children: ReactNode; /** The app header, on rail hardware only. */ header: ReactNode }) {
  const placement = useAdaptiveNavigationPlacement();
  const insets = useSafeAreaInsets();
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const navigate = useShellNavigate();
  const immersive = useHomeStageStore((s) => s.immersive);
  const inCity = useStore(lobbyStore, (s) => s.phase !== 'lobby') && pathname.startsWith('/game');
  const chrome = shellChromeVisible(pathname) && !immersive && !inCity;
  const active = activeShellDestination(pathname);

  return (
    <View className="flex-1 bg-bg">
      {chrome && placement.rail ? header : null}
      <View className={`min-h-0 flex-1 ${I18nManager.isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <View className="relative min-w-0 flex-1">{children}</View>
        {chrome && placement.rail ? (
          <ShellRail active={active} insets={{ bottom: insets.bottom, right: insets.right }} onSelect={navigate} />
        ) : null}
      </View>
      {chrome && !placement.rail ? <ShellBottomBar active={active} onSelect={navigate} bottomInset={insets.bottom} /> : null}
      {chrome ? (
        <ShellDrawer
          insets={{ top: insets.top, bottom: insets.bottom, left: insets.left }}
          active={activeDrawerItem(pathname)}
          onSelect={(href) => router.push(href as never)}
        />
      ) : null}
    </View>
  );
}
