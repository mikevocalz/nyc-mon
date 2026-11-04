# Valdrada source restoration

Status: production assets generated; device verification has exposed an unresolved startup memory failure. PR171 remains draft pending fixes and acceptance.

## Source and assets

The source is Valdrada commit `2724c7938f20e068748ad1fd66e907d2bc662e3e` (MIT), with dataset revision `09b583662e760b5976d636d341d0e5f81a7c7fcf` (ODbL 1.0). The isolated baker follows the committed source lock: Three 0.185.1 and earcut 3.2.3. The older earcut 3.0.2 capture is historical; its triangle hashes must not authenticate the current output. Runtime Three remains 0.187.0 with the existing project patch extended.

The VDN3 path preserves authored UVs, material identities, vertex channels, source frames and shader contracts. It keeps full texture dimensions, channels, original PBR mipmaps and sampler metadata. Gzip changes storage only. The original PBR Basis payloads become native ASTC. Scene-owned page leases, eviction and complete-cohort admission bound residency; a complete city bank is not a residency budget.

Persistent generation inputs, checkpoints and outputs live under `apps/mobile/.expo/game-assets/`. They are ignored generated data. Temporary files were lost during an environment restart, so completion must refer to the current persistent generation status rather than old `/tmp` paths.

`write-surface-assets.mjs` publishes static Metro references after authenticating the supplied files. Its material and geometry admission limits are explicit inputs. It does not choose a limit from the entire bank's byte count. The completed production entry is now connected to the normal game loader. Final acceptance remains required.

The generated output contains 1,695 family packs, 7,454,830 triangles and 410 texture pages. Registry SHA-256: `6cdd3005714c14c600d2bcac911e44b5dce428e764674a4b098a99e2ed7695f8`. Complete-cohort admission allows 384 MiB of material resources and 160 MiB of geometry, at most 128 family draws and 1,100,000 triangles. The geometry allowance includes a separate legacy reserve of 24 MiB, 12 draws and 350,000 triangles; each device retains its smaller existing legacy quota. The largest single source cohort requires 340,824,953 material bytes, 105,013,480 geometry bytes, 90 draws and 663,638 triangles. These are logical resource limits, not measured device headroom or frame-rate claims.

## Appearance ownership

`world/source-look.ts` composes the source's final presets, saved graphics settings and weather. The existing preset IDs and native sun's two shadow cascades remain. Separate warm bounce, actual SH probe delivery, sky ambient and horizon uniforms share this owner.

`world/source-sky.ts` owns the analytic visible sky and separate environment bake. `world/source-light-probe.ts` stages real cube faces after the main frame and bounds readback ownership. Source shaders receive the resulting environment values; a PMREM alone must not be reported as an SH probe.

The physical post graph applies source height haze before HDR bloom and exposure. It performs one AgX/output conversion, then the source display grade and authored teal/orange LUT. The LUT bytes follow the source LUTCubeLoader's unsigned-byte conversion; its original and converted hashes are embedded with its provenance. The exposure meter excludes sky through depth, reads only 32×32 pixels and permits one pending readback. Failed readback is reported and is not exposure-verification evidence.

The native pavement is flat. Atmospheric height uses the closest authored building's source pavement datum, independently of visible LOD. This is an explicit scene-frame adaptation; it does not restore the original terrain.

Scene destruction closes compilation first, then drains pending post/probe readbacks before renderer destruction. Static template preparation uses the live MRT, shadow targets and probe target rather than placeholder textures or a separate renderer.

## Skill and tool use

The repository versions in `skills/README.md` take precedence. Applied guidance includes `three-best-practices`, the ten `threejs-skills` topics, the installed performance/scene/GLTF/game-feel/camera skills, and the Blender director, asset optimization and export pipeline skills. React Three Fiber patterns are excluded. Relevant RN/native and foldable ownership rules remain in force; no app window, orientation or right-rail redesign is part of this work.

Game Development Studio's installed skill bundle is 1.0.2. At the owner's explicit request, the separate CLI 1.5.1 was installed from the publisher's checksum-verified GitHub release into `~/.local/share/GameDevelopmentStudio/cli`; launchers are in `~/.local/bin`. This did not upgrade the project skill pin or app dependencies. Its game capture/performance workflows have not run during the deferred-verification phase.

Blender MCP uses the protocol-matched existing addon and a reviewed server revision, without upgrading the addon. The dedicated source-authoring `.blend` and operation provenance are in `.expo/game-assets/blender-authoring/`; the original user scene is preserved. Custom game shaders remain source contracts in that file, not a claim that Blender reproduces TSL.

Argent's CLI is installed, but physical iPads are outside its device support. The attached iPad is available through the installed device tooling. Hardware results must be distinguished from browser, recording-backend and static checks. CodeRabbit is the independent PR-review workflow; a previous review is not approval of later edits.

## Verification checkpoint, 2026-11-02

The first broad run passed 1,250 of 1,281 tests. After fixing JSON module attributes, scene cleanup, rig expectations and generated storefront-index freshness, the failed-file recheck passed 105 tests and left eight failures. Later focused runs also passed startup sequencing and the rig checks. Remaining resource/counter failures are not waived by raising their budgets.

The shared render-runtime startup now awaits the asynchronous city preparation and disposes a result that arrives after cancellation. Its focused startup test passes. The offline suite passes all 57 tests. TypeScript passes for `packages/app` at this checkpoint.

