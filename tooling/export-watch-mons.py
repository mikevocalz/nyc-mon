"""Convert approved glTF Mon sources into bounded native Watch assets.

Run with Blender --background --python tooling/export-watch-mons.py -- INPUT_DIR OUTPUT_DIR.
Source files remain untouched. Watch renders one model at a time, at 20 fps.
"""
import bpy
import hashlib
import json
import pathlib
import sys

source, output = map(pathlib.Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
reports = []
for name in ('squeaklet', 'lil-ratti'):
    scene = bpy.data.scenes.new(f'NYCMON_Watch_{name}')
    bpy.context.window.scene = scene
    asset = source / f'{name}.glb'
    existing_images = set(bpy.data.images)
    bpy.ops.import_scene.gltf(filepath=str(asset))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    triangles = sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes)
    # A bounded, static Watch LOD; preserve the source rig and all source files.
    # Bake the evaluated pose before reduction, never decimate the deforming source.
    ratio = min(1.0, 60000 / max(1, triangles))
    for obj in meshes:
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        baked = bpy.data.meshes.new_from_object(evaluated, depsgraph=bpy.context.evaluated_depsgraph_get())
        obj.modifiers.clear()
        obj.data = baked
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
        if ratio < 1:
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new('WatchLOD', 'DECIMATE')
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    lod_triangles = sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes)
    if lod_triangles > 64000:
        raise RuntimeError(f'{name}: LOD {lod_triangles} exceeds 64000 triangles')
    images = []
    for image in set(bpy.data.images) - existing_images:
        if image.size[0] == 0:
            continue
        original = list(image.size)
        if max(original) > 512:
            ratio = 512 / max(original)
            image.scale(max(1, round(original[0] * ratio)), max(1, round(original[1] * ratio)))
        image.pack()
        images.append({'name': image.name, 'source': original, 'watch': list(image.size)})
    bpy.context.scene.frame_set(1)
    target = output / f'{name}.usdz'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    bpy.ops.wm.usd_export(filepath=str(target), export_animation=False, selected_objects_only=True,
                          export_materials=True,
                          generate_preview_surface=True, export_armatures=False,
                          export_shapekeys=False, convert_orientation=True,
                          export_global_up_selection='Y', export_global_forward_selection='NEGATIVE_Z')
    reports.append({'name': name, 'sourceSHA256': hashlib.sha256(asset.read_bytes()).hexdigest(),
                    'outputSHA256': hashlib.sha256(target.read_bytes()).hexdigest(),
                    'sourceTriangles': triangles, 'triangles': lod_triangles, 'meshes': len(meshes), 'images': images,
                    'bytes': target.stat().st_size})
(output / 'validation.json').write_text(json.dumps(reports, indent=2) + '\n')
