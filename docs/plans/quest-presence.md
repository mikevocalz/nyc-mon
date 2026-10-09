# Quest presence (PR C)

Draft. The last step of the spatial program: the Mon appears on a Quest 3 in the Caller's room, placed by the scene contract from PR A (#9). Validate on a physical Quest 3 using the `questDebug` flavor only.

## Already in place

- **Contract types and the mode resolver** (`resolveSceneMode`, ADR 0011) decide tabletop, room or flat from the runtime's capabilities and the accepted anchors. They never return `'street'`.
- **The approach trigger** (ADR 0012) and **`MonSceneInput`** (`docs/spatial/CONTRACT.md` § Scene input fields).
- **One Mon store** over the MMKV save, and empty model slots for Mike's glb files.
- **Horizon layout guards:** `docs/spatial/HORIZON-LAYOUT.md`, the `xrTypeRamp` and `xrTargets` tokens, and `tooling/verify-spatial-android.mjs`.

## Blockers

1. **Scene anchors aren't wired in the virocore fork's Quest path.** The resolver needs a floor, table and wall pose from `XR_FB_scene` or `XR_META_spatial_entity` and LOCAL_FLOOR. That native work belongs to the `viro-meta-vr-glasses-input` session, which sequences virocore. Send it a spec built from `docs/spatial/CONTRACT.md` § Scene input fields: what `anchors` must contain, the `Pose` shape, and the staleness rule.
2. ~~nitro-canvas~~ Resolved: the `quest` script's `assert-viro-fork.mjs` no longer requires `nitro-canvas-in-Vision`. That check guarded the starter's `SpatialRivePanel`, which only the web `/spatial` page imports, so the headset build never used it. The fork check passes on 3.0.2-moyo.1.
3. **No Mon models yet.** Mike supplies the glb files; until then the slots render nothing, or a placeholder Mike approves.

## Layout system: reuse Harlem Might's

NYC-MON's headset windows and panels follow the system Harlem Might already runs on Horizon OS, not a new one:

- `@viro-external/{core,ui,meta-layout,xr-contract,media}`, from the sibling `~/viro-external` repo (workspace surface resolver merged in viro-external #57).
- Harlem Might's ADRs in `~/Harlem-Might/docs/spatial-layout/adr/`:
  - 0001: `@expo-pico/core`'s `metaLayoutSdk: true` owns the Meta layout SDK setup; Viro's `metaSpatialLayout` stays false.
  - 0002: talk to Meta's packages directly through one facade (`metaWindows.ts`, from expo-pico's `createMetaWindows`), one `SpatialSceneProvider`.
  - 0003: how the Viro fork and `@viro-external` are linked for mobile, and the Metro watch folders.
  - 0005: the rail window and `SpatialWindowHost`, including the measured 160dp outward-window gap on Horizon OS 207.
- `~/Harlem-Might/docs/spatial-layout/HANDOFF.md` and `docs/SPATIAL.md` for the window sizes and Back handling.

Decision needed: how nyc-mon takes `@viro-external`. Harlem Might links sibling folders (`link:../../../viro-external/...`), which keeps mobile out of CI until the viro-external branch merges. A pinned GitHub tarball would keep CI green but needs a release in viro-external.

## Steps

- [ ] Send the scene-anchor spec to the virocore session and agree on the API surface.
- [ ] Add `@viro-external` the way chosen above, port the `metaWindows` facade and `SpatialWindowHost`, and size the main window per Harlem Might's measurements.
- [ ] Feed the runtime's capabilities and anchors into `resolveSceneMode` on Quest.
- [ ] Render the Mon through Viro in the resolved mode, with H-Lynk on the wrist or hand.
- [ ] Wire the approach trigger to the Mon's behaviour.
- [ ] Device run on a physical Quest 3 (`questDebug`), following the Horizon layout rules. Uninstall the old build first.
