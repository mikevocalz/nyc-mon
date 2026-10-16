# Arcade control + game lobby: gate run (Lane F)

Run 2026-10-15 against the complete working tree on `main` at `311ab58` (every lane finished; nothing committed). Toolchain per the lane preamble: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH && npx -y pnpm@12.8.1 --filter <pkg> <script>`. Every gate ran once, from the repo root, through `scratchpad/laneF/run-gates.sh`; each tail below is pasted from that gate's log, not retyped. "Pass" means exit 0 and the tail says so; nothing here was verified on a device.

## Summary

| # | Gate | Command | Exit | Result |
|---|---|---|---|---|
| 1 | `@acme/ui` typecheck | `pnpm --filter @acme/ui typecheck` | 0 | pass |
| 2 | `@acme/app` typecheck | `pnpm --filter @acme/app typecheck` | 0 | pass |
| 3 | `@acme/core` typecheck | `pnpm --filter @acme/core typecheck` | 0 | pass |
| 4 | `@acme/theme` test | `pnpm --filter @acme/theme test` | 0 | pass, 410/410 |
| 5 | `@acme/ui` test | `pnpm --filter @acme/ui test` | 0 | pass, 491/491 |
| 6 | `@acme/app` test | `pnpm --filter @acme/app test` | 0 | pass, 285/285 |
| 7 | `@acme/core` test | `pnpm --filter @acme/core test` | 1 | 427/428; the one failure is the pre-existing `phase1-loop` nickname test (gate 8) |
| 8 | Pre-existing failure check | `git diff --quiet HEAD -- packages/core/schemas/mon.ts packages/core/sim/mon-name.ts packages/core/test/phase1-loop.test.ts` | 0 | the three nickname files are unchanged; the failure predates this work |
| 9 | eslint, game-controls + lobby | `(cd packages/ui && node_modules/.bin/eslint game-controls lobby)` | 0 | pass, no output |
| 10 | Gamepad Nitro module tsc | `(cd packages/ui/modules/nyc-gamepad-input && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json)` | 0 | pass, no output |
| 11 | Rive verify | `bash scripts/rive/verify.sh` | 0 | pass, 7 projects |
| 12 | RML colour check | `node scripts/rive/check-colors.mjs` | 0 | 281 colour attributes in 14 RML files, 0 off-token |
| 13 | Expo config (gamepad plugin) | `(cd apps/mobile && npx expo config --type public \| grep -A3 -i gamepad)` | 0 | plugin listed first; `GCSupportedGameControllers` and `GCSupportsControllerUserInteraction: false` present |
| 14 | Storybook build | `pnpm --filter storybook build` | 0 | built; 106 game-controls and lobby stories indexed |

The brief's eslint path (`../../node_modules/.bin/eslint` from `packages/ui`) does not exist in this checkout (exit 127, "No such file or directory"); the binary is hoisted into `packages/ui/node_modules/.bin/eslint`, which is what `pnpm --filter @acme/ui lint` resolves. Gate 9 was re-run with that path.

## Tails

### 1 to 3: typecheck

```
$ tsc --noEmit
```

Each of the three printed only the script echo and exited 0. `npm warn Unknown project config "node-linker"` precedes every pnpm run and is npm reacting to `.npmrc`, not a project error.

### 4: `@acme/theme` test

```
✔ theme.css emits xr type and targets in px (1.495458ms)
✔ theme-native.css emits xr type and targets in px (0.491375ms)
ℹ tests 410
ℹ suites 0
ℹ pass 410
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1270.12475
```

This suite includes `packages/theme/contrast.test.ts`, which measures every row in `contrast.ts`; the six new arcade rows pass their thresholds. Whether they cite a usage line is a separate finding (see `arcade-control-review-findings.md`).

### 5: `@acme/ui` test

```
✔ every display, type-ramp and xr-ramp step survives a colour class after it (4.842583ms)
✔ two sizes still merge: the later type-ramp step wins (0.126167ms)
ℹ tests 491
ℹ suites 53
ℹ pass 491
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1187.453125
```

Suites from this work that ran (names as `node --test` printed them): `controllerProfileSchema`, `patchControllerProfile`, `buttons: strict down/up pairing per (button, source)`, `stick ownership`, `cancelAll`, `requests and listeners`, `button table`, `family from a product name`, `left stick → move`, `d-pad → move`, `Start button`, `cluster coverage`, `button keys`, `WASD and arrows → eight-way stick`, `Enter and Escape`, `createArcadeRiveBinding`, `sixButtonArch`, `readStick dead zone`, `readStick axes and clamp`, `direction8`, `toDigitalReading`, `visual helpers`, `stickOrigin`, `lobby copy`, `createLobbyRiveBinding`, plus the flat tests in `layout/controller-layout-resolver.test.ts` and `layout/revalidate-positions.test.ts` (first test names confirmed in the log).

### 6: `@acme/app` test

```
✔ addMonths (0.172292ms)
ℹ tests 285
ℹ suites 66
ℹ pass 285
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1588.000083
```

Suites from this work that ran: `toLeaderboardModel`, `toResumeSummary`, `lobbyStore`, `planResumeSequence`, `runResumeSequence`, `save cadence: bounded, never per frame, idempotent by revision`, `world snapshot`, `world save store (shared)`, `world session store`, plus the flat tests in `use-game-input.test.ts`, `controller-profile.store.test.ts`, `controller-layout.store.test.ts` and `controls-settings/controls-settings-copy.test.ts` (first test names confirmed in the log).

### 7: `@acme/core` test

```
 ❯ test/phase1-loop.test.ts (27 tests | 1 failed) 144ms
   ❯ validateMonName (M09) (9)
     × schemas reject a 17-character nickname everywhere the nickname is stored or sent 6ms

 FAIL  test/phase1-loop.test.ts > validateMonName (M09) > schemas reject a 17-character nickname everywhere the nickname is stored or sent
