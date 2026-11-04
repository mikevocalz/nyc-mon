// Pure strong identity/schema contract from settled Valdrada @2724c79 capture.
export const SOURCE_PBR_GLASS_PROGRAMS = {
  'pbrglass4|o': { hash: '55e4c117', sha256: '3f8f8e626274452a51ad0cf52546032e546b4a8056910a8df9edd27f54242b46' },
  'pbrglass4|o|rm': { hash: '2d150e11', sha256: 'c948d1527b7ea9a6c6b958e27c564f6f51923ef1371b4dbe35b6cc6f374278d9' },
  'pbrglass4|o|st': { hash: '9856b4b0', sha256: 'a9b94dc66ffb1970cbe8023869f8dfe7875da93c25adc7331276b6120c6ca9a9' },
  'pbrglass4|o|st|ca': { hash: 'dd5e516c', sha256: '9ca4550bfc4fb8a2383d3dad5726c0b45eafcf5b8b264096293e8fbfc200788d' },
  'pbrglass4|o|st|rm': { hash: '8dd43f3e', sha256: '6d93c05c4453c722082fa860714d3852632eef574c17dc869e50c7a8de465f2a' },
  'pbrglass4|t|st': { hash: 'f3f5b5fc', sha256: 'b8cba0e184cf6d0873f819bbfd49b494617f724bce7807d19b5dc63b06682ea6' },
} as const;
export interface SourcePbrGlassIdentity {
  key: string; shaderHash: string; shaderSha256: string; type: string;
  vertexColors: boolean; hasAlphaTest: boolean; mapRoles: readonly string[];
  /** Shader-specific attributes actually present, excluding the ordinary position/normal/UV/color channels. */
  attributeRoles: readonly string[];
}
export function classifySourcePbrGlass(source: SourcePbrGlassIdentity) {
  const program = source.key as keyof typeof SOURCE_PBR_GLASS_PROGRAMS;
  const expected = SOURCE_PBR_GLASS_PROGRAMS[program];
  if (!expected || source.shaderHash !== expected.hash || source.shaderSha256 !== expected.sha256 || source.type !== 'MeshStandardMaterial') throw new Error('Unverified authored PBR glass program');
  if (source.vertexColors || source.hasAlphaTest || source.mapRoles.length) throw new Error('PBR glass source map/color/alpha contract mismatch');
  const tintAttributes = program.endsWith('|ca');
  const attributes = [...source.attributeRoles].sort();
  if (JSON.stringify(attributes) !== JSON.stringify(tintAttributes ? ['aFkTr','aPgBody'] : [])) throw new Error('PBR glass source attribute contract mismatch');
  return { program, opaque: program.startsWith('pbrglass4|o'), street: program.includes('|st'), room: program.includes('|rm'), tintAttributes };
}
type Field = {name: string; size: 1|2|3|4};
export function sourcePbrGlassParameterSchema(source: SourcePbrGlassIdentity): {material: Field[]; variant: Field[]} {
  const {tintAttributes} = classifySourcePbrGlass(source);
  return {material: [{name:'diffuse',size:3},{name:'emissive',size:3},{name:'pgBody',size:3},{name:'pgOrg',size:3},{name:'pgRm',size:4},
    ...['emissiveIntensity','opacity','roughness','metalness','envMapIntensity','pgF0','pgRough','pgDirt','pgStW','pgBl','pgTr','pgSd','pgShr','pgGlow','pgSlk','pgLit'].map(name=>({name,size:1 as const}))],
    variant: tintAttributes ? [{name:'fkTr',size:3},{name:'pgBody',size:4}] : []};
}
