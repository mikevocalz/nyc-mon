"""Split the creator's egg shell into real crackable pieces.

The shell surface is cut along a noisy waistline into a cup and a set of cap
shards (a noisy Voronoi over directions from the egg's centre). Each piece
keeps the original UVs and texture, so decoration carries onto the shards,
then gets real thickness: a solidify with rim faces that use a subdued inner
material. Pieces are pivoted on a hinge at their lowest boundary so they can
tip open, and each shard's resting angle is solved against the ground plane.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector, noise

from common import deg, link, material, rng


def import_egg(path, col):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"expected one egg mesh in {path}, got {len(meshes)}")
    egg = meshes[0]
    egg.data.transform(egg.matrix_world)
    egg.matrix_world = Matrix.Identity(4)
    for o in new:
        if o is not egg:
            bpy.data.objects.remove(o, do_unlink=True)
    egg.name = egg.data.name = "Egg_Source"
    link(col, egg)
    # Rest the egg on the ground at the origin.
    co = np.empty(len(egg.data.vertices) * 3)
    egg.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    shift = Vector((-(co[:, 0].min() + co[:, 0].max()) / 2, -(co[:, 1].min() + co[:, 1].max()) / 2, -co[:, 2].min()))
    egg.data.transform(Matrix.Translation(shift))
    _weld(egg)
    return egg


def decimate(ob, max_tris):
    """Collapse-decimate to a triangle budget (UV seams are kept by the modifier)."""
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris <= max_tris:
        return tris
    mod = ob.modifiers.new("Budget", "DECIMATE")
    mod.ratio = max_tris / tris
    dg = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.remove(mod)
    ob.data = baked
    baked.name = old.name
    bpy.data.meshes.remove(old)
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def _drop_scraps(bm, keep_min=50):
    """Remove tiny disconnected pieces (a stray triangle inside the Bodega egg
    became a floating spike on its crown shard)."""
    seen, scraps = set(), []
    for v in bm.verts:
        if v in seen:
            continue
        comp, stack = [], [v]
        seen.add(v)
        while stack:
            x = stack.pop()
            comp.append(x)
            for e in x.link_edges:
                o = e.other_vert(x)
                if o not in seen:
                    seen.add(o)
                    stack.append(o)
        if len(comp) < keep_min:
            scraps.extend(comp)
    if scraps:
        bmesh.ops.delete(bm, geom=scraps, context="VERTS")


def _cap_pole_holes(bm):
    """Close small holes on the egg's axis (some exports leave the poles open).
    Left open, the shell thickness turns the hole's rim into a white spike.
    Open edges away from the axis, such as fur cards, are left alone."""
    boundary = {e for e in bm.edges if e.is_boundary}
    while boundary:
        loop, stack = set(), [boundary.pop()]
        while stack:
            e = stack.pop()
            loop.add(e)
            for v in e.verts:
                for e2 in v.link_edges:
                    if e2 in boundary:
                        boundary.discard(e2)
                        stack.append(e2)
        verts = {v for e in loop for v in e.verts}
        cx = sum(v.co.x for v in verts) / len(verts)
        cy = sum(v.co.y for v in verts) / len(verts)
        if len(loop) <= 64 and (cx * cx + cy * cy) ** 0.5 < 0.008:
            bmesh.ops.holes_fill(bm, edges=list(loop), sides=len(loop))


def _weld(egg):
    """glTF import splits vertices along UV seams, which leaves the shell full of
    open edges. Merge them (UVs live on loops, so the texture is unchanged),
    drop the imported split normals and shade smooth, so the shell is closed."""
    me = egg.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    # Some exports pack a dense fan of tiny triangles at the poles; their
    # normals disagree and the inward thickness folds out of the shell there.
    top = max(v.co.z for v in bm.verts)
    poles = [v for v in bm.verts if (v.co.x ** 2 + v.co.y ** 2) ** 0.5 < 0.004 and (v.co.z > top - 0.003 or v.co.z < 0.003)]
    bmesh.ops.remove_doubles(bm, verts=poles, dist=0.0012)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=bm.edges)
    _drop_scraps(bm)
    _cap_pole_holes(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    with bpy.context.temp_override(object=egg, active_object=egg, selected_objects=[egg]):
        if me.has_custom_normals:
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
    me.shade_smooth()
    me.update()


def _srgb_to_linear(hexcolor):
    rgb = [int(hexcolor.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in rgb]


def _face_cells(egg, manifest):
    fr = manifest["fracture"]
    r = rng(manifest, "fracture")
    me = egg.data
    n = len(me.polygons)
    centers = np.empty(n * 3)
    me.polygons.foreach_get("center", centers)
    centers = centers.reshape(-1, 3)
    height = centers[:, 2].max()
    mid = np.array([0.0, 0.0, height * 0.55])

    # Seeds: one crown shard plus a ring around the shoulder.
    k = fr["capShards"]
    seeds = [np.array([0.0, 0.0, 1.0])]
    start = r.uniform(0, 2 * math.pi)
    for i in range(k - 1):
        az = start + i * 2 * math.pi / (k - 1) + r.uniform(-0.25, 0.25)
        el = deg(r.uniform(18, 32))
        seeds.append(np.array([math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)]))
    seeds = np.array(seeds)

    s1, s2 = r.uniform(0, 6.28), r.uniform(0, 6.28)
    theta = np.arctan2(centers[:, 1], centers[:, 0])
    rel_h = centers[:, 2] / height
    fine = np.array([noise.noise(Vector(c) * 90.0) for c in centers])
    waist = fr["waist"] + fr["waistWobble"] * (0.6 * np.sin(3 * theta + s1) + 0.4 * np.sin(5 * theta + s2)) + 0.012 * fine

    d = centers - mid
    d /= np.linalg.norm(d, axis=1, keepdims=True)
    coarse = np.array([noise.noise(Vector(c) * 45.0) for c in centers])
    dist = 1.0 - d @ seeds.T + fr["edgeNoise"] * coarse[:, None] * 0.5
    cells = np.argmin(dist, axis=1)
    cells[rel_h < waist] = -1
    return _clean_cells(me, cells), seeds


def _clean_cells(me, cells):
    """Majority-filter stray faces and fold small islands into a neighbour, so no
    shard has floating crumbs."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    neighbours = [[f2.index for e in f.edges for f2 in e.link_faces if f2 is not f] for f in bm.faces]
    for _ in range(3):
        nxt = cells.copy()
        for i, nb in enumerate(neighbours):
            if nb:
                vals, counts = np.unique(cells[nb], return_counts=True)
                if counts.max() * 2 > len(nb) and vals[counts.argmax()] != cells[i]:
                    nxt[i] = vals[counts.argmax()]
        cells = nxt
    for cell in np.unique(cells):
        idx = set(np.flatnonzero(cells == cell).tolist())
        comps = []
        while idx:
            stack, comp = [idx.pop()], []
            while stack:
                f = stack.pop()
                comp.append(f)
                for g in neighbours[f]:
                    if g in idx:
                        idx.remove(g)
                        stack.append(g)
            comps.append(comp)
        comps.sort(key=len, reverse=True)
        for comp in comps[1:]:
            for f in comp:
                others = [cells[g] for g in neighbours[f] if cells[g] != cell]
                if others:
                    cells[f] = max(set(others), key=others.count)
    bm.free()
    return cells


