"""Goo, the glowing inner membrane, and the puddle, as exportable morph targets.

Fluid and particle sims don't survive glTF, so goo is authored as meshes whose
growth is baked into shape keys (glTF morph targets):

- Drips: a tube that follows the shell surface down from a crack lip. Keys
  `Bead`, `Ooze_1..3` grow it in stages, each stage hugging the surface.
- Strands: a tube from the cup lip to a point on a shard's edge. Keys
  `Stretch_1..3` follow the shard as it tips open (thinning in the middle),
  `Snap` pulls each half back into a bead on its own side.
- Puddle: a flat irregular disc under the egg; `Spread` grows it.
- Membrane: a slightly smaller copy of the shell with an emissive warm
  material that shows through the cracks; `Pulse` and `Press` bulge it.

Small falling droplets are left to the runtime (pooled TypeGPU effect).
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector, noise
from mathutils.bvhtree import BVHTree

from common import material, rng


def goo_material(profile):
    c = profile["color"]
    return material("M_Goo", c[:3], roughness=0.08, emission=profile["emissiveFleck"], emission_strength=0.6, alpha=c[3])


def membrane(egg, col, glow, inset=0.9, rings=24, segments=32):
    """A smooth inner membrane fitted to the shell's own profile.

    Each height slice takes a low percentile of the shell's radius, so fur,
    bumps and studs on the outside never inflate it, then insets it. A copy of
    the shell (decimated to a budget) poked through the crown of the furry
    Corner Egg; a lathe of the profile can't.
    """
    co = np.empty(len(egg.data.vertices) * 3)
    egg.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    height = co[:, 2].max()
    radius = np.hypot(co[:, 0], co[:, 1])
    edges = np.linspace(0, height, 41)
    prof = []
    for a, b in zip(edges[:-1], edges[1:]):
        sel = radius[(co[:, 2] >= a) & (co[:, 2] < b)]
        prof.append(np.percentile(sel, 20) if len(sel) else 0.0)
    prof = np.convolve(np.asarray(prof), np.ones(3) / 3, mode="same")
    zc = (edges[:-1] + edges[1:]) / 2

    verts, faces = [], []
    lo, hi = height * 0.06, height * 0.94
    for i in range(rings + 1):
        z = lo + (hi - lo) * i / rings
        r = max(np.interp(z, zc, prof) * inset, 0.0005)
        r *= math.sin(math.pi * (0.04 + 0.92 * i / rings)) ** 0.25  # round the poles shut
        for j in range(segments):
            a = 2 * math.pi * j / segments
            verts.append((math.cos(a) * r, math.sin(a) * r, z))
    for i in range(rings):
        for j in range(segments):
            a, b = i * segments + j, i * segments + (j + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    verts += [(0, 0, lo - 0.002), (0, 0, hi + 0.002)]
    bot, top = len(verts) - 2, len(verts) - 1
    for j in range(segments):
        faces.append((bot, (j + 1) % segments, j))
        faces.append((top, rings * segments + j, rings * segments + (j + 1) % segments))
    me = bpy.data.meshes.new("Membrane")
    me.from_pydata(verts, [], faces)
    me.shade_smooth()
    me.materials.append(material("M_Membrane", (0.95, 0.55, 0.35), roughness=0.4, emission=glow, emission_strength=4.0))
    ob = bpy.data.objects.new("Membrane", me)
    col.objects.link(ob)
    centre = Vector((0, 0, height / 2))
    ob.shape_key_add(name="Basis")
    pulse = ob.shape_key_add(name="Pulse")
    for kp, v in zip(pulse.data, me.vertices):
        kp.co = (v.co - centre) * 1.035 + centre
    return ob


def add_press(ob, at):
    """Localised outward bulge where the first crack will open."""
    co = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    centre = np.array([0, 0, 0.076])
    d = np.linalg.norm(co - np.asarray(at), axis=1)
    w = np.exp(-(d / 0.025) ** 2)[:, None]
    push = (co - centre) / np.linalg.norm(co - centre, axis=1, keepdims=True)
    key = ob.shape_key_add(name="Press")
    key.data.foreach_set("co", (co + push * w * 0.006).ravel())


def _surface(egg):
    bm = bmesh.new()
    bm.from_mesh(egg.data)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    return tree


def _on_shell(tree, azimuth, z, lift):
    """Point on the shell surface at this height and azimuth, pushed out by `lift`."""
    d = Vector((math.cos(azimuth), math.sin(azimuth), 0))
    hit, normal, _, _ = tree.ray_cast(Vector((0, 0, z)) + d * 0.3, -d)
    if hit is None:
        return None
    return hit + normal * lift


def _ring_tube(name, paths, radii, sides=8):
    """One mesh whose shape keys each move the same rings along a different path.

    `paths[k][i]` is ring i's centre for key k (k = 0 is the basis) and
    `radii[k][i]` its radius. Rings face along the local path direction.
    """
    n = len(paths[0])
    verts = []
    for i in range(n):
        for s in range(sides):
            verts.append((0.0, 0.0, 0.0))
    faces = []
    for i in range(n - 1):
        for s in range(sides):
            a, b = i * sides + s, i * sides + (s + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(range(sides))[::-1])
    faces.append(tuple(range((n - 1) * sides, n * sides)))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    ob = bpy.data.objects.new(name, me)
    for k, (path, rad) in enumerate(zip(paths, radii)):
        co = []
        for i in range(n):
            p = Vector(path[i])
            t = Vector(path[min(i + 1, n - 1)]) - Vector(path[max(i - 1, 0)])
            if t.length < 1e-7:
                t = Vector((0, 0, -1))
            t.normalize()
            u = t.orthogonal().normalized()
            v = t.cross(u)
            for s in range(sides):
                a = 2 * math.pi * s / sides
                co.append(p + (u * math.cos(a) + v * math.sin(a)) * rad[i])
        if k == 0:
            for vtx, c in zip(me.vertices, co):
                vtx.co = c
            ob.shape_key_add(name="Basis")
        else:
            key = ob.shape_key_add(name=KEY_NAMES[name.split("_")[1]][k - 1])
            for kp, c in zip(key.data, co):
                kp.co = c
    me.shade_smooth()
    return ob


KEY_NAMES = {
    "Drip": ["Bead", "Ooze_1", "Ooze_2", "Ooze_3"],
    "Strand": ["Stretch_1", "Stretch_2", "Stretch_3", "Snap"],
}


def drip(egg, col, mat, index, azimuth, z_lip, radius, rings=18):
    tree = _surface(egg)
    full = []
    for i in range(rings):
        z = z_lip - (z_lip - 0.006) * (i / (rings - 1)) ** 1.15
        p = _on_shell(tree, azimuth + 0.04 * math.sin(i * 0.9), z, radius * 0.7)
        full.append(p if p is not None else full[-1])
    lip = full[0]

    def staged(frac, bead):
        n = len(full)
        reach = frac * (n - 1)
        path = [full[min(i, int(reach))] if i <= reach else full[int(reach)] for i in range(n)]
        rad = [radius * (0.7 + 0.5 * (i / n)) if i <= reach else radius * 0.2 for i in range(n)]
        if reach < n - 1:  # heavier bead at the leading tip
            tip = int(reach)
            rad[tip] = radius * 1.6
        if bead:
            rad = [radius * 1.3 if i == 0 else 0.0002 for i in range(n)]
        return path, rad

    basis = ([lip] * rings, [0.0002] * rings)
    stages = [staged(0, True), staged(0.3, False), staged(0.65, False), staged(1.0, False)]
    ob = _ring_tube(f"Goo_Drip_{index:02d}", [basis[0]] + [s[0] for s in stages], [basis[1]] + [s[1] for s in stages])
    ob.data.materials.append(mat)
    col.objects.link(ob)
    return ob


def strand(col, mat, index, anchor, shard_point_at, radius, rings=12):
    """`shard_point_at(t)` gives the shard-edge end at opening fraction t."""
    def line(a, b, thin):
        path = [a.lerp(b, i / (rings - 1)) for i in range(rings)]
        sag = (b - a).length * 0.18
        path = [p - Vector((0, 0, sag * math.sin(math.pi * i / (rings - 1)))) for i, p in enumerate(path)]
        rad = [radius * (1 - thin * math.sin(math.pi * i / (rings - 1))) for i in range(rings)]
        return path, rad

    a = Vector(anchor)
    stretches = [line(a, shard_point_at(t), thin) for t, thin in ((0.33, 0.3), (0.66, 0.55), (1.0, 0.8))]
    b = shard_point_at(1.0)
    snap_path = [a.lerp(a + (b - a) * 0.15, i / (rings // 2 - 1)) for i in range(rings // 2)] + \
                [b.lerp(b + (a - b) * 0.15, (rings - rings // 2 - 1 - i) / (rings - rings // 2 - 1)) for i in range(rings - rings // 2)]
    snap_rad = [radius * (1.4 if i in (0, rings - 1) else 0.6) for i in range(rings)]
    paths = [[a] * rings] + [s[0] for s in stretches] + [snap_path]
    radii = [[radius] * rings] + [s[1] for s in stretches] + [snap_rad]
    ob = _ring_tube(f"Goo_Strand_{index:02d}", paths, radii)
    ob.data.materials.append(mat)
    col.objects.link(ob)
    return ob


def puddle(col, mat, manifest, radius, segments=48):
    r = rng(manifest, "puddle")
    seed = r.uniform(0, 100)
    verts = [(0.0, 0.0, 0.0004)]
    for ring in (0.5, 1.0):
        for s in range(segments):
            a = 2 * math.pi * s / segments
            verts.append((math.cos(a) * 0.002 * ring, math.sin(a) * 0.002 * ring, 0.0004))
    faces = [(0, 1 + s, 1 + (s + 1) % segments) for s in range(segments)]
    for s in range(segments):
        a, b = 1 + s, 1 + (s + 1) % segments
        faces.append((a, a + segments, b + segments, b))
    me = bpy.data.meshes.new("Goo_Puddle")
    me.from_pydata(verts, [], faces)
    ob = bpy.data.objects.new("Goo_Puddle", me)
    ob.shape_key_add(name="Basis")
    spread = ob.shape_key_add(name="Spread")
    for i, kp in enumerate(spread.data):
        if i == 0:
            continue
        ring = 0.55 if i <= segments else 1.0
        a = 2 * math.pi * ((i - 1) % segments) / segments
        wob = 1 + 0.22 * noise.noise(Vector((math.cos(a) * 2 + seed, math.sin(a) * 2, 0)))
        rr = radius * ring * wob
        # Offset toward the front so the pool reads from the Caller's side.
        kp.co = Vector((math.cos(a) * rr, math.sin(a) * rr - 0.01, 0.0004 if ring == 1.0 else 0.0008))
    me.materials.append(mat)
    col.objects.link(ob)
    return ob
