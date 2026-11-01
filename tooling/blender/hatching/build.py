"""Build one egg's hatch asset from its manifest.

Live (Blender MCP):  exec this file's `run(manifest_path)` in the session.
Headless:            blender -b --factory-startup --python-exit-code 1 \
                       -P tooling/blender/hatching/build.py -- manifests/metro-egg.json

Writes, under packages/assets/eggs/<eggId>/:
  <eggId>-hatch.glb      runtime asset (clips: egg_idle, hatch, attention_*)
  <eggId>-hatch.blend    editable source scene
  hatch.manifest.json    manifest plus everything the build measured
"""
import json
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import animate  # noqa: E402
import baby_proxy  # noqa: E402
import common  # noqa: E402
import fracture  # noqa: E402
import goo  # noqa: E402


def _lip(cup, azimuth_deg):
    """Highest outer point of the cup rim near this azimuth (a crack lip)."""
    import math
    import numpy as np

    co = np.empty(len(cup.data.vertices) * 3)
    cup.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    az = np.degrees(np.arctan2(co[:, 1], co[:, 0]))
    near = co[np.abs(((az - azimuth_deg + 180) % 360) - 180) < 8]
    radial = np.hypot(near[:, 0], near[:, 1])
    outer = near[radial >= np.percentile(radial, 60)]
    top = outer[outer[:, 2].argmax()]
    return math.radians(azimuth_deg), float(top[2]), top


def run(manifest_path, export=True):
    m = common.load_manifest(manifest_path)
    egg_id = m["eggId"]
    if not m["source"].get("mesh"):
        raise RuntimeError(f"{egg_id}: no source mesh yet ({m['source'].get('approval')}); nothing to build")
    out_dir = common.repo_path(f"packages/assets/eggs/{egg_id}")
    scene = common.fresh_scene(f"Hatch_{egg_id}")
    scene.render.fps = m["timing"]["fps"]
    win = bpy.context.window
    prev = win.scene if win else None
    if win:
        win.scene = scene
    try:
        col = common.new_collection(scene, f"Egg_{egg_id}")
        egg = fracture.import_egg(common.repo_path(m["source"]["mesh"]), col)
        fracture.decimate(egg, m["fracture"].get("maxShellTriangles", 20000))
        pieces, info = fracture.build(egg, m, col)

        root = bpy.data.objects.new("Egg_Root", None)
        col.objects.link(root)
        membrane = goo.membrane(egg, col, m["gooProfile"]["emissiveFleck"])
        for ob in pieces + [membrane]:
            ob.parent = root

        p = animate.plan(m, info)
        goo_mat = goo.goo_material(m["gooProfile"])
        cup = next(o for o in pieces if o.name == "Shell_Cup")
        by_name = {o.name: o for o in pieces}
        drips, strands = [], []
        for idx, crack in enumerate(p["crackers"]):
            az, z, lip = _lip(cup, crack["azimuth"])
            if idx == 0:
                goo.add_press(membrane, lip)
            d = goo.drip(egg, col, goo_mat, idx + 1, az, z - 0.001, m["gooProfile"]["dripRadius"])
            d.parent = root
            drips.append(d)
            if idx < 2:
                strands.append(_strand(col, goo_mat, idx + 1, crack, by_name[crack["name"]], lip, p, m, root))
        puddle = goo.puddle(col, goo_mat, m, m["gooProfile"]["puddleRadius"])

        babyc = common.new_collection(scene, "PROXY_Baby")
        baby = baby_proxy.build(babyc)
        landing, hide, clearance = animate.pick_landing(pieces, info)

        owners_hatch = _animated(lambda: animate.animate_hatch(m, root, pieces, info, membrane, drips, strands, puddle, baby, landing))
        animate.stash(owners_hatch, "hatch")
        animate.stash(_animated(lambda: animate.animate_idle(m, root, membrane)), "egg_idle")
        animate.stash(_animated(lambda: animate.animate_attention(m, baby, landing, hide, "lean_in")), "attention_lean_in")
        animate.stash(_animated(lambda: animate.animate_attention(m, baby, landing, hide, "hesitate")), "attention_hesitate")
        _rest_pose(root, pieces, info, membrane, drips, strands, puddle, baby)

        bpy.data.objects.remove(egg, do_unlink=True)
        common.tag_scene(scene)
        report = {"pieces": [i for i in info], "landing": list(landing), "landingClearance": clearance, "crackers": [c["name"] for c in p["crackers"]],
                  "frames": {k: list(v) for k, v in p["phases"].items()}, "beats": p["beats"]}
        if export:
            os.makedirs(out_dir, exist_ok=True)
            glb = os.path.join(out_dir, f"{egg_id}-hatch.glb")
            _export(scene, glb)
            report["glb"] = glb
            report["glbBytes"] = os.path.getsize(glb)
            blend = os.path.join(out_dir, f"{egg_id}-hatch.blend")
            bpy.data.libraries.write(blend, {scene}, fake_user=True, compress=True)
            report["blend"] = blend
            _write_manifest(m, report, out_dir)
        return report
    finally:
        if win and prev:
            win.scene = prev


