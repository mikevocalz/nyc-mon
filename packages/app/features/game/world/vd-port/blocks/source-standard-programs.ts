// Exact source templates; generic means an authored unmodified Three material, never an unknown-program fallback.
export const SOURCE_STANDARD_PROGRAMS = {
  '30f27eeb': {key:"onBeforeCompile( /* shaderobject, renderer */ ) {}",sha256:'59ef0151d809afe243edb25c6ab49c602b7b8869b9db02e6281739331bc1a42d',type:'MeshBasicMaterial',mapSets:[[], ["alphaMap"]],vertexColors:[false],alpha:[0, 0.5]},
  '1aaae8f': {key:"onBeforeCompile( /* shaderobject, renderer */ ) {}",sha256:'272def58baa5c6a21c233133c713626bd94a3a7b7af27c48607551336b75d722',type:'MeshStandardMaterial',mapSets:[["map"]],vertexColors:[false],alpha:[0]},
  'cd0dc17f': {key:"onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34",sha256:'e3e37d948c2ec1d6ae9d537b97581327102f2fdd22d2181b048d7415454cd7ac',type:'MeshStandardMaterial',mapSets:[["map"], []],vertexColors:[false, true],alpha:[0, 0.5]},
  'de0080f': {key:"onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|cityaon|cs34",sha256:'e4ef618c360dd22dba6baac40fb443da0a7fa6632a70aa048251b4490f6d95e3',type:'MeshStandardMaterial',mapSets:[["map"], [], ["map", "normalMap", "roughnessMap"], ["map", "roughnessMap"]],vertexColors:[false],alpha:[0]},
  'a3dd8b4b': {key:"onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|cityaon|cs34p|pbcity",sha256:'340f747d6892de06288623725c191a27a73c29b03d0607fa81dcbd175d07c776',type:'MeshStandardMaterial',mapSets:[["map", "normalMap"]],vertexColors:[false],alpha:[0]},
  'cf0cbad2': {key:"onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|pbcity",sha256:'b9859f5827a8eae16e55519be89c470c744b38f87790425ca7ae41f42f70fadf',type:'MeshStandardMaterial',mapSets:[["map", "metalnessMap", "roughnessMap"], [], ["map"]],vertexColors:[false],alpha:[0]},
} as const;
export interface SourceStandardIdentity { key:string; shaderHash:string; shaderSha256:string; type:string; vertexColors:boolean; hasAlphaTest:boolean; mapRoles:readonly string[]; attributeRoles:readonly string[]; normalMapType?:number }
export function classifySourceStandard(source:SourceStandardIdentity) {
  const hash=source.shaderHash as keyof typeof SOURCE_STANDARD_PROGRAMS, p=SOURCE_STANDARD_PROGRAMS[hash];
  if(!p||source.key!==p.key||source.shaderSha256!==p.sha256||source.type!==p.type)throw new Error('Unverified authored standard program');
  const colorModes:readonly boolean[]=p.vertexColors;
  if(!colorModes.includes(source.vertexColors)||source.attributeRoles.length||!p.mapSets.some(roles=>JSON.stringify([...roles].sort())===JSON.stringify([...source.mapRoles].sort()))||!p.alpha.some(a=>(a>0)===source.hasAlphaTest))throw new Error('Authored standard map/attribute/color/alpha mismatch');
  if(source.mapRoles.includes('normalMap')&&source.normalMapType!==0)throw new Error('Unsupported authored standard normal map type');
  return {basic:p.type==='MeshBasicMaterial',trim:p.key.includes('|lighttrim'),cityAo:p.key.includes('|cityaon'),cs34:p.key.includes('|cs34'),pbrCity:p.key.includes('|pbcity')};
}
export function sourceStandardParameterSchema(source:SourceStandardIdentity):{material:{name:string;size:1|2|3|4}[];variant:{name:string;size:1|2|3|4}[]} {
  const p=classifySourceStandard(source);
  return {material:[{name:'diffuse',size:3},...['opacity','alphaTest'].map(name=>({name,size:1 as const})),
    ...(p.basic?[]:[{name:'emissive',size:3 as const},...['emissiveIntensity','roughness','metalness','envMapIntensity'].map(name=>({name,size:1 as const}))]),
    ...(source.mapRoles.includes('normalMap')?[{name:'normalScale',size:2 as const}]:[])],variant:[]};
}
