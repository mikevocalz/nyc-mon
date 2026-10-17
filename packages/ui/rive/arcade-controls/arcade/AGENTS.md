# AGENTS

This is a Rive CLI project (see the sibling projects' AGENTS.md for the full
`rive` CLI workflow; the same rules apply here).

Unlike the siblings, the `.rml` files in this directory are GENERATED:
`merge.mjs` merges `../left-stick`, `../right-six` and `../start-stop`
`scene.rml` into one document (renumbered object ids, one shared FontAsset,
staged artboard positions). Never edit `stick.rml` / `cluster.rml` /
`pill.rml` directly — edit the source project and run `./build.sh`, which
regenerates, verifies and writes `build/arcade.riv`.

This merged file is loaded only when `EXPO_PUBLIC_ARCADE_MERGED_RIVE` is on
(see `packages/ui/game-controls/use-arcade-rive-files.native.ts`); the three
sibling projects remain the default and the source of truth for the Rive
contract checks in `scripts/rive/`.
