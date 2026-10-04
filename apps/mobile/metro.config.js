const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Binary / authored assets used by Rive, Viro/OpenXR, WebXR and spatial UI.
// Expo already handles common images/media. These extensions must remain
// assets (not source transforms) so native and web runtimes receive a URI.
const SPATIAL_ASSET_EXTS = [
  "riv",
  "glb", "gltf", "bin",
  "obj", "mtl", "fbx", "vrx",
  "hdr", "exr",
  "ktx", "ktx2",
  "arobject",
  "spz",
  "glxf",
  "uikitml",
  "wasm",
];

config.resolver.assetExts = Array.from(
  new Set([...config.resolver.assetExts, ...SPATIAL_ASSET_EXTS]),
);

/**
 * Solito must resolve the same React Navigation instance Expo Router mounts.
 * Keep Expo's resolver as the final fallback so SDK 58's package exports,
 * tsconfig aliases, web/server conditions and monorepo resolution stay intact.
 *
 * pnpm installs are isolated (each package lives under node_modules/.pnpm and
 * is symlinked into the workspace that declares it), so expo-router is never
 * at <root>/node_modules/expo-router. Resolve it from this app instead of
 * assuming a hoisted layout.
 */
const expoRouterDir = path.dirname(
  require.resolve("expo-router/package.json", { paths: [__dirname] }),
);
const VENDORED_NAVIGATION = {
  "@react-navigation/native": require.resolve(
    path.join(expoRouterDir, "build/react-navigation/native"),
  ),
  "@react-navigation/core": require.resolve(
    path.join(expoRouterDir, "build/react-navigation/core"),
  ),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const vendored = VENDORED_NAVIGATION[moduleName];
  if (vendored) {
    return { type: "sourceFile", filePath: vendored };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Uniwind remains the outermost Metro wrapper.
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
  polyfills: {
    rem: 14,
  },
});
