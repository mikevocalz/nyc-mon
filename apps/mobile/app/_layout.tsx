import { Stack, router, useNavigationContainerRef, useRootNavigationState, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { CommonActions, DarkTheme, DefaultTheme, ThemeProvider, type Theme } from "@react-navigation/native";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { withUniwind } from "uniwind";
import { AppQueryProvider, SafeAreaProvider, useProfile } from "@acme/app";
import { RootErrorBoundary } from "@acme/app/features/error/root-boundary.tsx";
import { hydrateMon } from "@acme/app/features/mon/mon.store.ts";
import { hydrateOnboarding } from "@acme/app/features/onboarding/onboarding.store.ts";
import { hydrateDevicePrefs } from "@acme/app/features/settings/device-prefs.store.ts";
import { useReadyNotificationRouting } from "@acme/app/features/onboarding/notify-hook.ts";
import { cleanRootStack, type StackLike } from "@acme/app/features/onboarding/root-stack.ts";
import { hydrateSync, startConnectivity } from "@acme/app/features/system/sync.store.ts";
import { RootShell } from "@acme/app/features/navigation/RootShell.tsx";
import { AppHeader } from "../components/AppHeader";
import { semantic } from "@acme/theme";
import { setThemePreference } from "@acme/theme/switch";
import { Toaster } from "@acme/ui";
import { NycMonSplash } from "../components/splash/NycMonSplash";
import "../global.css";

// className-capable gesture root (third-party component → withUniwind).
// Module scope, not render scope — withUniwind builds the wrapper eagerly.
//
// Uniwind's p-safe/m-safe/safe-* utilities are NOT wired: they need insets
// pushed in via a SafeAreaListener + Uniwind.updateInsets, and nothing in this
// repo uses them (the kit ships a SafeArea component instead). Add the listener
// here if those classes are ever adopted — docs.uniwind.dev/migration-from-nativewind.
const GestureRoot = withUniwind(GestureHandlerRootView);

// NYC Mon is dark-first: apply the stored preference (default 'dark') before
// the first frame instead of inheriting the OS appearance.
setThemePreference(useProfile.getState().theme);

// M01 boot reads these flags synchronously; hydrate before the first frame.
hydrateOnboarding();
hydrateMon();
// M21: the conflict log, then the app's one connectivity source (expo-network).
hydrateSync();
startConnectivity();
// M19: haptics, sound and forced reduced motion reach the kit before the first frame.
hydrateDevicePrefs();

// The navigator paints every screen's card. Left on its default theme it
// stays light (#F2F2F2) while the kit text follows the dark preference, so
// any screen without its own background (M04 age gate, M03 sign-up) drew
// white text on light grey. The card now uses the same semantic tokens.
function navTheme(base: Theme, scheme: "light" | "dark"): Theme {
  return {
    ...base,
    colors: {
      ...base.colors,
      background: semantic.bg[scheme],
      card: semantic.surface[scheme],
      text: semantic.text[scheme],
    },
  };
}
const NAV_THEME = { light: navTheme(DefaultTheme, "light"), dark: navTheme(DarkTheme, "dark") };

const hideNativeSplash = () => {
  void SplashScreen.hideAsync().catch(() => undefined);
};

const goHome = () => {
  // Web: a full load from "/" also drops whatever state broke the tree.
  const location = (globalThis as { location?: { assign: (url: string) => void } }).location;
  if (process.env.EXPO_OS === "web" && location !== undefined) location.assign("/");
  else router.replace("/");
};

/**
 * Root error boundary (expo-router). The router renders it in place of this
 * layout, so it must not rely on anything RootLayout provides: it brings its
 * own SafeAreaProvider and catches throws from the providers below as well
 * as from every screen without a closer boundary.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <RootErrorBoundary error={error} retry={retry} goHome={goHome} hideSplash={hideNativeSplash} />;
}

/**
 * Keeps the root stack to one copy of each session group, and none under a
 * signed-out entry (root-stack.ts). Runs after each navigation commit.
 */
function useRootStackHygiene() {
  const navigation = useNavigationContainerRef();
  const state = useRootNavigationState() as unknown as (StackLike & { type?: string }) | undefined;
  useEffect(() => {
    if (state === undefined || state.type !== "stack") return;
    const clean = cleanRootStack(state);
    if (clean === null) return;
    navigation.dispatch(CommonActions.reset({ ...state, index: clean.index, routes: clean.routes } as never));
  }, [state, navigation]);
}

export default function RootLayout() {
  const scheme = useColorScheme() === "light" ? "light" : "dark";
  // Hatch-ready notification tap → M12, cold start and warm (M12 B3).
  useReadyNotificationRouting();
  useRootStackHygiene();
  return (
    <GestureRoot className="flex-1">
      <StatusBar style="auto" />
      {/*
        Installs the native WindowInsetsAnimationCallback subscription on
        Android and handles edge-to-edge. RN's built-in KeyboardAvoidingView
        relies on LayoutAnimation and a late keyboardDidShow, so Android content
        snaps instead of tracking the keyboard curve; this gives both platforms
        the same animated keyboard-inset source.
      */}
      <KeyboardProvider>
        <SafeAreaProvider>
          <AppQueryProvider>
            <ThemeProvider value={NAV_THEME[scheme]}>
              {/*
                A stack, not a Slot: going from (drawer) (Game, Caller) back to
                (home) must find (home) still mounted, or its 3D stage rebuilds
                the renderer and reloads the Baby GLB. `dangerouslySingular`
                makes a navigate to either group move the existing copy to the
                top instead of mounting a second one. No animation: group
                changes are shell tab switches, not pushes.
              */}
              {/* One shell (header, rail, tab bar, drawer) around every route
                  group, so rotation and group changes never mount a second rail. */}
              <RootShell header={<AppHeader />}>
                <Stack screenOptions={{ headerShown: false, animation: "none" }}>
                  <Stack.Screen name="(home)" dangerouslySingular />
                  <Stack.Screen name="(drawer)" dangerouslySingular />
                </Stack>
              </RootShell>
            </ThemeProvider>
            {/* Global overlays are mounted once at the app root. The starter's
                booking/editor sheets went with the demo schedule route: nothing
                on mobile opens them any more. */}
            <Toaster />
            {/* Above everything until it fades; it hides the native splash itself. */}
            <NycMonSplash />
          </AppQueryProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureRoot>
  );
}
