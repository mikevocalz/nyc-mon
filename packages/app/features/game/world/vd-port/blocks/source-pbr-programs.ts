// Pure offline/runtime shared classifier data; hashes identify post-hook material templates plus defines,
// with exact Three185/source file provenance binding the shader chunks.
// Settled capture includes MeshStandardMaterial's actual {STANDARD:''} define; provisional empty-define hashes are refused.
import type { ParameterField } from './material-table.ts';

export const PBR_PARAMETER_FIELDS: readonly ParameterField[] = [
  ...['paint', 'over', 'street', 'gum', 'city', 'pbSeed', 'pbDirt', 'pbBaseY', 'pbTopY', 'pbWorld', 'pbChips', 'pbRefL', 'pbSubK', 'pbCavK', 'pbGlazed', 'pbRough', 'pbNrmK', 'weatherEnabled', 'grimeEnabled', 'dirtEnabled'].map((name) => ({ name, size: 1 as const })),
  ...['pbSize', 'pbUnit', 'pbMetal'].map((name) => ({ name, size: 2 as const })),
  ...['pbRatio', 'pbPaint', 'pbBl', 'pbOver', 'pbGrimeC', 'pbRS', 'pbFac'].map((name) => ({ name, size: 3 as const })),
  ...['pbRot', 'pbScan'].map((name) => ({ name, size: 4 as const })),
];
export const PILOT_PBR_PROGRAMS = {
  '5d3e43a0': { key: 'pbr|s6|-|-|w|-|-|wd|c1|cityaon|cs34p|lighttrim1,1,1|st34|fktr', sha256: 'e472db6b88c5fb3d8a1bfe2f6be55757f6889fd1fe3eed3e98464c9d1c13ad2b' },
  'd24a9901': { key: 'pbr|s6|-|-|w|-|ga|wd|c1|cityaon|cs34p|lighttrim1,1,1|st34|fktr', sha256: '6688abf76dc2d41bd2fe29b5031853911b83313105b4dfb7e359b737e5620590' },
} as const;

export const SOURCE_PBR_PROGRAMS = {
  ...PILOT_PBR_PROGRAMS,
  '76aba290': { key: 'pbr|s6|-|-|st|-|-|-|c0|cityaon|cs34|lighttrim1.94,1.7,1.47|st34', sha256: '2fd2b93799028608225f81d3fd68950fe2b571ceead8018c9ab2e9df21553603' },
  ea8933e7: { key: 'pbr|s6|-|-|w|-|-|-|c1|cityaon|cs34p|lighttrim1,1,1|st34', sha256: '127acb392f71d32cb9d9a3c0787d47002cc9151599bfeebd93937492adf6763d' },
  '7c343fd7': { key: 'pbr|s6|-|-|w|-|-|-|c1|cityaon|cs34p|lighttrim1,1,1|st34pbr|s6|-|-|w|-|-|-|c1|cityaon|cs34p|lighttrim1,1,1|st34|skymetalU', sha256: '5abecb84e86242127e3132fa4e0eb6e5fb538e68422d0844e5d6e53f31dc5406' },
  '77942aa6': { key: 'pbr|s6|-|-|w|-|-|wd|c1|cityaon|cs34p|lighttrim1,1,1|st34|fktr|fkenvU', sha256: 'f1fcf03a2cc20d08326f925b6b9c2e4501ef35dd1972caa12fd116fa09d17ea1' },
  fb801e91: { key: 'pbr|s6|-|-|w|-|-|wd|c1|cityaon|cs34p|lighttrim1,1,1|st34pbr|s6|-|-|w|-|-|wd|c1|cityaon|cs34p|lighttrim1,1,1|st34|skymetalU|fktrm', sha256: '3911c864880aa68744066d810bb27588f6a046c95017ca77c028766a5df9aaa0' },
  '13e63775': { key: 'pbr|s6|-|-|w|-|-|wd|c1|cityaon|cs34p|lighttrim1,1,1|st34pbr|s6|-|-|w|-|-|wd|c1|cityaon|cs34p|lighttrim1,1,1|st34|skymetalU|fktrm|fkenvU', sha256: '2b901aa241b664e31de9ae73ffc4bcaca7a2b70976362282b25cbbbd3bb238fe' },
  '4777b23e': { key: 'pbr|s6|p|-|w|-|-|-|c1|cityaon|cs34p|lighttrim1,1,1|st34', sha256: '2e93a37edff81a6c92a1e9bcfbeae59b7784650ca0295d0fb0dfd7215846f4ee' },
  b32d7b63: { key: 'pbr|s6|p|-|w|-|-|wd|c1|cityaon|cs34p|lighttrim1,1,1|st34|fktrm', sha256: '7bd48f6d94bdeeeea3662e83b6e74c61d70bea4ba4fa1bbcf80780548c694e38' },
} as const;

export function classifySourcePbr(source: { key: string; shaderHash: string; shaderSha256: string }) {
  const program = SOURCE_PBR_PROGRAMS[source.shaderHash as keyof typeof SOURCE_PBR_PROGRAMS];
  const sharedMetalAlias = source.shaderHash === '5d3e43a0' && source.key === PILOT_PBR_PROGRAMS['5d3e43a0'].key + 'm';
  if (!program || (program.key !== source.key && !sharedMetalAlias) || program.sha256 !== source.shaderSha256) throw new Error(`Unsupported authored PBR program ${source.key}`);
  const match = /\|lighttrim([^|]+)/.exec(source.key);
  const trim = match?.[1]?.split(',').map(Number);
  if (!trim || trim.length !== 3 || !trim.every(Number.isFinite)) throw new Error('Missing source PBR trim scale');
  return { sharedTint: source.key.includes('|fktr'), skyMetal: source.key.includes('|skymetalU'),
    environmentShare: source.key.endsWith('|fkenvU'), trim: trim as [number, number, number] };
}

export function sourcePbrParameterSchema(source: Parameters<typeof classifySourcePbr>[0]) {
  const features = classifySourcePbr(source);
  return { material: [...PBR_PARAMETER_FIELDS,
    ...(features.skyMetal ? [{ name: 'uSmTn', size: 3 as const }, { name: 'uSmP', size: 4 as const }] : []),
    ...(features.environmentShare ? [{ name: 'fkEnvK', size: 1 as const }] : [])],
    variant: [...(features.sharedTint ? [{ name: 'fkTr', size: 3 as const }] : []), {name:'instanceColor',size:3 as const}] };
}

export function classifyPilotPbr(source: { key: string; shaderHash: string; shaderSha256: string }) {
  const program = PILOT_PBR_PROGRAMS[source.shaderHash as keyof typeof PILOT_PBR_PROGRAMS];
  // Non-sky metal sharing adds "fktrm" but emits the same expanded template as fktr.
  const sharedMetalAlias = source.shaderHash === '5d3e43a0' && source.key === PILOT_PBR_PROGRAMS['5d3e43a0'].key + 'm';
  if (!program || (program.key !== source.key && !sharedMetalAlias) || program.sha256 !== source.shaderSha256) throw new Error(`Unsupported authored PBR program ${source.key}`);
  return source.shaderHash as keyof typeof PILOT_PBR_PROGRAMS;
}
