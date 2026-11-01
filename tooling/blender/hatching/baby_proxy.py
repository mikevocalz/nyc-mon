"""A labeled stand-in Baby for pipeline tests.

No Baby model or rig exists in the repo yet. This proxy only proves that the
egg, goo and emergence timing line up; every object is named `PROXY_*` and
the manifest records `baby.proxy: true`, so it can never ship as the real Mon.
"""
import bmesh
import bpy
from mathutils import Matrix

from common import material


def _ellipsoid(name, radii, centre, mat):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centre) @ Matrix.Diagonal((*radii, 1.0)), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(mat)
    return bpy.data.objects.new(name, me)


def build(col):
    fur = material("M_PROXY_Fur", (0.62, 0.6, 0.58), roughness=0.8)
    eye = material("M_PROXY_Eye", (0.02, 0.02, 0.03), roughness=0.15)
    body = _ellipsoid("PROXY_Baby", (0.03, 0.028, 0.032), (0, 0, 0.032), fur)
    head = _ellipsoid("PROXY_Baby_Head", (0.024, 0.022, 0.022), (0, 0, 0), fur)
    head.parent = body
    head.location = (0, -0.004, 0.07)
    eyes = []
    for side in (-1, 1):
        e = _ellipsoid(f"PROXY_Baby_Eye_{'L' if side < 0 else 'R'}", (0.0045, 0.003, 0.006), (0, 0, 0), eye)
        e.parent = head
        e.location = (side * 0.009, -0.019, 0.004)
        eyes.append(e)
    ears = []
    for side in (-1, 1):
        ear = _ellipsoid(f"PROXY_Baby_Ear_{'L' if side < 0 else 'R'}", (0.009, 0.003, 0.011), (0, 0, 0), fur)
        ear.parent = head
        ear.location = (side * 0.016, 0.002, 0.018)
        ears.append(ear)
    for ob in [body, head, *eyes, *ears]:
        col.objects.link(ob)
        ob.rotation_mode = "XYZ"
    return {"body": body, "head": head, "eyes": eyes}
