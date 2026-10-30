# Egg hatching pipeline

Turns the creator's egg meshes into hatch assets the app plays in three.js:
the egg (Form 0) shifts from inside, cracks three times, leaks goo from the
cracks before the shell parts, splits into real shell pieces, and the Baby
struggles out. There is no capture case anywhere in this sequence
(Decision 29).

Blender 5.2+ (built and checked on 5.2.2 LTS). The pipeline only uses bpy, numpy and
mathutils, so it runs the same live over Blender MCP and headless.

## Run it

```sh
# Headless, one egg
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 \
  -P tooling/blender/hatching/build.py -- tooling/blender/hatching/manifests/metro-egg.json

# Compress every built GLB (meshopt)
tooling/blender/hatching/compress.sh

# Play each GLB in three.js and screenshot the phase boundaries
python3 -m http.server 8766 --bind 127.0.0.1 &   # from the repo root
node tooling/blender/hatching/playback/playback.mjs metro-egg /tmp/hatch-playback

# Check assets against their manifests and the three.js playback
python3 tooling/blender/hatching/validate.py --playback /tmp/hatch-playback
```

Live: with the Blender MCP add-on serving on port 9876, run `build.run(path)`
inside the session. Each egg builds into its own `Hatch_<eggId>` scene, and the
open scene is never touched. A rebuild removes only earlier `Hatch_*` scenes and
the unused data this pipeline named.

## Inputs and outputs

`manifests/<egg>.json` holds the canon mapping (egg and Baby species ids,
bloodline), source paths and sha256 hashes, the fracture seed and settings, the
goo profile and the phase timing. Timing mirrors `PHASE_MS` in
`packages/app/features/hatch/hatch-sequence.ts`: stir 1.0 s, pressure 0.8 s,
crack 2.4 s with beats at 25/55/85 %, burst 0.5 s, emerge 1.8 s.

Each build writes `packages/assets/eggs/<egg>/`:

| File | What it is |
|---|---|
| `<egg>-hatch.glb` | Runtime asset: clips `egg_idle`, `hatch`, `attention_lean_in`, `attention_hesitate` |
| `<egg>-hatch.blend` | Editable source scene |
| `hatch.manifest.json` | The manifest plus what the build measured: clip map, phase seconds, crack order, shell piece names, Baby landing spot |
| `source/` | The creator's mesh and reference art, unchanged |

## How each part is made

| Module | Does |
|---|---|
| `fracture.py` | Welds the imported shell, drops stray scraps, caps holes at the poles, then cuts it along a noisy waistline into a cup and five shards. Each piece keeps the original UVs, so the decoration carries onto it, and gets real thickness with a glowing broken edge. Shards hinge at their lowest edge and come to rest on the ground. |
| `goo.py` | Goo as morph targets, since fluid sims don't survive glTF. Drips follow the shell surface down from each crack lip (`Bead`, `Ooze_1..3`). Strands stretch between the cup and a tipping shard (`Stretch_1..3`), then snap into a bead at each end (`Snap`). The puddle spreads (`Spread`). The membrane is a smooth lathe of the shell's inner profile that glows through the cracks (`Pulse`, `Press`). |
| `animate.py` | Keys every clip from the manifest timing. `hatch` is one timeline, so the runtime can seek to the start of any saved phase. |
| `baby_proxy.py` | A stand-in Baby, named `PROXY_*` everywhere. No Baby model or rig exists yet. |
| `build.py` | Runs the steps and exports. Each clip becomes one Blender 5 slotted action exported in `ACTIONS` mode. In 5.2, `NLA_TRACKS` mode samples shape-key tracks as flat weights. |
| `lookdev.py` | Art-reference renders (six orthographic views, timeline frames). |

## Known limits

- Signal Egg (#020) is built from `Signal-Egg.glb`, the tan spotted egg
  supplied as `Fye-Egg.glb`. Its art reference is the red polka-dot egg
  (Decision 31), which this mesh does not match; Mike chose to ship the mesh
  anyway on 2026-10-29 (Decision 38). `build.py` refuses to build any egg
  whose manifest has no mesh.
- Every Baby is a proxy. The real Squeaklet, Kittee Cee, Yotito and Fye Dot
  models and rigs don't exist, so `baby.proxy` is `true` in every manifest.
- Corner Egg keeps its full 72k triangles: its fur band is real geometry, and
  cutting it to the 20k budget collapses the shell into a cone. Its GLB is
  3.35 MB, against about 1 MB for the other three.
- Falling droplets are left to a runtime TypeGPU effect. They are not in the GLB.
- The playback check uses three.js `WebGLRenderer` in headless Chromium. It
  proves the clips, morphs and timing, not WebGPU or on-device frame times.
