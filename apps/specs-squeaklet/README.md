# NYC-MON: Squeaklet on Specs

**Hackathon branch: mikevocalz/nyc-mon#specs. DO NOT MERGE INTO main.**
A 2026 Specs hackathon experimental Lens experience using the real NYC-MON Squeaklet/Metro Egg assets and authenticated care service. Isolated from Expo mobile, web and production backend.

## Implemented in this branch
- 15-second six-beat hatch reveal: stir 2.2s, pressure 1.7s, crack 3.5s, burst 0.8s, emerge 3.3s, attention/first look 3.5s. Server confirms the one Mon before animation. Skip after two seconds; reduced-motion keeps the full time.
- Original Squeaklet dex-002 rig source is https://admin.nyc-mon.city/v1/mon-models/glb/dex-002. Its rig clips are jaw_chomp, mouth_close, rat_run, tail_swish, blink. Metro Egg must be imported too.
- ViroSpecsSceneControllerHost protocol-2 scene: 3D Squeaklet or egg, hand-pinched Hatch, Feed, Play, Rest/Wake, Talk, and Skip controls. Three Rive-export image IDs show Energy, Fullness and Social; precise percentages render as native Lens Text.
- Specs ASR final transcripts to HTTPS gateway. Gateway forwards verified Caller token to the existing NYC-MON MCP for all care writes and speech/status. A server-only chat model can answer context-aware conversations. Voice mode hackathon-chat permits Baby babble only during the first 30 seconds after the authoritative hatch timestamp; from second 30 onward, Squeaklet speaks conversationally. This demo-only exception leaves voiceMode canon and the main game's 24-hour Baby babble unchanged.
- Offline/error states never fabricate changes in meters or hatch confirmation. No WebView.

## Files
- src/specs.mjs: pure portable scene, care, speech and hatch logic.
- src/bridge.mjs: authenticated MCP, server-only chat.
- server.mjs: local loopback gateway (HTTPS proxy/production protections are not supplied).
- lens/SqueakletLensScene.ts: Lens protocol-2 scene.
- lens/SqueakletSpecsLens.ts: native Lens Viro host, actions, AsrModule and InternetModule. setPairedAccessToken and setSpeakPort expect trusted adapters.
- rive/GAUGES.md: asset export/registration contract.
- tests/specs.test.mjs: offline unit and contract tests.

## Integration with existing Specs Viro work
1. Checkout specs in NYC-MON. Open viro/examples/specs-platform-lab/lens on its maintained Specs integration branch, with Lens Studio 5.22+ SPECS 27 target.
2. Sync viro-external/packages/specs/lens into Assets/ViroSpecs/lens with upstream specs:sync. Copy both Lens TypeScript files from this app into Assets/ViroSpecsSqueaklet. Keep Lens sources independent of React Native.
3. On a scene object add ViroSpecsAssetRegistry and ViroSpecsSceneControllerHost; configure the latter with the registry reference. Add SqueakletSpecsLens, set sceneHostObject, internetModule and HTTPS gatewayUrl.
4. Download the same dex-002 GLB from the stable NYC-MON model endpoint and optimize/import as Lens ObjectPrefab. Registry model IDs: mon/squeaklet, mon/metro-egg. See rive/GAUGES.md for images.
5. Implement Auth Kit / phone pairing adapter; pass the real short-lived Caller OAuth token to setPairedAccessToken. No development bypass or stored secrets in Lens. Implement a Snap Remote Service Gateway TTS adapter via setSpeakPort to provide *audible* conversational responses; scene currently has only caption fallback without it. Rig jaw/blendshape sync still requires native integration.
6. Configure server variables NYCMON_MCP_URL (existing HTTPS /mcp), OPENAI_API_KEY (server only), optional SPECS_AI_MODEL, and run node apps/specs-squeaklet/server.mjs. This dev server binds to 127.0.0.1; put behind a secured, rate-limited HTTPS service with validated Origins/identity before real Specs use.
7. Run node --test tests/*.test.mjs. Run Lens Studio Preview and LEAF scene/hatch/voice tests, then physical Specs tests.

## Readiness
Branch, portable pet loop and 15s timeline code: present. A fully assembled, working Lens project: NOT VERIFIED. Actual Rive exports, imported GLB, verified device pairing, native TTS/rig mouth sync, LEAF and physical hardware: PENDING. This project does not change NYC-MON main.
