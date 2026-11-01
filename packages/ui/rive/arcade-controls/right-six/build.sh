#!/usr/bin/env bash
# Builds build/right-six.riv, the committed artifact next to this script
# (Master Directive v2 §7: the generated .riv is committed beside a build
# script, never as the only artifact). Verify first, then write the unsigned
# .riv; neither step needs a Rive login. The full evidence run is
# scripts/rive/verify.sh from the repo root.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
rive . --verify --format=json
rive . --once --format=json
