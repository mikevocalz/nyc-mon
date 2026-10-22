"""Shared helpers for the egg hatching pipeline (Blender 5.2+, bpy).

Every step builds into its own scene, `Hatch_<eggId>`, so a live session's
open scene is never touched. Units are metres; Blender is Z-up and the glTF
exporter converts to Y-up.
"""
import json
import math
import os
import random

import bpy

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def repo_path(rel):
    return os.path.join(REPO, rel)


def load_manifest(path):
    with open(path) as f:
        return json.load(f)


def frame(manifest, seconds):
    return round(seconds * manifest["timing"]["fps"])


def rng(manifest, salt):
    """Deterministic per-egg randomness: same manifest, same egg, every build."""
    return random.Random(f"{manifest['fractureSeed']}:{salt}")


def fresh_scene(name):
    """Start an egg's scene from nothing. Object names are global in Blender and
    become glTF node names, so every earlier `Hatch_*` scene this pipeline made
    is removed first (each egg's .blend is already saved by then). Scenes the
    user made are never touched."""
    for old in [s for s in bpy.data.scenes if s.name.startswith("Hatch_")]:
        for ob in list(old.collection.all_objects):
            if ob.name != "LD_Cam" or len(ob.users_scene) == 1:
                bpy.data.objects.remove(ob, do_unlink=True)
        for col in list(old.collection.children_recursive):
            bpy.data.collections.remove(col)
        bpy.data.scenes.remove(old)
    # Free this pipeline's own leftovers so rebuilds keep clean names
    # (Shell_Cup, not Shell_Cup.027). Only unused data with our prefixes.
    ours = ("Shell_", "Goo_", "Membrane", "PROXY_", "Egg_Source", "LD_Ground")
    for coll in (bpy.data.meshes, bpy.data.lights, bpy.data.cameras):
        for data in [d for d in coll if d.users == 0 and d.name.startswith(ours + ("LD_",))]:
            coll.remove(data)
    scene = bpy.data.scenes.new(name)
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


def new_collection(scene, name):
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    return col


def link(col, ob):
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    col.objects.link(ob)
    return ob


def material(name, color, roughness=0.5, metallic=0.0, emission=None, emission_strength=0.0, alpha=1.0):
    """Principled material using only inputs the glTF exporter maps (no procedural nodes)."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color[:3], 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission[:3], 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        mat.surface_render_method = "BLENDED"
    return mat


def keys(owner, path, frames_values, interpolation="BEZIER", index=-1):
    """Insert (frame, value) keys on `owner.path`."""
    for f, v in frames_values:
        setattr(owner, path, v)
        owner.keyframe_insert(path, frame=f, index=index)
    ad = owner.animation_data if hasattr(owner, "animation_data") else None
    if ad and ad.action:
        for fc in _fcurves(ad):
            for kp in fc.keyframe_points:
                kp.interpolation = interpolation


def _fcurves(ad):
    act, slot = ad.action, ad.action_slot
    for layer in act.layers:
        for strip in layer.strips:
            cb = strip.channelbag(slot)
            if cb:
                yield from cb.fcurves


def merge_clip(owners, clip):
    """Fold each owner's freshly keyed action into one slotted action named
    after the clip (one slot per object or shape-key set), then park it on a
    muted NLA track.

    The glTF exporter's ACTIONS mode writes each action as one animation, so
    the GLB gets exactly one animation per clip. (NLA_TRACKS mode was tried
    first; in Blender 5.2 it samples shape-key tracks as flat weights.)
    """
    from bpy_extras import anim_utils

    for old in [a for a in bpy.data.actions if a.name == clip or a.name.startswith(clip + ".")]:
        bpy.data.actions.remove(old)  # a rebuild replaces the clip, never renames it clip.001
    act = bpy.data.actions.new(clip)
    act.use_fake_user = True
    # Blender 5 keys an object and its shape keys into one action with two
    # slots, so sources are removed only after every owner is merged.
    spent = set()
    for owner in owners:
        ad = owner.animation_data
        src, src_slot = ad.action, ad.action_slot
        slot = act.slots.new(id_type=src_slot.target_id_type, name=src_slot.name_display)
        cb = anim_utils.action_ensure_channelbag_for_slot(act, slot)
        for fc in anim_utils.action_get_channelbag_for_slot(src, src_slot).fcurves:
            dst = cb.fcurves.new(fc.data_path, index=fc.array_index)
            n = len(fc.keyframe_points)
            dst.keyframe_points.add(n)
            for attr in ("co", "handle_left", "handle_right"):
                buf = [0.0] * (2 * n)
                fc.keyframe_points.foreach_get(attr, buf)
                dst.keyframe_points.foreach_set(attr, buf)
            for a, b in zip(fc.keyframe_points, dst.keyframe_points):
                b.interpolation = a.interpolation
            dst.update()
        ad.action = None
        spent.add(src)
        track = ad.nla_tracks.new()
        track.name = clip
        strip = track.strips.new(clip, 0, act)
        strip.action_slot = slot
        strip.influence = 1.0
        track.mute = True
    for src in spent:
        bpy.data.actions.remove(src)
    return act


def ease(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def deg(x):
    return math.radians(x)
