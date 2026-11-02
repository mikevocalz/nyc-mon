#!/bin/bash
# Post-export compression for every built hatch GLB: vertex and animation
# quantization (KHR_mesh_quantization) plus dedup/prune. No meshopt or Draco:
# their decoders need WebAssembly, which Hermes doesn't have, and three.js reads
# quantized attributes natively on web and on device.
# Also records the final size in the egg's hatch.manifest.json.
# usage: tooling/blender/hatching/compress.sh [egg-id ...]
set -euo pipefail
cd "$(dirname "$0")/../../.."
G="npx -y @gltf-transform/cli@4.5.1"
eggs=("$@")
[ ${#eggs[@]} -eq 0 ] && eggs=(metro-egg corner-egg prism-egg signal-egg)
for egg in "${eggs[@]}"; do
  f="packages/assets/eggs/$egg/$egg-hatch.glb"
  $G dedup "$f" "$f.1.glb" >/dev/null
  $G quantize "$f.1.glb" "$f.2.glb" >/dev/null
  mv "$f.2.glb" "$f"; rm -f "$f.1.glb"
  bytes=$(wc -c < "$f" | tr -d ' ')
  python3 - "$egg" "$bytes" <<'PY'
import json, sys
p = f"packages/assets/eggs/{sys.argv[1]}/hatch.manifest.json"
m = json.load(open(p)); m["runtime"]["glbBytes"] = int(sys.argv[2])
open(p, "w").write(json.dumps(m, indent=2) + "\n")
PY
  echo "$egg $bytes bytes"
done
