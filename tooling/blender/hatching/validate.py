"""Check every built hatch asset against its manifest and its three.js playback.

Runs without Blender:
    python3 tooling/blender/hatching/validate.py [egg-id ...] --playback <dir>

The playback directory holds `<egg>-playback.json` written by
playback/playback.mjs, so the timing checks are made on what three.js actually
played, not on the Blender scene. Exit code 1 if any check fails.
"""
import hashlib
import json
import os
import struct
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
CLIPS = ("egg_idle", "hatch", "attention_lean_in", "attention_hesitate")
MORPHS = {"Goo_Drip_": ["Bead", "Ooze_1", "Ooze_2", "Ooze_3"], "Goo_Strand_": ["Stretch_1", "Stretch_2", "Stretch_3", "Snap"],
          "Goo_Puddle": ["Spread"], "Membrane": ["Pulse", "Press"]}


def gltf_json(path):
    with open(path, "rb") as f:
        b = f.read()
    n = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + n])


def sha(path):
    with open(os.path.join(REPO, path), "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def check(egg, playback_dir):
    out = []
    ok = lambda cond, msg: out.append(("PASS" if cond else "FAIL", msg))
    d = os.path.join(REPO, "packages/assets/eggs", egg)
    m = json.load(open(os.path.join(d, "hatch.manifest.json")))
    src = m["source"]
    ok(sha(src["mesh"]) == src["meshSha256"], "source mesh hash matches manifest")
    if src.get("reference"):
        ok(sha(src["reference"]) == src["referenceSha256"], "reference art hash matches manifest")
    glb = os.path.join(d, m["runtime"]["glb"])
    ok(os.path.exists(glb) and os.path.exists(glb.replace(".glb", ".blend")), "GLB and editable .blend both exist")
    j = gltf_json(glb)
    names = [n.get("name", "") for n in j["nodes"]]
    clips = [a["name"] for a in j["animations"]]
    ok(all(c in clips for c in CLIPS) and len(clips) == len(CLIPS), f"clips are exactly {', '.join(CLIPS)} (got {clips})")
    shards = [n for n in names if n.startswith("Shell_") and n != "Shell_Cup"]
    ok("Shell_Cup" in names and len(shards) >= 4, f"shell is a cup plus {len(shards)} separate pieces")
    ok(m["runtime"]["shellPieceNames"] and set(m["runtime"]["shellPieceNames"]) <= set(names), "manifest shell piece names exist as nodes")
    for mesh in j["meshes"]:
        for prefix, keys in MORPHS.items():
            if mesh["name"].startswith(prefix):
                ok(mesh.get("extras", {}).get("targetNames") == keys, f"{mesh['name']} morph targets are {keys}")
    proxy_nodes = [n for n in names if n.startswith("PROXY_")]
    ok(bool(proxy_nodes) == bool(m["baby"].get("proxy")), "proxy Baby nodes and manifest `baby.proxy` agree")
    ok(not any("case" in n.lower() or "scan" in n.lower() for n in names), "no capture-case or scanner nodes")
    allowed = {"KHR_materials_emissive_strength", "EXT_meshopt_compression", "KHR_mesh_quantization"}
    ok(set(j.get("extensionsUsed", [])) <= allowed, f"extensions limited to {sorted(allowed)}")

    pb_path = os.path.join(playback_dir, f"{egg}-playback.json")
    if not os.path.exists(pb_path):
        ok(False, f"three.js playback evidence at {pb_path}")
        return out, m
    pb = json.load(open(pb_path))
    shots = {s["label"]: s for s in pb["shots"]}
    ok(not pb["info"]["missing"] and not [e for e in pb["errors"] if "404" not in e], "three.js loaded every clip with no errors")
    w = lambda label, node: shots[label]["weights"].get(node, [])
    leaked = any(any(v > 0.05 for v in w("crack-beat-1", n)) for n in shots["crack-beat-1"]["weights"] if n.startswith("Goo_Drip"))
    ok(leaked, "goo is leaking from a crack at the first crack beat, before burst")
    closed = all(not any(v > 0 for v in w("crack-start", n)) for n in shots["crack-start"]["weights"] if n.startswith("Goo_Strand"))
    ok(closed, "strands are not stretched before the shell parts")
    snapped = all(w("emerge-end", n)[-1] > 0.99 for n in shots["emerge-end"]["weights"] if n.startswith("Goo_Strand"))
    ok(snapped, "every strand has stretched and snapped by the end of emerge")
    inside, out_pos = shots["stir-start"]["baby"], shots["emerge-end"]["baby"]
    moved = ((out_pos[0] - inside[0]) ** 2 + (out_pos[2] - inside[2]) ** 2) ** 0.5
    ok(moved > 0.06 and abs(out_pos[1]) < 0.002, f"Baby travels {moved:.3f} m out of the egg and ends on the ground")
    return out, m


def main(argv):
    pb = argv[argv.index("--playback") + 1] if "--playback" in argv else "playback-out"
    root = os.path.join(REPO, "packages/assets/eggs")
    eggs = [a for a in argv if not a.startswith("--") and a != pb] or sorted(e for e in os.listdir(root) if os.path.exists(os.path.join(root, e, "hatch.manifest.json")))
    failed = 0
    for egg in eggs:
        results, m = check(egg, pb)
        size = os.path.getsize(os.path.join(REPO, "packages/assets/eggs", egg, m["runtime"]["glb"]))
        print(f"\n{egg} ({m['eggName']} -> {m['babyName']}), {size / 1e6:.2f} MB")
        for status, msg in results:
            print(f"  {status}  {msg}")
            failed += status == "FAIL"
    print(f"\n{failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
