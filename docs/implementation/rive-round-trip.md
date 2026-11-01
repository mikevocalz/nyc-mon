# Rive CLI workflow

Master Directive v2 §7. This project uses the Rive CLI only. The RML under
`packages/ui/rive/` is the source, each project's `build.sh` builds the
committed `.riv` from it, and `scripts/rive/verify.sh` verifies the result.
Nothing here uses a Rive account: no `rive login`, no `rive push` or `rive
pull`, no Editor, no `--publish`.

Toolchain: Rive CLI 1.5.0 (`docs/evidence/rive/environment.md` has the
`doctor` JSON).

## Projects

| Project | Directory | Main artboard | Contract paths |
|---|---|---|---|
| left-stick | `packages/ui/rive/arcade-controls/left-stick/` | `LeftStick` | `stick/x`, `stick/y`, `stick/engaged`, `stick/mode` |
| right-six | `packages/ui/rive/arcade-controls/right-six/` | `RightSix` | `buttons/<x,y,z,a,b,c>/state`, `/label`, `/icon` |
| start-stop | `packages/ui/rive/arcade-controls/start-stop/` | `StartStop` | `pill/state`, `pill/holdProgress` |
| leaderboard | `packages/ui/rive/lobby/leaderboard/` | `Leaderboard` (hosts `LeaderboardPanel`) | `leaderboard/status`, `leaderboard/rows[n]/rank`, `/name`, `/score`, `/isSelf` |
| start-angled | `packages/ui/rive/lobby/start-angled/` | `StartAngledHost` (hosts `StartAngled`) | `lobby/resume/eligible`, `lobby/resume/district`, `lobby/start/state` |
| game-transition | `packages/ui/rive/lobby/game-transition/` | `GameTransitionHost` (hosts `GameTransition`) | `transition/phase` |
| game-lobby | `packages/ui/rive/lobby/game-lobby/` | `GameLobby` | all of the lobby paths above |

Every project also carries `theme/variant`, `layout/profile` and
`a11y/reducedMotion`. Each directory has `rive.yaml`, `scene.rml`, the
generated `AGENTS.md` with a `CLAUDE.md` that imports it, `build.sh`, and the
committed `build/<name>.riv`; `.gitignore` keeps everything else under
`build/` out of git.

### How the lobby projects share source

The Rive CLI compiles every `.rml` in a project directory as one document
(`rive docs project/rive-yaml`). The four lobby projects use that in two ways:

- `lobby/game-lobby/shared-vm.rml` defines the `Theme`, `Layout` and `A11y`
  view models and their enums once, with client id 9. `leaderboard/`,
  `start-angled/` and `game-transition/` hold a symlink to it, so the three
  standalone projects and the assembled lobby bind the same instances.
- `lobby/game-lobby/` holds symlinks `leaderboard.rml`, `start-angled.rml` and
  `game-transition.rml` to the siblings' `scene.rml`. The lobby nests the
  siblings' component artboards by id, and each sibling keeps a distinct
  client id (leaderboard 2, start-angled 3, game-transition 4, game-lobby 1)
  so ids never collide in the combined build.

The symlinks are how projects share source: a change to a sibling's
`scene.rml` is in the lobby on its next build with no copy step.

Two rules the probes in this session established, both recorded in the RML
comments: a nested artboard only receives its view model when the host hands
it one through `dataBindPathIds`, and the placement needs a
`NestedStateMachine` child or the component's state machine never runs and
every bind stays at its authored literal.

## The loop

From the repo root:

```bash
rive packages/ui/rive/lobby/leaderboard --verify --format=json   # after every edit
rive inspect packages/ui/rive/lobby/leaderboard --summary        # problems must be []
rive packages/ui/rive/lobby/leaderboard --screenshot=build/x.png --advance=1s --data=leaderboard/status=stale
packages/ui/rive/lobby/leaderboard/build.sh                       # writes the committed .riv
scripts/rive/verify.sh leaderboard                                # the full evidence run for one project
scripts/rive/verify.sh                                            # all seven, CI
```

`verify.sh` fails on a non-zero exit (and prints the command's real exit
code), on any `--data` path that reports `no property`, on an `inspect`
problem of any severity, and on an off-token colour
(`scripts/rive/check-colors.mjs`). Evidence lands in
`docs/evidence/rive/<project>/`. Each run also rewrites
`build/<project>.data.json` from the current scene.

