import type * as THREE from 'three';

/**
 * Closes the tears a shape key opens along UV seams.
 *
 * A glTF mesh splits a vertex wherever its UVs split: two vertices at one
 * bind position and skin, two texture coordinates. A shape
 * key must move both copies alike or the surface tears there. Squeaklet's
 * mouthClose moves one copy and not the other at 15 seams beside the mouth
 * (gaps of 3.9 to 11.6 mm on a 680 mm model), and the rig holds mouthClose
 * at 1 for the whole life of the stage (MON_MOUTHS rest), so the tears are
 * always open and read as cracks.
 *
 * Only true seam copies are joined: vertices that share bind position and
 * skin but each carry their own UV. Coincident vertices with one UV are
 * separate surfaces the exporter kept apart on purpose (each Mon's eyelid
 * primitive has 256 of them, which the lid shape keys move apart), so a
 * group in which two members share a UV is left alone.
 *
 * In each seam group, each morph target's delta becomes the largest delta in
 * the group: the copy the shape key was sculpted on wins, so the mouth still
 * shuts the full way. Morph normals follow the same source vertex. Returns
 * how many vertices changed.
 * Run once per geometry, before the parse is cloned.
 */
export function weldMorphSeams(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const targets = geometry.morphAttributes.position as THREE.BufferAttribute[] | undefined;
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!position || !uv || !targets?.length) return 0;
  const normals = geometry.morphAttributes.normal as THREE.BufferAttribute[] | undefined;
  const skinIndex = geometry.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const skinWeight = geometry.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
  const relative = geometry.morphTargetsRelative;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;

  const found = new Map<string, number[]>();
  for (let i = 0; i < position.count; i++) {
    let key = `${position.getX(i)},${position.getY(i)},${position.getZ(i)}`;
    if (skinIndex && skinWeight) {
      for (let c = 0; c < 4; c++) key += `|${skinIndex.getComponent(i, c)}:${skinWeight.getComponent(i, c)}`;
    }
    const group = found.get(key);
    if (group) group.push(i);
    else found.set(key, [i]);
  }
  const groups = [...found.values()].filter((group) => {
    if (group.length < 2) return false;
    const uvs = new Set(group.map((i) => `${uv.getX(i)},${uv.getY(i)}`));
    return uvs.size === group.length;
  });

  const changed = new Set<number>();
  const delta = (attr: THREE.BufferAttribute, base: THREE.BufferAttribute | undefined, i: number, c: number) =>
    attr.getComponent(i, c) - (relative || !base ? 0 : base.getComponent(i, c));

  targets.forEach((target, t) => {
    const targetNormal = normals?.[t];
    let touched = false;
    for (const group of groups) {
      let source = group[0]!;
      let best = -1;
      for (const i of group) {
        const d = Math.hypot(delta(target, position, i, 0), delta(target, position, i, 1), delta(target, position, i, 2));
        if (d > best) {
          best = d;
          source = i;
        }
      }
      for (const i of group) {
        if (i === source) continue;
        let moved = false;
        for (let c = 0; c < 3; c++) {
          const want = delta(target, position, source, c);
          if (Math.abs(delta(target, position, i, c) - want) > 1e-7) {
            target.setComponent(i, c, want + (relative ? 0 : position.getComponent(i, c)));
            moved = true;
          }
          if (targetNormal) {
            targetNormal.setComponent(i, c, delta(targetNormal, normal, source, c) + (relative || !normal ? 0 : normal.getComponent(i, c)));
          }
        }
        if (moved) {
          changed.add(i);
          touched = true;
        }
      }
    }
    if (touched) {
      target.needsUpdate = true;
      if (targetNormal) targetNormal.needsUpdate = true;
    }
  });
  return changed.size;
}

/** {@link weldMorphSeams} for every mesh under `root`, each shared geometry once. Returns the vertices changed. */
export function weldSceneMorphSeams(root: THREE.Object3D): number {
  const seen = new Set<THREE.BufferGeometry>();
  let changed = 0;
  root.traverse((o) => {
    const geometry = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry : undefined;
    if (!geometry || seen.has(geometry)) return;
    seen.add(geometry);
    changed += weldMorphSeams(geometry);
  });
  return changed;
}
