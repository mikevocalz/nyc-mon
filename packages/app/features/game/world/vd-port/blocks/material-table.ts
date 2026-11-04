import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

/** One descriptor/variant per row; columns are RGBA texels, never filtered material parameters. */
export interface MaterialTableData {
  name: string;
  columns: number;
  rows: number;
  values: Float32Array;
}

export interface ParameterField {
  name: string;
  size: 1 | 2 | 3 | 4;
}

/** One aligned texel per declared field keeps the bake and shader offsets explicit and versionable. */
export function packParameterRows(
  name: string,
  fields: readonly ParameterField[],
  rows: readonly Readonly<Record<string, number | readonly number[]>>[],
): MaterialTableData {
  if (!fields.length || !rows.length) throw new Error(`${name}: empty parameter layout`);
  const names = new Set<string>();
  for (const field of fields) {
    if (!field.name || names.has(field.name) || !Number.isInteger(field.size) || field.size < 1 || field.size > 4) {
      throw new Error(`${name}: invalid parameter field ${field.name}`);
    }
    names.add(field.name);
  }
  const values = new Float32Array(fields.length * rows.length * 4);
  for (let row = 0; row < rows.length; row++) for (let column = 0; column < fields.length; column++) {
    const field = fields[column]!, raw = rows[row]![field.name];
    const vector = typeof raw === 'number' ? [raw] : raw;
    if (!vector || vector.length !== field.size || vector.some((v) => !Number.isFinite(v))) {
      throw new Error(`${name}: row ${row} parameter ${field.name} is missing or malformed`);
    }
    const offset = (row * fields.length + column) * 4;
    values.set(vector, offset);
    for (let c = 0; c < vector.length; c++) if (!Number.isFinite(values[offset + c])) {
      throw new Error(`${name}: row ${row} parameter ${field.name} exceeds Float32`);
    }
  }
  return { name, columns: fields.length, rows: rows.length, values };
}

/**
 * A table belongs to one scene's material bank, not to the materials referencing it.
 * Float32 preserves authored HDR factors and exact integer addresses below 2^24.
 */
export function createMaterialTable(THREE: Three, data: MaterialTableData) {
  const { columns, rows, values, name } = data;
  if (!Number.isSafeInteger(columns) || columns < 1 || !Number.isSafeInteger(rows) || rows < 1 || rows > 0x1000000) {
    throw new Error(`${name}: invalid material table dimensions ${columns} x ${rows}`);
  }
  if (values.length !== columns * rows * 4) throw new Error(`${name}: material table length mismatch`);
  for (const value of values) if (!Number.isFinite(value)) throw new Error(`${name}: non-finite material parameter`);
  const texture = new THREE.DataTexture(values, columns, rows, THREE.RGBAFormat, THREE.FloatType);
  texture.name = name;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  let disposed = false;
  return {
    texture,
    bytes: values.byteLength,
    /** Row must be a flat material/variant ID varying, already bounds-checked by the codec. */
    texel(row: Node<'float'>, column: number): Node<'vec4'> {
      if (disposed) throw new Error(`${name}: material table is disposed`);
      if (!Number.isInteger(column) || column < 0 || column >= columns) throw new Error(`${name}: invalid parameter column ${column}`);
      const { textureLoad, ivec2, int } = THREE.TSL;
      return textureLoad(texture, ivec2(column, int(row))) as Node<'vec4'>;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      texture.dispose();
    },
  };
}
