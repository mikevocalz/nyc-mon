import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { createMaterialTable, packParameterRows, type ParameterField } from './material-table.ts';
import { sourceParameterBinding } from './source-bindings.ts';

export type ParameterRow = Readonly<Record<string, number | readonly number[]>>;
export interface ParameterFamily {
  id: number;
  fields: readonly ParameterField[];
  /** Global material IDs, with their exact source-derived parameter values. */
  materials: readonly { id: number; values: ParameterRow }[];
}

/** Compact family tables share one global-ID lookup, so descriptors are never duplicated per seed/window. */
export function createSurfaceParameters(THREE: Three, input: {
  materialCount: number;
  families: readonly ParameterFamily[];
  variantFields: readonly ParameterField[];
  variants: readonly ParameterRow[];
  frameFields: readonly ParameterField[];
  frames: readonly ParameterRow[];
}) {
  if (!Number.isSafeInteger(input.materialCount) || input.materialCount < 1) throw new Error('Invalid surface material count');
  const owned: ReturnType<typeof createMaterialTable>[] = [];
  try {
    const lookupValues = new Float32Array(input.materialCount * 4);
    const assigned = new Set<number>(), familyTables = new Map<number, { fields: readonly ParameterField[]; table: ReturnType<typeof createMaterialTable> }>();
    for (const family of input.families) {
      if (!Number.isSafeInteger(family.id) || family.id < 0 || family.id >= 2 ** 24 || familyTables.has(family.id)) throw new Error('Invalid surface family ID');
      for (let row = 0; row < family.materials.length; row++) {
        const material = family.materials[row]!;
        if (!Number.isSafeInteger(material.id) || material.id < 0 || material.id >= input.materialCount || assigned.has(material.id)) throw new Error('Invalid or duplicate global material ID');
        assigned.add(material.id);
        lookupValues[material.id * 4] = family.id;
        lookupValues[material.id * 4 + 1] = row;
      }
      const table = createMaterialTable(THREE, packParameterRows(`vd:surface-family-${family.id}`, family.fields, family.materials.map((material) => material.values)));
      owned.push(table); familyTables.set(family.id, { fields: family.fields, table });
    }
    if (assigned.size !== input.materialCount) throw new Error('Surface family tables do not cover every material');
    const lookup = createMaterialTable(THREE, { name: 'vd:surface-material-address', columns: 1, rows: input.materialCount, values: lookupValues });
    owned.push(lookup);
    const variants = createMaterialTable(THREE, packParameterRows('vd:surface-variants', input.variantFields, input.variants));
    owned.push(variants);
    const frames = createMaterialTable(THREE, packParameterRows('vd:surface-frames', input.frameFields, input.frames));
    owned.push(frames);
    let disposed = false;
    const requireLive = () => { if (disposed) throw new Error('Surface parameter bank is disposed'); };
    return {
      bytes: owned.reduce((n, table) => n + table.bytes, 0),
      material(familyId: number, globalMaterial: Node<'float'>) {
        requireLive();
        const family = familyTables.get(familyId);
        if (!family) throw new Error(`Unbound authored surface family ${familyId}`);
        const local = lookup.texel(globalMaterial, 0).y;
        return sourceParameterBinding(family.table, family.fields, local);
      },
      variant(globalVariant: Node<'float'>) {
        requireLive(); return sourceParameterBinding(variants, input.variantFields, globalVariant);
      },
      frame(frameRow: Node<'float'>) {
        requireLive(); return sourceParameterBinding(frames, input.frameFields, frameRow);
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const table of owned) table.dispose();
      },
    };
  } catch (error) {
    for (const table of owned) table.dispose();
    throw error;
  }
}
