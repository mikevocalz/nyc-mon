# Rive environment gate

Master Directive v2 §7 asks every PR to carry the CLI version and the
`rive doctor` JSON it was built with. This is the gate output for the
arcade-control and lobby projects, captured 2026-10-15 before any project was
created, copied verbatim from the research log. The full `rive docs`,
`rive docs gotchas`, `rive docs layout`, `rive schema` and `rive --help` output
that followed it lives in the same log and is not repeated here.

## `rive --version`

```
rive 1.5.0
```

The installed build is 1.5.0; `doctor` reports 1.6.0 as the latest. Decision:
STRIKE the update in this session. Every flag the verification uses exists in
1.5.0 (`rive --help` in the log), and a mid-lane toolchain change would make
the captures below incomparable.

## `rive doctor --format=json`

```json
{"success": true, "command": "doctor", "data": {"checks": [{"name": "version", "status": "ok", "detail": "rive 1.5.0, local build"}, {"name": "update", "status": "warn", "detail": "latest is 1.6.0; run `rive update`"}, {"name": "auth", "status": "warn", "detail": "Not logged in (prod); --publish and --rev need a session, and push its own"}, {"name": "live-link", "status": "ok", "detail": "port 9640 available for --serve"}, {"name": "project", "status": "ok", "detail": "no rive.yaml in /Users/mikevocalz/nyc-mon (run `rive create`, or pass a project dir)"}, {"name": "android", "status": "warn", "detail": "no device for --android; connect one with USB debugging on"}, {"name": "ios", "status": "warn", "detail": "--ios builds our player from a Rive checkout; set RIVE_ROOT"}, {"name": "wamrc", "status": "ok", "detail": "--aot fetches wamrc on first use"}]}, "errors": [], "warnings": ["update: latest is 1.6.0; run `rive update`", "auth: Not logged in (prod); --publish and --rev need a session, and push its own", "android: no device for --android; connect one with USB debugging on", "ios: --ios builds our player from a Rive checkout; set RIVE_ROOT"]}
```

Readings: `auth` is `warn`, not logged in. The project does not log in:
the workflow is CLI only (`docs/implementation/rive-round-trip.md`), so the
account commands that warning names are not part of it. `live-link` is `ok` (port 9640
free), so `--serve` and `--headless-serve` are available once a device
session exists. `android` and `ios` warn because no device is connected;
nothing in this lane runs on a device.

## `rive whoami`

```
Not logged in
```

## `rive schema --search layout`

```
types:
  ForegroundLayoutDrawable
  LayoutComponent
  LayoutComponentStyle
  LayoutNodeStyle
  LayoutParticipant
  NestedArtboardLayout
  ScriptedLayout

properties:
  Backboard.enableLayoutAnimation
  Backboard.layoutTransformMigrated
  Backboard.showLayouts
  Component.participatesInLayout   (bit of flags)
  LayoutComponentStyle.layoutAlignmentType
      accepts: topLeft (0), topCenter (1), topRight (2), centerLeft (3), center (4), centerRight (5), bottomLeft (6), bottomCenter (7), bottomRight (8), spaceBetweenStart (9), spaceBetweenCenter (10), spaceBetweenEnd (11)
  LayoutComponentStyle.layoutTypeValue
      accepts: flex (0), grid (1), stack (2)
  LayoutSizingStyle.layoutHeightScaleType   (abstract base -- set it on a type that extends it)
      accepts: fixed (0), fill (1), hug (2)
  LayoutSizingStyle.layoutWidthScaleType   (abstract base -- set it on a type that extends it)
      accepts: fixed (0), fill (1), hug (2)
  NestedArtboardLeaf.fitToLayoutParent
```

## `rive schema --bindable ViewModel`

```
ViewModel  (typeKey 435)
extends ViewModelComponent

no matching properties
```

## `rive samples --path`

```
/opt/homebrew/Caskroom/rive-cli/1.5.0/samples
```

## What the verification run writes

`scripts/rive/verify.sh` writes one directory per project under
`docs/evidence/rive/`: `verify.json`, `once.json`, `test.json`,
`inspect-summary.json`, `phone.png` (844 x 390), `narrow.png` (320 x 700),
`semantics.json`, `data.json`, `trace.jsonl`, `bench.log`, then the project's
own state captures with a `.log` beside each. `check-colors.log` at the top
is the token check over every RML file.
