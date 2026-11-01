# 0022 — The vd lane: Valdrada's street look ported to TSL

- **Status:** Accepted (Mike, 2026-10-18), device tuning open
- **Date:** 2026-10-18
- **Deciders:** Mike
- **Overrides:** `docs/plans/harlem-v3-valdrada-prompt.md` §1 "Rejected on sight" (importing Valdrada's GLSL materials) and §3 out-of-scope (Valdrada's renderer and materials). Mike, after seeing the toon lane on the Duo: "give me valdrada", then "port it to what we use, wweather thats shaders etc" (read as weather and shaders; both are in scope)
- **Sources:** Valdrada v0.4.0, commit `2724c79`. Shader logic from `client/src/world/materials.js` (`makeFacadeMaterial`, `makeGroundMaterial`, `applySnowCap`, the wet-ground block, `HASH_GLSL` `pcov`) and `client/src/world/weather.js`. Textures from the Hugging Face dataset `mehmetkeremturkcan/valdrada`, revision `v0.4.0`, `Content/textures/`, CC0 1.0 per Valdrada `LICENSING.md`. Valdrada code is MIT (`tooling/city/valdrada/LICENSE.valdrada`).
- **Code:** `packages/app/features/game/world/vd-materials.ts`, `vd-weather.ts`, `vd-facades.ts`, `vd-textures.ts` (generated), `geometry.ts` (`aFacade`), `index.ts`, `tooling/city/bake-textures.mjs`

## Context

Dataset v3 gave the city Valdrada's records, but the city still rendered through the cel lane, and the toon lane (#56) pushed it further from the reference. Mike wants the Valdrada look. Its GLSL cannot run on WebGPU, so the look has to be rebuilt as TSL node materials.

## Decision

A new lane behind `EXPO_PUBLIC_WORLD_VD`, default off, in the same pattern as the PBR, glass and toon lanes. It builds on the PBR lane and replaces the masonry, road, sidewalk, roof and area materials.

**Build:**

| Valdrada | Port |
|---|---|
| Five wall photos, sample ÷ layer mean, luminance `pow(clamp(·, .55, 1.7), .42)`, chroma clamp ±16 % × .30, strength faded by `fwidth` | Same, as a `DataArrayTexture`; the photo also pulls the near wall toward its own colour at the building's brightness (`TUNE.photo`) |
| STYLE → photo table and tile sizes (2.4–3.4 m) | `vd-facades.ts`, with a class fallback for buildings that have no STYLE id |
| `t_brN` brick normal at `uv·0.42` | Same, in a wall frame built from screen derivatives |
| Window lattice with `pcov` box filtering and the `tiny` sub-pixel collapse | Same, on nyc-mon's window grid |
| 15 cm reveal by parallax, lintel shadow | Same |
| Glass reflection `skyLook · fresnel` | A two-colour sky from palette keys with Schlick fresnel |
| Night lit share | windows.ts `litShareAt`, so every lane lights the same rooms |
| Procedural brick and ashlar grid (0.3 m courses of 0.62 m bricks, half-offset; 0.66 m by 1.32 m stone) | Same, box-filtered, with per-brick tone drift. The 256 px photo alone loses its mortar lines past a few metres |
| Interior-mapped room | A ceiling-light falloff across the pane under the sky reflection; the furniture stays deferred |
| Street grime, the bottom 9 m | Same |
| Wet ground (noise damp, puddles, roughness to .32 / .06), damp masonry (−26 %, roughness .4) | Same |
| `applySnowCap` | Same, on roads, sidewalks, roofs and areas |
| Camera-wrapped rain and snow streaks | 6,000 streaks in a 60 × 30 × 60 m box, one draw call, hidden while the sky is clear |
| Sun 5 over hemisphere ≈ 0.6, plus env map, bounce light and SH probe | Sun 3.2 over hemisphere 2.6. With hemisphere 0.9 and no env, bounce or probe, shade walls rendered near-black on the Duo. TODO(tune) |
| Sidewalk flags | 1.524 m flags with joints and per-flag tone over the paving photo. The lane drops the cel lane's neon sidewalk grid and kerb light line |

**Defer**, each with its blocker:

- GTAO, SSR, SSGI and the haze pass: `post/pipeline.ts` is still device-pending because of the black-frame risk.
- Ray-marched room furniture and the fascia sign atlas: shader size on the Duo. Measure the lane's frame cost first.
- Hex tiling and ground parallax: the same.
- The city AO bake (`cityao.*`): ODbL, and it is keyed to Valdrada's tile grid, not ours.
- Photometric lamps: the city has no per-pixel lamp list. `lamp-viz.ts` pools stay.
- Clouds: the sky rig owns the dome.
- Wiring `clock.rain` into `setWeather`: the clock lives in the living-city sim host. `EXPO_PUBLIC_WORLD_WEATHER` and `world.setWeather` cover it until then.

**Strike:** MetaHuman pedestrians (licence), TAA, motion blur and bokeh.

**Textures ship as data.** react-native-webgpu has no image decoder (the reason `bake-foliage.mjs` exists). `bake-textures.mjs` decodes the JPGs with macOS `sips` into 256 px RGB (colour) and XY (normal) layers, plus each layer's mean. The generated module is 2.5 MB of base64 in the JS bundle.

**Colour space.** The city feeds palette hex as linear and outputs linear (`city-scene.ts`), so texture bytes are used raw and reach the screen as the photo.

## Consequences

- One new 2-float vertex attribute, `aFacade`, on every `VertexBuffer` (8 bytes per vertex). The v2-identical-bytes test compares position, normal, colour and uv, which are unchanged. Draw calls on the vd lane are the base count plus one for precipitation.
- The JS bundle grows by about 2.5 MB whether or not the flag is on, since Metro bundles static imports. Sharper maps would need asset files plus a native decoder.
- Node tests compile the textured graphs by stubbing `backend.utils.getTextureSampleData` (`vd-materials.test.ts`).
- Device verification is separate: frames, frame time and mipmap generation for array textures on react-native-webgpu are recorded in `docs/DEVICE_CHECKS.md` once run.
