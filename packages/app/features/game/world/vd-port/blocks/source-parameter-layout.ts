import type { ParameterField } from './material-table.ts';

/** Shared base source fields consumed by the actual FK/PBR/SG factories. */
export const SOURCE_BASE_PARAMETER_FIELDS: readonly ParameterField[] = [
  { name: 'diffuse', size: 3 }, { name: 'emissive', size: 3 },
  ...['emissiveIntensity', 'opacity', 'roughness', 'metalness', 'alphaTest', 'envMapIntensity'].map((name) => ({ name, size: 1 as const })),
];

/** Global variants use this union; unused channels are padding, never substitute source shader inputs. */
export const SOURCE_VARIANT_PARAMETER_FIELDS: readonly ParameterField[] = [
  { name: 'fkTr', size: 3 }, { name: 'pgBody', size: 4 }, { name: 'sgRect', size: 4 }, { name: 'sgBg', size: 3 },
  { name: 'sgFg', size: 3 }, { name: 'sgLamp', size: 3 }, { name: 'sgP', size: 4 }, { name: 'sgF', size: 4 },
  { name: 'instanceColor', size: 3 }, { name: 'frameRow', size: 1 },
];

/** Original object/instance and scene frames share table columns; no additional vertex buffer. */
export const SOURCE_PILOT_FRAME_FIELDS: readonly ParameterField[] = [
  { name: 'baseY', size: 1 }, { name: 'curb', size: 1 }, { name: 'affine', size: 4 },
  { name: 'isInstanced', size: 1 }, { name: 'instanceTranslationXZ', size: 2 },
  ...['combined','inverseCombined','meshWorld','instanceMatrix','localToScene'].flatMap(prefix => [0,1,2,3].map(column => ({ name: `${prefix}${column}`, size: 4 as const }))),
];