CodeRabbit completed two 22-file runtime/material groups with zero issues and two offline groups with five issues total. Those issues concerned resource settling, atomic payload publication and path resolution; they were corrected. A further group was rejected by the service's review quota. This is partial independent review, not approval of the entire final change.

The production asset build installed and launched on the physical iPad. A first game launch passed 9% but later hung during preparation, with Metal compiler connection errors in device logs. An isolated diagnostic entry now records real startup, device features and console events to `.expo/game-verification/native-telemetry.ndjson`. It injects no pilot assets or camera fixture. This entry must not replace the production entry in the final shipped build.

Agent Device's newly built XCTest helper was blocked by Apple signing/profile and license-agreement errors. The existing signed WebDriverAgent on the attached iPad works through go-ios, with its USB tunnel and W3C touch actions. Actual game acceptance, moving-memory/cadence checks and merge remain pending.

The diagnostic native run reached complete source cohorts and then iPadOS killed PID 22732 at its ActiveHard limit of 2,867 MB (2,939,956 KB reported). The exact termination is recorded in `native-render-failure.log`. This is a measured per-process memory failure, not a JavaScript exception. Xctrace attachment attempts failed to identify the process; they provide no memory measurement.

The next candidate releases immutable source-page CPU bytes only in the renderer's real texture-upload callback, retaining dimensions and mip descriptors and leaving the texture version unchanged. Tests exercise both the callback and a real recording-renderer upload followed by a second frame with no texture rewrite. A separate compile-context fix restores the canvas/MRT before visible frames while asynchronous compilation is pending. The combined targeted run passes 18 tests. Device acceptance is still pending; the diagnostic candidate also enables the existing opt-in uploaded-geometry release for evaluation.

A read-only DVT Sysmontap monitor now connects through the existing go-ios userspace USB tunnel. `ipad-memory.ndjson` records the app rising from roughly 666 MB in the lobby to 2.82 GB before termination, during preparation and before a first game frame. Host recording-backend preparation retained about 46 MB of JavaScript heap and 210 MB of ArrayBuffers; this is not a native GPU measurement. The next diagnostic candidate submits pending precompile uploads every four completed render objects and waits for queue completion between stages. Seven focused compilation tests and the app typecheck pass. Device impact remains unverified; this is a hypothesis under test, not a resolved memory issue.

The upload-drain experiment failed on the physical iPad: PID 23449 was killed at the same ActiveHard 2,867 MB limit after about 114 seconds of startup. Evidence is in `upload-drain-memory.ndjson`, `upload-drain-native.log` and the telemetry stream. The experimental queue-barrier code was removed. The next diagnostic entry samples the installed Hermes memory-stat API; its availability and result remain to be verified.

Hermes diagnostic samples near failure report roughly 871 MB allocated and 1.65 GB external memory hints. These hints include native resources and are not precise GPU measurements. A complete host preparation heap snapshot identifies 170 retained shader builders, approximately 580,000 NodeData objects, and build-only caches reachable through shader callback closures. Releasing completed render-builder scratch after capturing NodeBuilderState reduces the host collected heap from about 540 MB to 330 MB; shader count remains 226. The candidate updates the existing Three 0.187.0 patch, including both distribution builds and source; it does not upgrade Three. Patch SHA256 is `b666a5c0d42a07515073685d0bc174228e043c3eed3754164816e3086e11b8b2`. Ten focused compilation/render/shadow/source tests and a dedicated uniform-update/rebuild regression pass. Native acceptance remains pending.

The first shader-scratch candidate returned to the iPad home screen without a first game frame (`builder-scratch-current.png`); its exact termination report has not yet been captured. Further host inspection identified build-only hash and flow graphs. Releasing those after capturing render state reduces collected host heap to about 286 MB. A geometry-only post-precompile release also frees 54,261,060 CPU bytes in the host preparation, without dropping texture pixels or changing shader count. Ten focused checks pass, including first-draw buffer reuse and late shadows. The current patch SHA is `ff069a50eb2bcac5325eca88ebc57732962917ce1999582e06ce00c010c99ce3`; app typecheck passes. Native verification of this next candidate remains pending.

The owner confirmed the locally updated Viro fork should be 3.0.3. NYC-MON now vendors `3.0.3-moyo.1` from clean local commit `98babbc1dc8b4e1357a6ab9283691025b2a3413c`, packed with lifecycle scripts disabled. Its native binary hashes and copied paths are recorded in the versioned vendor SOURCE file. The prior 3.0.2 binary-restoration experiment was discarded. The catalog, build-script policy, lockfile and Android build patch now target 3.0.3; the native fork guard verifies the exact pinned version and required capabilities. The archive/binary integrity check passes. Native prebuild/build and device acceptance remain in progress.

The refreshed final asset registry is `6cdd3005714c14c600d2bcac911e44b5dce428e764674a4b098a99e2ed7695f8`: 410 pages and 1,695 family cells, preserving 7,454,830 triangles and 175 authored structures. Fourteen focused startup/compiler/CPU-release checks pass. The Viro 3.0.3 native app builds successfully with the tighter Hermes factory. Xcode automatic signing is currently blocked by Apple’s “PLA Update available” response; existing profiles lack the configured App Groups and Sign in with Apple entitlements. The owner has been asked to review the agreement in their developer account. No new native first-frame acceptance or merge has occurred.
