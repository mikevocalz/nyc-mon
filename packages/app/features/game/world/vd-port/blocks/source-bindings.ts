import type { Node } from 'three/webgpu';
import type { ParameterField, createMaterialTable } from './material-table.ts';

export interface SourceParameterBinding {
  scalar(name: string): Node<'float'>;
  vec2(name: string): Node<'vec2'>;
  vec3(name: string): Node<'vec3'>;
  vec4(name: string): Node<'vec4'>;
}

export interface SourceTextureBinding {
  /** Original texture UV matrix, separately from sampling (SG atlas UV deliberately bypasses it). */
  uv(name: string, rawUv: Node<'vec2'>): Node<'vec2'>;
  /** Sample an explicitly supplied UV; no second implicit matrix/flip. Missing authored pages must throw. */
  sample(name: string, uv: Node<'vec2'>, gradient?: { dx: Node<'vec2'>; dy: Node<'vec2'> }): Node<'vec4'>;
}

/** Names and dimensions must agree with the versioned bake layout; no unknown-parameter zero defaults. */
export function sourceParameterBinding(
  table: ReturnType<typeof createMaterialTable>,
  fields: readonly ParameterField[],
  row: Node<'float'>,
): SourceParameterBinding {
  const columns = new Map(fields.map((field, column) => [field.name, { ...field, column }]));
  const texel = (name: string, size: number) => {
    const field = columns.get(name);
    if (!field || field.size !== size) throw new Error(`Missing or mismatched authored parameter ${name} (${size})`);
    return table.texel(row, field.column);
  };
  return {
    scalar: (name) => texel(name, 1).x,
    vec2: (name) => texel(name, 2).xy,
    vec3: (name) => texel(name, 3).xyz,
    vec4: (name) => texel(name, 4),
  };
}
