# Caller proxy

Stage 2 of `MOBILE_WORLD_PR_PACK.md` ("visible city scene + camera + Caller proxy"). The stick and the six caps now drive the Caller, the player's character (GAMEPLAY_BIBLE_V12: "The user/player is the Caller"). The camera follows behind. Before this, both moved the map.

## What the proxy is

A figure built from three.js primitives, about 1.8 m tall: capsule torso, limbs and sphere head, a dark visor so the facing reads from behind, and a carolina ring on the ground so the Caller is findable from 30 m. The head and hands are grey mannequin, the jacket royal and the trousers ink. The proxy claims no skin tone, face or outfit, because the canon has not given the Caller one. The only canon prop is an H-Lynk Core on the left wrist: red body (`palette.apple[600]`, DECISIONS 16), black scanner head, red LED (DECISIONS 7). Every colour comes from `@acme/theme`.

- Source: `packages/app/features/game/character/caller-proxy.ts`
- Asset size: 0 bytes. No file, no licence. About 14 draw calls.
- Animation is procedural. Limb swing is a function of metres walked (`stride`), so it matches ground speed at any frame rate. An idle Caller holds still and asks for no frames, which keeps the on-demand canvas idle.

Decision: BUILD primitives, DEFER a baked CC0 rig (Quaternius Ultimate Animated Character Pack or Universal Animation Library). Baking a skinned mesh and its clips into a TS module costs a few hundred KB, and SkinnedMesh on react-native-webgpu is unverified. Mike's own `.glb` models replace the proxy anyway (`docs/plans/quest-presence.md`). When they land, `createCallerProxyWith` keeps its signature and only the body of the factory changes.

## Controls

| Input | Action |
|---|---|
| Stick, under 0.6 deflection | Walk, speed scaled by deflection up to 1.6 m/s |
| Stick, 0.6 and over | Run, 4.2 m/s |
| Stick direction | Relative to the camera: up walks away from it, right walks to the screen's right. The figure turns toward it at 10 rad/s |
| A | Jump. About 0.5 m, 0.65 s in the air. No double jump |
| B (hold) | Run at any deflection |
| C | Interact. Says "Nothing to interact with here" until interactables exist |
| X | Recentre the camera behind the Caller |
| Y | Step the chase distance: 30, 50, 90 m, then back to 30 |
| Z (hold) | Look around: the stick orbits the camera and the Caller stands still |
| Pinch, twist | Still zoom and orbit, now around the Caller |

The canon defines no Caller verbs. The bible's combat law covers battles, which do not exist in the world yet, and directive §2B forbids inventing mechanics. Every cap above is movement or camera handling with no rule attached: no cooldown, no stamina, no damage. Each one needs Mike's confirmation:

- Decision: A = jump. BUILD, pending Mike.
- Decision: B = hold to run. BUILD, pending Mike. It duplicates a full push on purpose, for players who cannot hold the stick at the rim.
- Decision: C = interact as an honest no-op. BUILD, pending Mike. A cap that does nothing silently is a dead button.
- Decision: X = recentre, Y = zoom cycle, Z = look around. BUILD, pending Mike.

Collision uses `isWalkable(x, z)`: a blocked move slides along whichever axis stays clear, and long frames are split into 0.25 m steps so a fast frame cannot pass through a thin wall. The Caller spawns on the walkable point nearest the camera's look-at. For a new game that is the dataset origin, the Apollo, so the Caller starts on the pavement nearest it.

## Chase camera

The camera's look-at eases onto the Caller (`CHASE_FOLLOW_RATE`, 1/8 s time constant). While the Caller walks away from the camera, the yaw swings behind them in proportion to speed. A sideways or backward push leaves the yaw alone, so strafing walks a straight line instead of a circle.

Reduced motion is a separate variant, not a slowed copy: the look-at snaps to the Caller every frame, the yaw never turns on its own, and recentre lands in one frame.

The chase distances start at 30 m because `moveCityCamera` and `createCityScene` both clamp there. A 1.8 m figure at 30 m fills about 5% of the screen height. The world lane owns the scene's clamp; once it drops to about 8 m with a lower pitch, `CHASE_DISTANCES` moves in with it.

## Input path

The router contract is unchanged. `use-game-input.ts` keeps the held controls in a closure. A requestAnimationFrame loop runs `stepGameFrame` (pure, `character/caller-controller.ts`) only while something moves: the stick is down, a jump is in the air, the camera is catching up, or a recentre is swinging. It writes `callerStore` and `gameCameraStore`. No React component subscribes per frame. Only a playing session moves the Caller.

A binding that names a `CameraCommand` still works the old way, so a custom camera map needs no code.

## World seam

`character/world-queries.ts` is the one import the Caller reads the world through. Until `packages/app/features/game/world/` exports `isWalkable` and `cityGroundHeight`, it binds a stand-in (`walkability.ts`): building footprints from the bundled tile plus a 0.3 m body radius are blocked, ground is flat at y = 0, and the Caller stops 60 m past the mapped area. Switching is a one-line re-export in `world-queries.ts`, then delete `walkability.ts` and its test.

## Persistence

Nothing new persists. `callerStore` exposes `selectCallerTransform` (x, z, heading, or null before spawn).

A resumed game already brings the Caller back. The ADR 0020 save stores the camera's look-at as the player position, and the chase keeps the look-at on the Caller, so spawning at the restored look-at puts the Caller where they stood. The facing is lost: the Caller respawns facing away from the camera.

Follow-up for ADR 0020: add the Caller transform to the world save, take `position` from `selectCallerTransform` instead of the camera, and store the Caller's own heading in `headingRadians`. Persisting the camera to MMKV (`GAME_SCREEN_PLAN.md`, deferred "until the Caller proxy exists") can then be decided against a real position.

## Open items

- The one-finger drag still pans the camera (`use-city-camera-gestures.ts`), and the chase pulls it back to the Caller. It should orbit the yaw while a Caller exists.
- The world view's accessibility actions in `GameScreen.tsx` still pan the camera. The stick's step actions (`CALLER_STEP_ACTIONS`) step the Caller instead.
- G01 copy deck rows for the new spoken labels, the step actions and the interact line are proposed to lane A, not written.
