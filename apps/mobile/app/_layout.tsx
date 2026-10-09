import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { withUniwind } from "uniwind";
import { AppQueryProvider, AttachSheet, AudioRecorderSheet, SafeAreaProvider, UrlSheet, useProfile } from "@acme/app";
import { hydrateMon } from "@acme/app/features/mon/mon.store.ts";
import { hydrateOnboarding } from "@acme/app/features/onboarding/onboarding.store.ts";
import { setThemePreference } from "@acme/theme/switch";
import { BookingSheet } from "../components/BookingSheet";
import { Toaster } from "@acme/ui";
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

export default function RootLayout() {
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
            <Slot />
            {/* Global overlays/sheets are mounted once at the app root. */}
            <BookingSheet />
            <AttachSheet />
            <AudioRecorderSheet />
            <UrlSheet />
            <Toaster />
          </AppQueryProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureRoot>
  );
}