A full run (all seven projects) then calls `scripts/rive/check-contract.sh`,
which needs `jq` and checks content rather than exit codes:

- Semantics, over every `semantics*.semantics.json`: right-six has exactly six
  `button` nodes, left-stick has a `slider`, every interactive node (button,
  slider, link, checkbox, switch, text field, radio, tab) is at least 44 x 44,
  and no `text` node has an empty label.
- Path names: every literal in `ARCADE_VM_PATHS`
  (`packages/ui/game-controls/rive-binding.ts`, with `buttons/<id>/state`,
  `/label` and `/icon` expanded for x y z a b c) must exist in the owning
  project's `build/<project>.data.json`. A miss fails the run. This check
  would have caught `pill/holdProgress` before the artboard had it: run
  against the old `start-stop.data.json` it fails with
  `arcade path pill/holdProgress missing`.
- The lobby leg reads `LOBBY_VM_PATHS` from
  `packages/ui/lobby/lobby-rive-binding.ts` and only warns. Row paths are
  compared by item property name (`rank`, `name`, `score`, `isSelf`) against
  the list's items, because the rows are moving to a list property with
  item-relative paths.

`check-contract.sh semantics`, `check-contract.sh paths` and
`check-contract.sh paths --data start-stop=<file>` run one leg alone or
against a saved dump.

### Contract notes from the 2026-10-15 fixes

- `pill/holdProgress` (number, 0 to 1, default 0) drives the start-stop hold
  ring. The ring's trim end is data bound to it through a clamp; no timeline
  keys the trim, and the ring only shows in `stopConfirm`. It has no clock of
  its own: the hold length is the code's `STOP_HOLD_MS` (1000 ms). Under
  `a11y/reducedMotion` the Motion layer shows a second, authored ring whose
  trim reads `floor(holdProgress * 4) / 4`, so it sits on 0, .25, .5, .75 or
  1 whatever the host writes (0.6 renders as 0.5;
  `docs/evidence/rive/start-stop/holdProgress-reduced-0.6.png`).
- right-six `Released` (10-frame decay) has a one-frame `ReleasedReduced`
  sibling; the Pose layer picks one by `reducedMotion`, as the Compression
  layer and left-stick already did. Each cap's semantics node now carries
  `isDisabled`, true in `disabled` and `cooldown`. SemanticData has no
  pressed, held or busy flag in 1.5.0 (`rive schema SemanticData`), so held
  is not exposed.
- start-angled speaks the resume district as the button's semantic value
  instead of a separate text node, which was empty and 0 x 0 with no
  district.
- game-lobby's 200 ms theme cross-fade has an instant reduced-motion branch.

Previewing in a window is `rive <dir>`; it runs until closed and rebuilds on
save. This lane did not open one (no windows), so every appearance claim here
rests on `--screenshot` captures that were viewed.

## Output, LSP, live link

- The shipped `.riv` is the `rive <dir> --once` output `build.sh` writes. It
  is unsigned, which the native runtime and every `verify.sh` check accept;
  web runtimes reject unsigned files only when they carry scripts, and none of
  these projects do.
- LSP: `rive lsp` speaks the language server protocol over stdio. For VS Code
  add a generic LSP client entry that runs `rive lsp` for `*.rml`; the four
  problem kinds `reference-wrong-type`, `implied-reference-authored`,
  `wrong-parent` and `duplicate-sibling` are build failures and show inline.
- Live link: `rive <dir> --serve` sends each local build to connected
  players on the LAN during a device session (no account involved);
  `--headless-serve` does the same with no window
  (CI). `doctor` shows `live-link: ok` on this machine.

## What the CLI cannot do here, and what that means

- `--data` cannot address a list row: `--data=leaderboard/rows[0]/name=X`
  reports `no property at this path` in 1.5.0, while `--data-dump` prints
  exactly that path with its value. The leaderboard's rows are authored
  fixture instances in `scene.rml`; the host runtime replaces them. The
  evidence for the list binding is the rendered rows plus the dump.
- The assembled lobby `.riv` is about 614 KB because each symlinked sibling
  embeds its own copy of Space Grotesk. The standalone projects are 140 to
  150 KB each. Decision: DEFER deduplication; the lobby is the preview
  scene, and the RN wrapper loads the three standalone files.
- No Luau scripts were written. Every behaviour here is state machines,
  listeners and data binding, which the native runtime handles without
  signing.
