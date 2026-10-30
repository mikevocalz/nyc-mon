# City walk on the website (`/city/walk`)

Date: 2026-10-30. Owner request: "everything should be live!" The Valdrada city (rings 1-10, R2 release
`r20261030-c98106d6`) had no public route on nyc-mon.city.

## What the app preview gate covers, and why it stays shut

`apps/web/lib/app-preview.ts` (`NYCMON_APP_PREVIEW=1` at build time) gates six layouts:

| Route | What it is | Public? |
| --- | --- | --- |
| `/explore` | Template explore screen with demo people and counts ("Nina Alvarez", "1.2k Followers") | No: fabricated content |
| `/profile` | Template profile, demo data | No: fabricated content |
| `/settings` | Template settings screen | No: not an NYC-MON feature yet |
| `/schedule` | Template schedule, demo data | No: fabricated content |
| `/notifications` | Template notifications, demo data | No: fabricated content |
| `/sign-in` | M03 sign-in and create account (`?intent=`), lands on `/profile` | No: opens account creation on the public site and lands on a gated template |

None of them is the Game. Flipping the flag would publish demo people and an auth flow that ends on a 404-gated
template, and would still not show the city: nothing on the website imported `GameScreen` or `load-game-scene.ts`.
The flag stays as it is. The city gets its own route instead.

## Decision: BUILD a guest walk; DEFER the Caller on the web

- **BUILD `/city/walk`**, public, indexed, linked from the header, the footer and `/city`. It draws the Game world
  through the same `ThreeCanvas` + `loadGameScene` the app uses: the bundled Harlem tile, the vd-port block packs,
  the storefront plan, and the far tier and cells streamed from `EXPO_PUBLIC_VD_CELL_BASE`
  (`https://city-assets.nyc-mon.city/releases/r20261030-c98106d6`, baked in `apps/web/next.config.ts`). The data
  exists end to end and the read path is deployed, so this is the cheapest real win.
- **The walk is camera-only.** Keyboard (arrows/WASD, Q/E, +/-, R), pointer drag/pinch/twist, the wheel and an
  on-screen pad move `gameCameraStore`. No lobby, no session, no save, no Caller.
- **DEFER the Caller and the session on the web.** Blocker: identity. `readLobbyIdentity()` needs a stored Caller,
  the website has no account flow that can create one (sign-in is gated, see above), and `world-save.store.ts` has
  no web storage fork (its default keeps the world in memory only). A web Caller needs a decision on guest identity
  and an IndexedDB `WorldSaveStorage`; until then a START that can never start would be a dead button.
- **The native Game tab is unchanged.** `MOBILE_WORLD_PR_PACK.md` says "Web never gets full Game screen"; the walk
  is not the Game screen (no lobby, controller, Caller or save), so that rule still holds.

## Renderer: WebGL 2 on the website

The walk passes `forceWebGL` to `ThreeCanvas`. In Chrome's WebGPU the physical post chain's scene pass failed
validation ("[Texture "output"] usage (TextureBinding|RenderAttachment) includes writable usage and another usage in
the same synchronization scope"), the START compile never resolved and the load bar stopped at the compile stage. On
WebGL 2 the same scene loads in about 25 s on a cold cache and draws with no console errors, and WebGL 2 is in every
current browser. The WebGPU failure on the web is not fixed here; it is the reason for this choice.

## No "empty" state on the walk

`isOverMappedArea` measures against the bundled Harlem tile. The walk also draws Valdrada's streamed rings and far
tier, which cover everything inside the camera store's ±2000 m clamp, so the native "Nothing mapped here yet" banner
would be false on the website. The walk passes `overMappedArea: true`.

## Streamer fix found on the way

At 390 px the walk stopped with "vd-port: far file landmarks_l6.bin built before its bytes". The far tier's landmark
packages (and a far chunk's buildings and ground) decode off one shared file, and `release()`, which `build()` calls
right after upload, drops that file's bytes. Two siblings picked as ready in the same pass: the first build released
the bytes and the second threw. `cell-stream.ts` now checks `ready()` again before each build; a package whose bytes
went asks for them again and builds on a later frame. `cell-stream.test.ts` covers it (fails with the check removed).

## Storefront plan transfer

`plan.bin` (the storefront plan, JSON) is 37,285,665 bytes. The website loads `plan.bin.gz` instead
(`storefronts/plan-asset.web.ts`), gzip -9, decompressed in the browser with `DecompressionStream`
(`storefronts/load.ts`). Native keeps `plan.bin` through Metro. `plan.bin.gz` is written by
`tooling/city/bake-vd-storefronts.mjs` next to `plan.bin`, and `storefronts/plan-gzip.test.ts` fails if it drifts.
`load.ts` imports `./plan-asset` without an extension so Turbopack picks the `.web.ts` fork; with `./plan-asset.ts`
the web bundle emitted the 37 MB file.

## Files

- `packages/app/features/game/city-walk/` — screen, stage, copy, keyboard and pointer mapping (with tests)
- `apps/web/app/(site)/city/walk/page.tsx` — the route
- `apps/web/next.config.ts` — Turbopack `type: 'asset'` rules for `.bin` and `.bin.gz`
