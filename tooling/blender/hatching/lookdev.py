"""Preview renders: six orthographic views and timeline contact frames.

Lights, ground and cameras live in the `Lookdev` collection, which is never
exported. These renders are art references; the runtime check is the GLB
played back in three.js (tooling/blender/hatching/playback/).
"""
import math
import os

import bpy
from mathutils import Vector

from common import link, material, new_collection

VIEWS = {"front": (0, -1, 0), "back": (0, 1, 0), "left": (-1, 0, 0), "right": (1, 0, 0), "top": (0, 0, 1), "bottom": (0, 0, -1)}


def stage(scene, ground=True):
    col = bpy.data.collections.get("Lookdev") or new_collection(scene, "Lookdev")
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.render.film_transparent = True
    scene.world = bpy.data.worlds.get("Hatch_World") or bpy.data.worlds.new("Hatch_World")
    scene.world.color = (0.55, 0.56, 0.6)
    if not bpy.data.objects.get("LD_Key"):
        key = bpy.data.objects.new("LD_Key", bpy.data.lights.new("LD_Key", "SUN"))
        key.data.energy = 3.5
        key.rotation_euler = (math.radians(50), 0, math.radians(30))
        link(col, key)
        rim = bpy.data.objects.new("LD_Rim", bpy.data.lights.new("LD_Rim", "SUN"))
        rim.data.energy = 1.5
        rim.rotation_euler = (math.radians(-60), 0, math.radians(200))
        link(col, rim)
    if ground and not bpy.data.objects.get("LD_Ground"):
        me = bpy.data.meshes.new("LD_Ground")
        s = 0.6
        me.from_pydata([(-s, -s, -0.0003), (s, -s, -0.0003), (s, s, -0.0003), (-s, s, -0.0003)], [], [(0, 1, 2, 3)])
        g = bpy.data.objects.new("LD_Ground", me)
        g.data.materials.append(material("M_LD_Ground", (0.16, 0.17, 0.2), roughness=0.9))
        link(col, g)
    cam = bpy.data.objects.get("LD_Cam")
    if not cam:
        cam = bpy.data.objects.new("LD_Cam", bpy.data.cameras.new("LD_Cam"))
        link(col, cam)
    scene.camera = cam
    return cam


def _aim(cam, direction, target, dist):
    cam.location = Vector(direction) * dist + target
    up = "Y" if abs(direction[2]) > 0.9 else "Z"
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", up).to_euler()


def six_views(scene, out_dir, prefix, target=(0, 0, 0.076), scale=0.2):
    cam = stage(scene, ground=False)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = scale
    paths = []
    for name, d in VIEWS.items():
        _aim(cam, d, Vector(target), 0.6)
        scene.render.filepath = os.path.join(out_dir, f"{prefix}-{name}.png")
        _render(scene)
        paths.append(scene.render.filepath)
    return paths


def frames(scene, out_dir, prefix, frame_list, target=(0, -0.02, 0.06), direction=(0.35, -1, 0.45), dist=0.55):
    cam = stage(scene, ground=True)
    cam.data.type = "PERSP"
    cam.data.lens = 50
    _aim(cam, Vector(direction).normalized(), Vector(target), dist)
    paths = []
    for f in frame_list:
        scene.frame_set(f)
        scene.render.filepath = os.path.join(out_dir, f"{prefix}-f{f:03d}.png")
        _render(scene)
        paths.append(scene.render.filepath)
    return paths


def _render(scene):
    win = bpy.context.window
    if win is None:  # headless: render the scene directly
        bpy.ops.render.render(write_still=True, scene=scene.name)
        return
    prev = win.scene
    win.scene = scene
    try:
        bpy.ops.render.render(write_still=True, scene=scene.name)
    finally:
        win.scene = prev
