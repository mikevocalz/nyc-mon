#!/usr/bin/env bash
# Builds build/hatch-evolve.riv, the committed artifact next to this script.
# scene.rml is generated (scene.gen.mjs); regenerate, verify, then write the
# unsigned .riv. No step needs a Rive login.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
node scene.gen.mjs
rive . --verify --format=json
rive inspect . --summary
rive . --once --format=json