def _piece(egg, faces, name, col):
    me = egg.data.copy()
    me.name = name
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    keep = set(faces)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context="FACES")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


def _solidify(ob, thickness, inner, rim):
    ob.data.materials.append(inner)
    ob.data.materials.append(rim)
    base = len(ob.data.materials) - 3
    mod = ob.modifiers.new("Thickness", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = -1.0
    mod.use_rim = True
    # Even offset spikes at the thin slivers decimation leaves; the clamp keeps
    # the inner wall from crossing itself at tight curvature.
    mod.use_even_offset = False
    mod.thickness_clamp = 1.0
    mod.use_quality_normals = True
    mod.material_offset = 1 - base if base else 1
    mod.material_offset_rim = 2 - base if base else 2
    dg = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.remove(mod)
    ob.data = baked
    baked.name = ob.name
    bpy.data.meshes.remove(old)


def _verts(ob):
    co = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def _set_origin(ob, p):
    ob.data.transform(Matrix.Translation(-Vector(p)))
    ob.location = Vector(p)


def _rest_pose(local, hinge, axis, tip):
    """Tip the shard outward by `tip` degrees about its hinge, then let it drop
    straight down until its lowest point rests on the ground (z = 0)."""
    rot = np.asarray(Quaternion(axis, math.radians(tip)).to_matrix())
    z = (local @ rot.T)[:, 2] + hinge[2]
    return float(-z.min())


def build(egg, manifest, col):
    fr = manifest["fracture"]
    cells, seeds = _face_cells(egg, manifest)
    # Inside of the shell and its broken edge take the egg's own colour (set per
    # egg by the creator), so a crack shows shell, not white plaster.
    c = _srgb_to_linear(fr.get("innerColorSrgb", "#D8BFB4"))
    egg_id = manifest["eggId"]
    inner = material(f"M_{egg_id}_ShellInner", c, roughness=0.9)
    edge = [min(1.0, x * 1.15 + 0.02) for x in c]
    rim = material(f"M_{egg_id}_ShellEdge", edge, roughness=0.5, emission=(1.0, 0.45, 0.15), emission_strength=0.35)

    pieces = []
    names = {-1: "Shell_Cup"}
    for i in range(len(seeds)):
        names[i] = "Shell_Crown" if i == 0 else f"Shell_Shard_{i:02d}"
    for cell in sorted(set(cells.tolist())):
        ob = _piece(egg, np.flatnonzero(cells == cell).tolist(), names[cell], col)
        _solidify(ob, fr["shellThickness"], inner, rim)
        pieces.append((cell, ob))

    info = []
    for cell, ob in pieces:
        co = _verts(ob)
        if cell == -1:
            _set_origin(ob, (0.0, 0.0, 0.0))
            info.append({"name": ob.name, "cell": -1})
            continue
        # Hinge: the lowest part of the shard's edge; it tips outward about the tangent there.
        low = co[co[:, 2] <= np.percentile(co[:, 2], 8)]
        hinge = low.mean(axis=0)
        centroid = co.mean(axis=0)
        out = Vector((centroid[0], centroid[1], 0.0))
        if out.length < 1e-4:  # crown: tip backwards, away from the camera (+Y in Blender).
            out = Vector((0.0, 1.0, 0.0))
            hinge = co[co[:, 1] >= np.percentile(co[:, 1], 95)].mean(axis=0)
        out.normalize()
        axis = Vector((0, 0, 1)).cross(out).normalized()
        _set_origin(ob, hinge)
        local = co - hinge
        tip = rng(manifest, f"tip{cell}").uniform(100, 130)
        drop = _rest_pose(local, hinge, axis, tip)
        area = sum(p.area for p in ob.data.polygons)
        info.append({"name": ob.name, "cell": int(cell), "hinge": [round(float(x), 5) for x in hinge],
                     "axis": [round(a, 5) for a in axis], "restAngle": tip, "restDrop": round(drop, 5), "area": area,
                     "azimuth": math.degrees(math.atan2(out.y, out.x))})
    egg.hide_render = True
    egg.hide_viewport = True
    return [ob for _, ob in pieces], info
