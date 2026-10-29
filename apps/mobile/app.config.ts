import type { ExpoConfig } from 'expo/config';
import { loadProjectEnv } from '@expo/env';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brand } from '@acme/theme';

const appDir = dirname(fileURLToPath(import.meta.url));
loadProjectEnv(join(appDir, '../..'), { silent: true, force: true });

// SDK 58 always runs the New Architecture and dropped `newArchEnabled` from
// ExpoConfig, but @expo-pico/core's plugin still reads the key (and warns
// without it), so it stays, typed as an extension.
const config: ExpoConfig & { newArchEnabled: true } = {
  name: 'NYC-MON',
  slug: 'nyc-mon',
  // `nycmon` stays first: expo-linking builds the app's own URLs from it.
  // `com.nycmon.app` is the Google OAuth redirect scheme (M03,
  // packages/app/features/onboarding/social-sign-in.native.ts).
  scheme: ['nycmon', 'com.nycmon.app'],
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  // Root window background (expo-system-ui): brand night, so the gap between the
  // system splash and the first JS frame is never black.
  backgroundColor: brand.night,
  ios: {
    bundleIdentifier: 'com.nycmon.app',
    supportsTablet: true,
    // Sign in with Apple entitlement (M03). The App ID needs the capability too.
    usesAppleSignIn: true,
    infoPlist: {
      // Profiles the app handles. Every supported pad (Xbox, DualShock 4, DualSense,
      // Switch Pro, Joy-Con pair, MFi) presents ExtendedGamepad; DirectionalGamepad
      // covers d-pad-only MFi remotes. No MicroGamepad: the Siri Remote is not a game controller here.
      GCSupportedGameControllers: [{ ProfileName: 'ExtendedGamepad' }, { ProfileName: 'DirectionalGamepad' }],
      // false: the pad drives gameplay, not UIKit focus. true would let Start/A move and
      // activate focus in the React Native view tree.
      GCSupportsControllerUserInteraction: false,
      // ProMotion: without this key Core Animation clamps the app's frame
      // interval at 1/60 s, so CADisplayLink-driven content can never reach
      // 120 Hz on ProMotion iPhones. The system still picks the actual rate.
      CADisableMinimumFrameDurationOnPhone: true,
    },
  },
  android: {
    package: 'com.nycmon.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: brand.night,
    },
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    // First in the list so it runs after expo-horizon-core, whose manifest
    // plugin rebuilds `uses-feature` (docs/implementation/hardware-input.md §5).
    './plugins/with-optional-gamepad',
    // Keeps rnskia_getWGPUInstance linked on iOS so react-native-webgpu can share Skia's device (ADR 0026).
    './plugins/with-skia-wgpu-instance',
    // The Mon keychain: a WidgetKit extension plus the App Group it shares with
    // the app (canon Decision #36; targets/keychain-widget, modules/keychain-widget).
    './plugins/with-keychain-widget',
    'expo-router',
    // Quest and PICO run Android 12+; Skia v3 (Graphite) needs 26+, and Meta's
    // layout library and react-native-webgpu's AHardwareBuffer use need 29.
    ['expo-build-properties', { android: { minSdkVersion: 29 } }],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        // The NYC-MON seal on the brand night; the animated splash (components/splash) picks up from this frame.
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: brand.night,
        dark: { backgroundColor: brand.night },
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          '../../packages/assets/fonts/ArchivoBlack-Regular.ttf',
          '../../packages/assets/fonts/SpaceGrotesk-Variable.ttf',
        ],
      },
    ],
    'expo-image',
    'expo-apple-authentication',
    'expo-web-browser',
    [
      'expo-calendar',
      {
        calendarPermission:
          'Allow NYC-MON to sync Mon care reminders, play dates, and battles to your calendar.',
      },
    ],
    'expo-notifications',
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow NYC-MON to save Mon photos to your photo library.',
        cameraPermission: 'Allow NYC-MON to scan objects and place Mons in AR.',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Allow NYC-MON to hear you when you choose to speak to your Mon.',
        recordAudioAndroid: true,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Allow NYC-MON to find encounters while you explore.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    ['expo-sensors', { motionPermission: 'Allow NYC-MON to place AR objects with device motion.' }],
    'react-native-webgpu',
    // Adds the device flavors (mobile, quest) and the Quest manifest: VR
    // intent category, headtracking, hand tracking and supported devices.
    // Build with `pnpm --filter mobile android:quest` (questDebug).
    [
      'expo-horizon-core',
      {
        // Horizon OS opens a 2D app at phone size unless the activity names a
        // window size; 1280x800 is landscape 16:10, the same as the commented PICO
        // window below.
        defaultWidth: '1280dp',
        defaultHeight: '800dp',
        supportedDevices: 'quest2|questpro|quest3|quest3s',
        disableVrHeadtracking: false,
        allowBackup: false,
      },
    ],
    [
      '@reactvision/react-viro',
      {
        provider: 'reactvision',
        rvApiKey: process.env.EXPO_PUBLIC_REACTVISION_API_KEY,
        rvProjectId: process.env.EXPO_PUBLIC_REACTVISION_PROJECT_ID,
        rvEndpoint: process.env.EXPO_PUBLIC_REACTVISION_ENDPOINT,
        android: {
          // Add 'PICO' back together with the @expo-pico/core block below.
          xRMode: ['AR', 'QUEST'],
          questAppId:
            process.env.EXPO_PUBLIC_META_QUEST_APP_ID ??
            process.env.META_QUEST_APP_ID,
          metaSpatialLayout: true,
          metaSpatialLayoutBomVersion: '1.2026.0.0',
          metaVrGlassesCompatible: true,
          questArm64Only: true,
        },
      },
    ],
    // PICO: uncomment and set your PICO Developer Console app ID to add the pico flavor.
    // The 2D panel enters the district through enterImmersiveScene() (root
    // registered in index.js).
    // [
    //   '@expo-pico/core',
    //   {
    //     picoAppId: '1234567',
    //     buildVariant: 'pico',
    //     xrMode: 'pico-os5',
    //     appType: 'mr',
    //     targetProfile: 'auto',
    //     targetDevices: ['pico-4', 'pico-4-ultra'],
    //     spatialMode: 'windowed',
    //     defaultContainerMode: 'window-container',
    //     defaultWidth: '1280dp',
    //     defaultHeight: '800dp',
    //     handTracking: true,
    //     passthrough: true,
    //     sceneUnderstanding: false,
    //     highSamplingRateSensors: true,
    //     refreshRates: [72, 90],
    //     ndkAbiFilters: true,
    //     // Declares the system OpenXR runtime library Viro loads.
    //     openXrLoaderDeclaration: true,
    //     // Public Viro 3.0.2 puts PICO's origin at eye level, so the street
    //     // would sit at waist height. The overlay renderer moves it to the
    //     // floor and maps controller B to back.
    //     viroRendererOverlay: true,
    //     developerTools: true,
    //     enableEmulatorOptimizations: false,
    //     targetSdkVersion: 34,
    //   },
    // ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  runtimeVersion: { policy: 'appVersion' },
  newArchEnabled: true,
};

export default config;
