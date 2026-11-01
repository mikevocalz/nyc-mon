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

// Opt-in worklet render runtime (docs/implementation/worklet-rendering.md):
// react-native-worklets Bundle Mode gives worklet runtimes the whole bundle,
// so three.js can load on the render runtime. Must match babel.config.js.
// Unset, the config is untouched. It wraps Expo's resolver (the vendored
// navigation above keeps working), forces inlineRequires on and turns off
// lazy bundling (below).
const workletRender = /^(1|true|worklet)$/i.test((process.env.EXPO_PUBLIC_WORKLET_RENDER ?? "").trim());
if (workletRender) {
  const workletsDir = path.dirname(
    require.resolve("react-native-worklets/package.json", { paths: [__dirname] }),
  );
  const { getBundleModeMetroConfig } = require(path.join(workletsDir, "bundleMode"));
  getBundleModeMetroConfig(config);

  // Worklet runtimes evaluate the bundle the app downloaded and nothing else.
  // With Expo's default `lazy=true`, an `import()` target is a separate chunk
  // that only the RN runtime fetches, so worklets defined there (the render
  // host, loaded by render-thread-choice.ts) are missing on the runtime:
  // "Unable to resolve worklet with hash …" (software-mansion/react-native-
  // reanimated#10162; lazy chunks on worklet runtimes are upstream PR #10711,
  // unmerged). Serve eager bundles instead, so every async dependency is in the
  // one bundle both runtimes load. Rewriting here also covers the URL the dev
  // client already holds and the HMR server, which applies the same rewrite.
  const rewriteExpoRequestUrl = config.server.rewriteRequestUrl;
  config.server.rewriteRequestUrl = (url) => {
    const rewritten = rewriteExpoRequestUrl ? rewriteExpoRequestUrl(url) : url;
    return rewritten.replace(/([?&])lazy=true(?=&|#|$)/, "$1lazy=false");
  };
}

// Uniwind remains the outermost Metro wrapper.
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
  polyfills: {
    rem: 14,
  },
});
