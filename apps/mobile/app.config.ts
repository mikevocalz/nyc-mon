import type { ExpoConfig } from 'expo/config';
import { loadProjectEnv } from '@expo/env';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palette } from '@acme/theme';

const appDir = dirname(fileURLToPath(import.meta.url));
loadProjectEnv(join(appDir, '../..'), { silent: true, force: true });

// SDK 58 always runs the New Architecture and dropped `newArchEnabled` from
// ExpoConfig, but @expo-pico/core's plugin still reads the key (and warns
// without it), so it stays, typed as an extension.
const config: ExpoConfig & { newArchEnabled: true } = {
  name: 'NYC-MON',
  slug: 'nyc-mon',
  scheme: 'nycmon',
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.nycmon.app',
    supportsTablet: true,
  },
  android: {
    package: 'com.nycmon.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: palette.ink[50],
    },
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    // Quest and PICO run Android 12+; Skia v3 (Graphite) needs 26+, and Meta's
    // layout library and react-native-webgpu's AHardwareBuffer use need 29.
    ['expo-build-properties', { android: { minSdkVersion: 29 } }],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: palette.ink[50],
        dark: { backgroundColor: palette.ink[50] },
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
    [
      'expo-calendar',
      {
        calendarPermission:
          'Allow NYC-MON to sync Mon care reminders, play dates, and battles to your calendar.',
      },
    ],
    'expo-notifications',
    'react-native-webgpu',
    // Adds the device flavors (mobile, quest) and the Quest manifest: VR
    // intent category, headtracking, hand tracking and supported devices.
    // Build with `pnpm --filter mobile android:quest` (questDebug).
    [
      'expo-horizon-core',
      {
        // Horizon OS opens a 2D app at phone size unless the activity names a
        // window size; 1280x800 is landscape 16:10, the same as the PICO window.
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
          xRMode: ['AR', 'QUEST', 'PICO'],
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
    // Adds the pico flavor: PICO OS 5 OpenXR runtime, VR launcher category on
    // VRActivity, manifest and SDK levels. The 2D panel enters the district
    // through enterImmersiveScene() (root registered in index.js).
    // Build with `pnpm --filter mobile android:pico` (picoDebug).
    [
      '@expo-pico/core',
      {
        // PICO's developer-portal app id. Without it PICO OS shows an
        // entitlement dialog and ends the process, so set PICO_APP_ID in
        // .env.local before a headset build. The empty-string fallback (as in
        // expo-pico's example) keeps R.string.pico_app_id defined; undefined
        // makes prebuild fail with "Missing element text".
        picoAppId: process.env.PICO_APP_ID ?? '',
        buildVariant: 'pico',
        xrMode: 'pico-os5',
        appType: 'mr',
        targetProfile: 'auto',
        targetDevices: ['pico-4', 'pico-4-ultra'],
        spatialMode: 'windowed',
        defaultContainerMode: 'window-container',
        defaultWidth: '1280dp',
        defaultHeight: '800dp',
        handTracking: true,
        passthrough: true,
        sceneUnderstanding: false,
        highSamplingRateSensors: true,
        refreshRates: [72, 90],
        ndkAbiFilters: true,
        // Declares the system OpenXR runtime library Viro loads.
        openXrLoaderDeclaration: true,
        // Public Viro 3.0.2 puts PICO's origin at eye level, so the street
        // would sit at waist height. The overlay renderer moves it to the
        // floor and maps controller B to back.
        viroRendererOverlay: true,
        developerTools: true,
        enableEmulatorOptimizations: false,
        targetSdkVersion: 34,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  runtimeVersion: { policy: 'appVersion' },
  newArchEnabled: true,
};

export default config;
