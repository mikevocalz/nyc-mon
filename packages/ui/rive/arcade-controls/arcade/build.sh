#!/usr/bin/env bash
# Builds build/arcade.riv — the merged controller file (one parse for all five
# artboards), committed next to this script like the sibling projects'
# artifacts. The .rml inputs are GENERATED from ../left-stick, ../right-six
# and ../start-stop by merge.mjs; regenerate before verifying.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
node merge.mjs
rive . --verify --format=json
rive . --once --format=json
