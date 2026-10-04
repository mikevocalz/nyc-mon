# NYC-MON spatial runtime

NYC-MON is a spatial-first Expo SDK 58 / Next starter with a deliberately layered renderer:

- **Tailwind 4 + Uniwind** for ordinary product UI on native.
- **React Native Skia 2.13** for universal GPU-drawn 2D scenes on iOS, Android and web.
- **Rive** for interactive animated UI surfaces.
- **Viro / OpenXR** for immersive 3D on Quest, Pico, web and supported native targets.

## Universal Skia graphics

`@acme/ui` includes three related procedural backgrounds:

- `GridFloor` — scrolling perspective floor.
- `GridScene` — mirrored ceiling + floor planes around a shared horizon.
- `GlyphCity` — deterministic neon city silhouettes, glyph-like vector cells, antenna lights and flying traffic.

The drawing implementations live in `*.skia.tsx` and are shared. Native imports them directly. Web wrappers only initialize CanvasKit and then load the same Skia component. There is no separate CSS/SVG rendering path.

CanvasKit is copied to `/canvaskit` for Next, Storybook and Expo web during postinstall by `tooling/copy-skia-web-assets.mjs`. `SkiaWebGate` caches that initialization so multiple backgrounds do not load CanvasKit repeatedly.

The default Grid composition intentionally layers:

1. `GridScene` as the full-screen floor/ceiling field.
2. `GlyphCity` as a transparent lower-horizon city layer.
3. Normal semantic application UI above both.

## Futuristic UI kit

The starter exports `CircuitButton` and `GridCard`. They are universal semantic controls styled through the existing Tailwind 4 / Uniwind boundary; Skia remains reserved for scene graphics.

Storybook contains **Spatial / Grid World** stories for:

- the complete Grid gateway composition;
- Grid Scene + Glyph City;
- Grid Floor;
- cyan/orange CircuitButton variants;
- futuristic GridCard variants.

## District scene

`DistrictScene` is the immersive scene. It builds the selected district (Downtown, Midtown, Harlem or Mega City) from solid Viro boxes around the viewer at street level: a night street plane, an orange avenue line, setback towers in the district's palette, lit window bands and crowns. The geometry is static and generated once per district.

The district lives in `useDistrictStore` (`packages/spatial/districtStore.ts`). The home screen's switcher and the immersive scene read the same store, so the district picked on the phone is the one the headset opens.

## Immersive routing

- **Quest** uses `ViroXRSceneNavigator`, which hands `DistrictScene` to the headset VR activity.
- **PICO** enters through expo-pico's `enterImmersiveScene()`. `apps/mobile/index.js` registers the immersive root with `registerImmersiveScene()` at module scope. Stock Viro sends PICO down its AR path, so PICO must not use the XR navigator.
- **iOS / ordinary Android** keep the scene in a `Viro3DSceneNavigator` preview.
- **Web** uses the Viro Web Renderer with the same scene.

## Meta Horizon and Meta VR Glasses

The current private Viro fork treats Meta immersive hardware as one **Meta Horizon/OpenXR runtime family** rather than assuming every Meta device is a Quest.

- `isMetaHorizonXR` owns immersive routing.
- `isKnownQuest` and reported model strings are diagnostics only.
- `metaVrGlassesCompatible: true` writes Meta's current `quest3+` Store delivery target while preserving the existing Quest compatibility metadata.
- `getOpenXRRuntimeCapabilities(viewTag)` reports negotiated gaze, hand tracking/aim, passthrough, plane detection, scene understanding, foveation, eye-tracked foveation and local-floor capabilities.
- Product behavior must feature-detect those runtime facts instead of branching on a headset model name.

The checked-in Android manifest mirrors the generated config-plugin result so bare/native builds and Expo prebuilds agree.

## System spatial windows

`ForkSpatialLayout` detects optional `ViroSpatialSceneProvider`, `ViroSpatialWindow` and layout-support exports from the mikevocalz Viro fork.

- Quest can use Meta Layout system windows when the fork is enabled.
- Pico uses the shared Viro/OpenXR scene and inline window fallback.
- Web uses the Viro browser renderer.

## Use the mikevocalz Viro fork

The Quest/PICO native development target is `mikevocalz/viro#decax9-three-panel`. Because this starter repository is public while that fork is private, the checked-in catalog keeps public `@reactvision/react-viro@3.0.2` only as an unauthenticated **web/Storybook/CI resolution fallback**. It is not an accepted native SDK-58 runtime.

Every native command now runs `apps/mobile/scripts/assert-viro-fork.mjs` first. If public Viro is installed, `dev`, `android`, `ios`, and `prebuild` fail before Expo starts. A native/headset build therefore cannot accidentally ship against the unsupported public 3.0.1 peer lane.

For native/headset development, enable the private fork so the Expo 58/RN 0.88 peer lane, PICO routing, OpenXR bridge, spatial windows and native Viro/Rive surface are present:

```yaml
overrides:
  "@reactvision/react-viro": "github:mikevocalz/viro#decax9-three-panel"
```

Then run:

```bash
pnpm install
pnpm --filter mobile viro:assert-fork
pnpm spatial:prepare-web
pnpm skia:prepare-web
```

## Checked-in Android XR project

The Android project is committed and kept in sync with the fork's generated Quest/OpenXR contract. `pnpm spatial:verify-android` verifies Viro Gradle projects/dependencies, Meta Layout SDK dependencies, AR/Quest/PICO package registration, Quest permissions/features, `VRActivity`, arm64 targeting, target SDK ceiling, scheme and app branding. CI runs this before the monorepo build so generated native drift fails visibly.

## Quest + Meta Layout SDK

The Expo app declares `@metavr/layout-compat` and `@metavr/layout-window-compat` directly. The Viro plugin config enables AR, Quest and Pico, with Meta spatial layouts enabled for Quest and inline/Viro fallback elsewhere.

## Assets / Metro

`apps/mobile/metro.config.js` keeps Expo SDK 58's resolver and adds authored spatial formats including `.riv`, GLB/GLTF, OBJ/MTL/FBX, HDR/EXR, KTX/KTX2, splat data and WASM.

## Routes

- Next: `/spatial`
- Expo: drawer → **Spatial**

Both mount the same `SpatialScreen`.

## Design references

- NeonBlade Grid Scene: https://neonbladeui.neuronrush.com/components/backgrounds/grid-scene
- NeonBlade Glyph City: https://neonbladeui.neuronrush.com/components/backgrounds/glyph-city

These are references only. The Skia backgrounds, product UI and Viro scene are newly authored.

## Zustand-only spatial state

Application and session state in `packages/spatial` lives in Zustand stores. Do not introduce React `useState`. React refs are fine for renderer handles and timers.
