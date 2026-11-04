import{classifyVegetationSource}from'../../../packages/app/features/game/world/vd-port/blocks/source-vegetation-programs.ts';

/** cpFloraKit.js281/292 owns DITH14: a RAF frame counter, not a frozen material parameter. */
export function authoredSurfaceUniforms(material){
 let vegetation=false;
 try{classifyVegetationSource({...material.source,key:material.source?.key??material.key,shaderHash:material.source?.shaderHash??material.shader.hash,
  shaderSha256:material.source?.shaderSha256??material.shader.sha256,shaderHashBasis:material.source?.shaderHashBasis??material.shader.sha256Basis,
  type:material.type,vertexColors:material.vertexColors,hasAlphaTest:material.alphaTest>0,
  mapRoles:material.maps?Object.keys(material.maps).filter(role=>material.maps[role]).sort():Object.keys(material.textureBindings).filter(role=>!role.startsWith('uniform:')).sort()});vegetation=true;}catch{}
 return Object.fromEntries(Object.entries(material.shader.uniforms??{}).map(([name,value])=>{
  if(vegetation&&name==='uDith14'&&!value?.dynamic){
   if(!Number.isInteger(value)||value<0||value>=64)throw new Error('Invalid original vegetation frame counter');
   return[name,{dynamic:'fadeFrame',initial:value}];
  }return[name,value];
 }));
}
