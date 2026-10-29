'use client';
// The app's one navigation shell, around the root stack. Drawn exactly once,
// so rotating, folding or moving between route groups never mounts a second
// rail: the header (rail hardware), the physical-right rail (rail hardware),
// the five-tab bar (phones) and the left drawer. Routes that own the whole
// window (onboarding, auth, legal, the immersive hatch, the city) hide the
// chrome; the routes themselves keep the same place in the tree either way.
// The header's left edge carries the kit BackButton on every route that is
// not a primary tab and has somewhere to go back to (header-back.ts).
// SOT-KEYWORDS: root shell single rail header drawer bottom bar rotation back
import type { ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from '@acme/ui/tw';
import { ShellBottomBar, ShellDrawer, ShellRail } from './ShellNav';
import { activeDrawerItem, activeShellDestination } from './shell-destinations';
import { HeaderBackButton, useShellChrome } from './use-header-back';
import { useShellNavigate } from './use-shell-navigate';

export function RootShell({
  children,
  header,
}: {
  children: ReactNode;
  /** The app header, on rail hardware only. `back` goes at its left edge: the kit BackButton, or nothing on a primary tab. */
  header: (back: ReactNode) => ReactNode;
}) {
  const { chrome, rail } = useShellChrome();
  const insets = useSafeAreaInsets();
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const navigate = useShellNavigate();
  const active = activeShellDestination(pathname);

  return (
    <View className="flex-1 bg-bg">
      {chrome && rail ? header(<HeaderBackButton />) : null}
      <View className={`min-h-0 flex-1 ${I18nManager.isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <View className="relative min-w-0 flex-1">{children}</View>
        {chrome && rail ? (
          <ShellRail active={active} insets={{ bottom: insets.bottom, right: insets.right }} onSelect={navigate} />
        ) : null}
      </View>
      {chrome && !rail ? <ShellBottomBar active={active} onSelect={navigate} bottomInset={insets.bottom} /> : null}
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
