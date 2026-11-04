// Pure offline/runtime identity contract. No shader/resource imports.
/** Strong expanded-template identities captured after font/bitmap settlement, including hook defines. */
export const SOURCE_SIGN_FACE_PROGRAMS = {
  ar33sg3Md: { hash: '7bb98467', sha256: 'c1dd9d4453ad6c8049f88d95a1342e4bbcd5d05f34993e778b91c51f711dab4c' },
  ar33sg3Ml: { hash: 'fe98b3e3', sha256: 'ec24162b8219f961914e006118429be181367c96a1cb96d8101786f98d27ed38' },
  ar33sg3Fd: { hash: '5668f93b', sha256: 'e6a9f21ab42f31ffee9cbbd5ce1d76d033ecef1963a92da2eb7d9b536017d7cf' },
  ar33sg3Fl: { hash: 'fb4dcb86', sha256: 'd41ea789d75557f87320fc0510a0c6333cd275f0ebac90525de718028c24d5a3' },
} as const;
export const SOURCE_SIGN_EXTRA_PROGRAMS = {
  ar33sgH: {hash:'7535155',sha256:'d9828603981c85c1eb467d638a8f9c92acbd5bee2fa6f1407809e9740c0516f8',type:'MeshBasicMaterial' },
  ar33sgS3: {hash:'13090b2d',sha256:'d871ea4acd780f0a68e8a135098c73f94586dbf6350ab4e77770f082f8462e16',type:'MeshBasicMaterial' },
  ar33sgDu: {hash:'9eb838cb',sha256:'90dafc8a6565b3512e240989827cb1643675097cb4b2cf5ee0b49277fe99adce',type:'MeshStandardMaterial' },
  ar33sgG: {hash:'66bd388e',sha256:'1dccfe20c84b672a6282401390a7eea9bbe7b6055cbf9f96d689b9594384dc1c',type:'MeshStandardMaterial' },
} as const;
export interface SourceSignFaceIdentity {
  key: string; shaderHash: string; shaderSha256: string; type: string; vertexColors: boolean;
  attributeRoles?: readonly string[];
  hasAlphaTest: boolean; mapRoles: readonly string[]; mapFormat?: number; mapColorSpace?: string;
}
export function classifySourceSignFace(source: SourceSignFaceIdentity) {
  const suffix = source.key.slice(source.key.lastIndexOf('|') + 1) as keyof typeof SOURCE_SIGN_FACE_PROGRAMS;
  const expected = SOURCE_SIGN_FACE_PROGRAMS[suffix];
  if (!expected || source.shaderSha256 !== expected.sha256 || source.type !== 'MeshStandardMaterial') throw new Error('Unverified authored SG face program');
  if (source.shaderHash !== expected.hash) throw new Error('Unverified authored SG face locator');
  return { program: suffix, mask: suffix[7] === 'M', decal: suffix.endsWith('d') };
}

export const SOURCE_SIGN_GLOW_VC = { hash: 'ba03496a', sha256: '32e78de07260fc42e78739b0c766cab037abb0972d16290ef4eec4b8d398a0e9' } as const;
export function classifySourceSignMaterial(source: SourceSignFaceIdentity) {
  const suffix = source.key.slice(source.key.lastIndexOf('|')+1) as keyof typeof SOURCE_SIGN_EXTRA_PROGRAMS;
  const extra = SOURCE_SIGN_EXTRA_PROGRAMS[suffix];
  if (extra) {
    if (source.shaderHash !== extra.hash || source.shaderSha256 !== extra.sha256 || source.type !== extra.type) throw new Error('Unverified authored SG extra program');
    const mapped = suffix === 'ar33sgS3' || suffix === 'ar33sgH';
    const attrs = suffix === 'ar33sgS3' ? ['sgRect','sgBg','sgFg','sgLamp','sgP','sgF'] : [];
    if (source.hasAlphaTest || JSON.stringify(source.mapRoles) !== JSON.stringify(mapped ? ['map'] : []) || JSON.stringify(source.attributeRoles) !== JSON.stringify(attrs) || (suffix !== 'ar33sgDu' && source.vertexColors)) throw new Error('SG extra map/attribute/color contract mismatch');
    return {program:suffix,mask:false,decal:false};
  }
  if (source.key.endsWith('|ar33sgGvc')) {
    if (source.shaderHash !== SOURCE_SIGN_GLOW_VC.hash || source.shaderSha256 !== SOURCE_SIGN_GLOW_VC.sha256 || source.type !== 'MeshStandardMaterial') throw new Error('Unverified authored SG glow-VC program');
    return { program: 'ar33sgGvc' as const, mask: false, decal: false };
  }
  return classifySourceSignFace(source);
}

export function sourceSignParameterSchema(source: SourceSignFaceIdentity): { material: {name: string; size: 1|2|3|4}[]; variant: {name: string; size: 1|2|3|4}[] } {
  const program = classifySourceSignMaterial(source).program;
  const base = [{name:'diffuse',size:3 as const},{name:'emissive',size:3 as const},
    ...['emissiveIntensity','opacity','envMapIntensity'].map(name=>({name,size:1 as const}))];
  if (program === 'ar33sgDu') return {material:[...base,{name:'roughness',size:1},{name:'metalness',size:1}],variant:[]};
  if (program === 'ar33sgG') return {material:[...base,{name:'roughness',size:1},{name:'metalness',size:1},{name:'sgEm',size:3},{name:'sgDay',size:1},{name:'sgNd',size:1}],variant:[]};
  if (program === 'ar33sgH') return {material:[{name:'diffuse',size:3},{name:'opacity',size:1},{name:'sgGain',size:1}],variant:[]};
  if (program === 'ar33sgS3') return {material:[{name:'diffuse',size:3},{name:'opacity',size:1}],variant:[{name:'sgRect',size:4},{name:'sgLamp',size:3},{name:'sgP',size:4}]};
  const glow = program === 'ar33sgGvc';
  return { material: [...base,...(glow ? ['roughness','metalness'] : ['alphaTest','sgSatK']).map(name=>({name,size:1 as const}))],
    variant: glow ? [{name:'sgLamp',size:3},{name:'sgP',size:4}] : [{name:'sgRect',size:4},{name:'sgBg',size:3},{name:'sgFg',size:3},{name:'sgLamp',size:3},{name:'sgP',size:4},{name:'sgF',size:4}] };
}