def _strand(col, mat, index, info, ob, lip, p, m, root):
    import numpy as np
    from mathutils import Vector

    co = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    hinge = Vector(info["hinge"])
    world = co + np.asarray(hinge)
    nearest = Vector(co[np.linalg.norm(world - np.asarray(lip), axis=1).argmin()])
    beat_index = p["crackers"].index(info)

    def at(t):
        return animate._q(info["axis"], animate.shard_angle_at(info, p, beat_index, t)) @ nearest + hinge

    st = goo.strand(col, mat, index, Vector(lip), at, m["gooProfile"]["dripRadius"] * 0.6)
    st.parent = root
    return st


def _animated(fn):
    """Run an animation builder and return every ID it gave an action to."""
    before = {id(a) for a in bpy.data.actions}
    fn()
    owners = []
    for ob in bpy.data.objects:
        for owner in (ob, getattr(getattr(ob, "data", None), "shape_keys", None)):
            ad = getattr(owner, "animation_data", None) if owner else None
            if ad and ad.action and id(ad.action) not in before and owner not in owners:
                owners.append(owner)
    return owners


def _rest_pose(root, pieces, info, membrane, drips, strands, puddle, baby):
    """The static pose the GLB nodes carry: the intact egg before `stir`."""
    from mathutils import Euler, Quaternion, Vector

    root.rotation_euler = Euler((0, 0, 0))
    by = {i["name"]: i for i in info}
    for ob in pieces:
        ob.rotation_quaternion = Quaternion()
        ob.location = Vector(by[ob.name].get("hinge", (0, 0, 0)))
    membrane.scale = (1, 1, 1)
    for owner in [membrane, *drips, *strands, puddle]:
        for kb in owner.data.shape_keys.key_blocks[1:]:
            kb.value = 0.0
    for st in strands:
        st.scale = (1, 1, 1)
    baby["body"].location = (0, 0, 0.012)
    baby["body"].rotation_euler = Euler((0, 0, 0))
    baby["body"].scale = (1, 1, 1)
    baby["head"].rotation_euler = Euler((0, 0, 0))
    for e in baby["eyes"]:
        e.scale = (1, 1, 1)


CLIPS = ("egg_idle", "hatch", "attention_lean_in", "attention_hesitate")


def _claim_clip_names():
    """glTF animation names come from action names. If an action we didn't make
    holds a clip name, park it under a temporary name for the export (and give
    ours the plain name); `_release` puts every name back."""
    parked, ours = [], []
    for clip in CLIPS:
        other = bpy.data.actions.get(clip)
        if other is not None and not other.get(common.TAG):
            other.name = f"{clip}__parked_by_hatch_export"
            parked.append((other, clip))
        mine = next((a for a in bpy.data.actions if a.get(common.TAG) and (a.name == clip or a.name.startswith(clip + "."))), None)
        if mine is not None and mine.name != clip:
            ours.append((mine, mine.name))
            mine.name = clip
    return parked, ours


def _release(parked, ours):
    for mine, old in ours:
        mine.name = old
    for other, clip in parked:
        other.name = clip


def _export(scene, path):
    parked, ours = _claim_clip_names()
    try:
        _export_now(scene, path)
    finally:
        _release(parked, ours)


def _export_now(scene, path):
    win = bpy.context.window
    with bpy.context.temp_override(window=win, scene=scene):
        for ob in scene.objects:
            ob.select_set(ob.users_collection[0].name != "Lookdev" and ob.name != "Egg_Source")
        bpy.ops.export_scene.gltf(
            filepath=path, export_format="GLB", use_selection=True, export_apply=True,
            export_yup=True, export_animations=True, export_animation_mode="ACTIONS",
            export_force_sampling=True, export_frame_step=1, export_morph=True, export_morph_normal=False,
            export_cameras=False, export_lights=False, export_image_format="AUTO", export_extras=True,
        )


def _write_manifest(m, report, out_dir):
    fps = m["timing"]["fps"]
    out = dict(m)
    out["runtime"] = {
        "glb": os.path.basename(report["glb"]),
        "coordinates": "glTF Y-up, metres, egg base at origin, Caller faces -Z",
        "clipMap": {"idle": "egg_idle", "hatch": "hatch", "leanIn": "attention_lean_in", "hesitate": "attention_hesitate"},
        "phaseSeconds": {k: [a / fps, b / fps] for k, (a, b) in report["frames"].items()},
        "crackBeatSeconds": [b / fps for b in report["beats"]],
        "shellPieceNames": [i["name"] for i in report["pieces"]],
        "crackOrder": report["crackers"],
        "babyLanding": [round(x, 4) for x in report["landing"]],
        "glbBytes": report["glbBytes"],
    }
    with open(os.path.join(out_dir, "hatch.manifest.json"), "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    path = argv[0] if argv else os.path.join(os.path.dirname(__file__), "manifests", "metro-egg.json")
    if not os.path.isabs(path):
        path = os.path.join(os.path.dirname(__file__), path) if os.path.exists(os.path.join(os.path.dirname(__file__), path)) else os.path.abspath(path)
    print("@@JSON@@" + json.dumps(run(path), default=str))