AssertionError: expected true to be false // Object.is equality
 ❯ test/phase1-loop.test.ts:62:78

 Test Files  1 failed | 19 passed (20)
      Tests  1 failed | 427 passed (428)
   Start at  14:09:00
   Duration  9.71s (tests 84%, transform 9%, import 6%)
```

`test/world-resume.test.ts`, `test/game-session.test.ts` and `test/leaderboard.test.ts` are among the 19 passing files.

### 8: pre-existing failure

```
git diff --quiet HEAD -- packages/core/schemas/mon.ts packages/core/sim/mon-name.ts packages/core/test/phase1-loop.test.ts; echo exit=$?
exit=0
```

### 9: eslint

```
(cd packages/ui && node_modules/.bin/eslint game-controls lobby)
```

No output, exit 0.

### 10: Nitro module tsc

```
(cd packages/ui/modules/nyc-gamepad-input && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json)
```

No output, exit 0.

### 11: Rive verify

```
rive rive 1.5.0
== left-stick
+ rive packages/ui/rive/arcade-controls/left-stick --verify --format=json
+ rive packages/ui/rive/arcade-controls/left-stick --once --format=json
+ rive packages/ui/rive/arcade-controls/left-stick --test --format=json
+ rive inspect packages/ui/rive/arcade-controls/left-stick --summary
...
== game-lobby
+ rive packages/ui/rive/lobby/game-lobby --semantics=docs/evidence/rive/game-lobby/semantics-continue.semantics.json --data=transition/phase=done --data=lobby/resume/eligible=true --advance=1s
+ rive packages/ui/rive/lobby/game-lobby --data-dump=docs/evidence/rive/game-lobby/data-contract.data.json --data=transition/phase=done --advance=60 --data-dump-filter=lobby/*,leaderboard/*,transition/*,theme/*,layout/*,a11y/*
== check-colors
check-colors: 281 colour attributes in 14 RML files, 0 off-token
verify.sh: ok (7 project(s), evidence in docs/evidence/rive)
```

The script regenerates every PNG, semantics dump and data dump under `docs/evidence/rive/` on each run (local `rive` CLI 1.5.0; no push, no login). Running it as a gate therefore rewrote lane B's evidence files in place; they are untracked, so nothing committed changed. Its coverage (what it asserts versus what it only screenshots) is reviewed in the findings file.

### 12: RML colour check

```
check-colors: 281 colour attributes in 14 RML files, 0 off-token
```

### 13: Expo public config

```
    './plugins/with-optional-gamepad',
    'expo-router',
    [
      'expo-build-properties',
--
          ProfileName: 'ExtendedGamepad'
        },
        {
          ProfileName: 'DirectionalGamepad'
        }
      ],
      GCSupportsControllerUserInteraction: false,
```

### 14: Storybook build

```
│  storybook-static/assets/iframe-CzyMyJnf.js
│  1,167.18 kB │ gzip: 331.35 kB
│  Vite ✓ built in 2.88s
◇  Output directory:
│  /Users/mikevocalz/nyc-mon/apps/storybook/storybook-static
└  Storybook build completed successfully
```

Chunk-size warnings for `three.webgpu`, `typegpu` and `axe` are pre-existing and unrelated to this work. `storybook-static/` is gitignored (`.gitignore:14`).

Stories indexed from `storybook-static/index.json` (title: count, names):

- Game controls/AdaptiveControlLayout (13): Phone Portrait, Phone Landscape, Fold Outer, Book Posture, Dual Screen Hinge, Tabletop, Trifold, Tablet, Web, Left Handed, Large Scale On Phone, Saved Position Revalidated, Hardware Source Active
- Game controls/AnalogStick (8): Idle, Deflected, Dead Zone, D Pad Mode, Floating, Reduced Motion, Disabled, Scale 14
- Game controls/ArcadeActionButton (11): Idle, Pressed, Held, Released, Disabled, Cooldown, With Icon, Long Label, Reduced Motion, All States, Scales
- Game controls/ArcadeController (18): Phone Portrait, Phone Landscape, Fold Tabletop, Fold Book, Tablet, Web, Left Handed, Scale 08, Scale 14, Opacity 30, All Button States, All Pill States, Reduced Motion, Preview, D Pad Mode, Floating Stick, Disabled, Start State
- Game controls/StartStopPill (9): Start, Playing, Paused, Stop Confirm 0, Stop Confirm 50, Stop Confirm 100, Disabled, Reduced Motion, Live
- Lobby/AngledStartButton (9): Idle, Continue, Pressed, Loading, Disabled, Recover, Reduced Motion, Daylit, At Scale
- Lobby/GameLobby (19): New Game, Eligible Save, Eligible Save No District, Offline, Resume Failed Dataset, Resume Failed Unreadable, Resume Failed Newer Save, Leaderboard Loading, Leaderboard Error, Reduced Motion, Daylit, Night, Phone Landscape, Fold Outer, Fold Book, Fold Tabletop, Tablet, Web, Starting
- Lobby/GameTransition (7): Enter, Hold, Reveal, Done, Reduced Motion, Daylit, Live
- Lobby/LeaderboardPanel (12): Loading, Ready, Empty, Empty Not Eligible, Stale, Error, Unavailable, Self In Top Three, Self Outside List, Long Name, Reduced Motion, District Keyline

Total: 106. Indexing proves the story modules compile and export; it does not prove they render. No story was opened in a browser in this lane (recorded as a known gap by the building lanes; see the findings file).

## Not run

- `pnpm --filter @acme/theme lint`, `--filter @acme/app lint`, `--filter @acme/core lint`: outside the brief's list. The `contrast.ts` formatting defect in the findings file suggests the theme lint would be worth adding to the orchestrator's pathspec commit check.
- Any device, simulator, emulator or browser session: forbidden in this lane. See `device-plan.md`.
