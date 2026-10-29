#!/usr/bin/env bash
# Builds build/loader.riv, the committed artifact next to this script. Verify
# first, then write the unsigned .riv; neither step needs a Rive login.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
rive . --verify --format=json
rive . --once --format=json
