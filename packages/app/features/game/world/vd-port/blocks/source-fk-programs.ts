// Pure offline/runtime identity contract. No shader/resource imports.
/** Locator hashes are diagnostic; the captured full SHA is the authoritative program identity. */
export const PILOT_FK_PROGRAMS = {
  '230396d1': '82b4b89e2eac602c655570f7682f6af95f0b2fae82b5d245261a289fe3ed5a79',
  d1ec3ffd: 'd615b36245320794b206d2262ddb1744a2b6c65d9f67649ffeae6321ecdb5a35',
  '62271fdd': '4cf9b3a3bf301b9f52bfe3c42d84df33dbbea39da4d20ae678eae706ee660a15',
  '1c3d9b8b': 'b174d8bfe8c291ccf4de48392413c304271728d2f7baed14a607e86df45e2077',
  '289985f3': 'df51b407679e941aa8c475f7eaf3d7952fa50d249c63465b51f9b77914f2fb2f',
  d1d6ce16: 'd0afa025f28f5fa09bf8277fed9a6a6d6622816ffda1936e6334dd4ec6f64486',
  '692f9967': '8b70c4054cd8524ed5d6c1c3a3fdb091d93735b086b271b6b77927a3afd00642',
  ef4466c1: '99b2df01b9a66499a66b5d7e1a3b86f7dc963dc1c4ac7fde1f36a4ffcae56856',
} as const;
export const SOURCE_FK_EXTRA_PROGRAMS = {
  'c8a4d7c4': {sha256:'afad281eb8c2ed31394fb31047a8dc6ebf61411240728d01cedddcdc19095731',suffix:'|fkin0.3,0.7|fklv0.13,1.3',vertexColors:true,map:false,level:true},
  'a4a0561a': {sha256:'be0813e4481bb2cb022edb8a6c7263a59db8164bb6d5f4eadda281c4496a13da',suffix:'|fkin0.3,0.7|fklv0.22,1.1',vertexColors:true,map:false,level:true},
  'e7194a81': {sha256:'d288ebf1226a98fde251d81d55197e5fa18d0ff23d8813c9258dcede95ab9a9c',suffix:'|fkin0.3,0.7|fklva0.16,1.25',vertexColors:true,map:true,level:true},
  '59c695f7': {sha256:'ecbced23d27792a71cc98f488c39105ede96d094f1ddb08f63b2733375e9cb09',suffix:'|fkin0.45,0.8|fklv0.2,0.9',vertexColors:false,map:true,level:true},
  'ac9db111': {sha256:'b2fa77ea49a0cf3d0d7b66c8bcc0479e24e3765545184ced9fc202050590ec4a',suffix:'|fkin1,1|fkselfU|fksoft0.2',vertexColors:true,map:true,level:false},
  '60dafc51': {sha256:'e7ddb84160171aae0dbaf05186969a205a27b2dea8ddd45c51e1c49b15f1244a',suffix:'|fkenvU|pbcity',vertexColors:false,map:false,level:false},
} as const;
export const SOURCE_KIT_GLASS_EXTRA = {key:'kitwinglass3|0.07|0.02|0.22|0.6',hash:'741f8539',sha256:'0bb045ec5c7e05b1a1e65a961d5f13553ca34e3d12f2561cf5845c78427939f3'} as const;
export interface PilotFkSource {
  key: string; shaderHash: string; shaderSha256: string; type: string;
  vertexColors: boolean; hasAlphaTest: boolean;
  /** Exact populated source map roles, part of the compiled family identity. */
  mapRoles: readonly string[];
  attributeRoles?: readonly string[];
}
const SUFFIXES = {
  '230396d1': '|fkin0.6,0.85|fknight1', d1ec3ffd: '|fkplain|pbcity', '62271fdd': '|fknight1',
  '1c3d9b8b': '|fkin0.6,0.85', '289985f3': '|fkenvU|fkplain|pbcity',
  d1d6ce16: 'kitwinglass3|0.2|0.03|0.3|0.26', '692f9967': '|fkin0.28,0.6', ef4466c1: '|fkin0.3,0.6|fknight1',
} as const;
export function classifyPilotFk(source: PilotFkSource) {
  if(source.shaderHash===SOURCE_KIT_GLASS_EXTRA.hash){
    if(source.key!==SOURCE_KIT_GLASS_EXTRA.key||source.shaderSha256!==SOURCE_KIT_GLASS_EXTRA.sha256||source.type!=='MeshStandardMaterial'||!source.vertexColors||source.hasAlphaTest||source.mapRoles.length)throw new Error('Unverified authored secondary kit glass');
    return SOURCE_KIT_GLASS_EXTRA.key;
  }
  const extra = SOURCE_FK_EXTRA_PROGRAMS[source.shaderHash as keyof typeof SOURCE_FK_EXTRA_PROGRAMS];
  if (extra) {
    if (source.shaderSha256 !== extra.sha256 || source.type !== 'MeshStandardMaterial' || !source.key.endsWith(extra.suffix)) throw new Error('Unverified authored FK extra program');
    if (source.vertexColors !== extra.vertexColors || source.hasAlphaTest || JSON.stringify(source.mapRoles) !== JSON.stringify(extra.map ? ['map'] : []) || JSON.stringify(source.attributeRoles) !== JSON.stringify(extra.level ? ['aFkTr'] : [])) throw new Error('Authored FK extra map/attribute/color contract mismatch');
    return extra.suffix;
  }
  const hash = source.shaderHash as keyof typeof PILOT_FK_PROGRAMS;
  const expected = PILOT_FK_PROGRAMS[hash], suffix = SUFFIXES[hash];
  if (!expected || source.shaderSha256 !== expected || source.type !== 'MeshStandardMaterial') throw new Error('Unverified pilot FK shader');
  if (hash === 'd1d6ce16' ? source.key !== suffix : !source.key.endsWith(suffix)) throw new Error('Unsupported authored FK key');
  return suffix;
}
export function pilotFkParameterSchema(source: PilotFkSource): { material: {name: string; size: 1|2|3|4}[]; variant: {name: string; size: 1|2|3|4}[] } {
  const program = classifyPilotFk(source);
  return { material: [{name:'diffuse',size:3},{name:'emissive',size:3},
    ...['emissiveIntensity','opacity','roughness','metalness','envMapIntensity'].map(name=>({name,size:1 as const})),
    ...(program.includes('|fkenvU') ? [{name:'fkEnvK',size:1 as const}] : []),
    ...(program.includes('|fkselfU') ? [{name:'fkLv',size:2 as const}] : [])],
    variant: program.endsWith('|fkplain|pbcity') || program.includes('|fklv') ? [{name:'fkTr',size:3}] : [] };
}
