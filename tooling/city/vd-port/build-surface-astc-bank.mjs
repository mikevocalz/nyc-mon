// A separate source-equivalent ASTC pilot bank; never overwrites the RGBA comparison bank.
import{readFile,writeFile,mkdir}from'node:fs/promises';import{existsSync}from'node:fs';import{join}from'node:path';import{createHash}from'node:crypto';
import{loadSurfaceBasis,transcodeSurfaceKtx}from'./transcode-surface-ktx.mjs';import{packSurfaceTextures}from'./pack-surface-textures.mjs';
const[input='/tmp/nycmon-surface-pilot-bank',output='/tmp/nycmon-surface-pilot-bank-astc',footprint='/tmp/nycmon-pbr-source-footprint.json']=process.argv.slice(2);
if(input===output)throw new Error('ASTC output must preserve the RGBA comparison bank');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),sourceManifest=await readFile(join(input,'manifest.json')),bank=JSON.parse(sourceManifest),verified=JSON.parse(await readFile(footprint,'utf8'));
const{basis,provenance}=await loadSurfaceBasis(),textures=[],payloads=new Map(),sources=[];
for(const texture of bank.textures){
 if(texture.uuid.startsWith('pbr:')){
  const[,set,role]=texture.uuid.split(':'),record=verified.files.find(file=>file.set===set&&file.role===role);if(!record)throw new Error(`Missing verified source ${texture.uuid}`);
  const path=join('tooling/city/.cache/vd-pbr',set,`${role}.ktx2`);let bytes;
  if(existsSync(path))bytes=await readFile(path);else{const response=await fetch(`https://huggingface.co/datasets/mehmetkeremturkcan/valdrada/resolve/${verified.revision}/${record.path}`);if(!response.ok)throw new Error(`Source HTTP${response.status}`);bytes=Buffer.from(await response.arrayBuffer());}
  const result=transcodeSurfaceKtx(bytes,{basis,sourceSha256:record.sha256,set,role});textures.push(result.texture);payloads.set(result.texture.sha256,result.payload);sources.push({set,role,sha256:record.sha256,originalWidth:record.width,originalHeight:record.height,levels:record.levels});
 }else{
  const page=bank.pages[texture.page],bytes=await readFile(join(input,`${page.sha256}.bin`));if(sha(bytes)!==page.sha256)throw new Error('Prior page integrity failure');
  const chunks=page.mipLevels.map(mip=>bytes.subarray(mip.byteOffset+texture.layer*mip.layerBytes,mip.byteOffset+(texture.layer+1)*mip.layerBytes));
  const payload=Buffer.concat(chunks);if(sha(payload)!==texture.sha256)throw new Error('Prior layer integrity failure');textures.push(texture);payloads.set(texture.sha256,payload);
 }
}
await mkdir(output,{recursive:true});
const result=await packSurfaceTextures(textures,{readPayload:hash=>{const bytes=payloads.get(hash);if(!bytes)throw new Error('Missing exact source payload');return bytes;},writePage:(page,bytes)=>writeFile(join(output,`${page.sha256}.bin`),bytes),maxPageBytes:64*2**20,maxLayers:1});
result.cityAORect=bank.cityAORect;result.provenance={basis:provenance,sourceRevision:verified.revision,sources,comparisonBankSha256:sha(sourceManifest),policy:'All original PBR dimensions, channels and mips; source-equivalent Basis ASTC4x4 target; captured maps/cityAO unchanged'};
await writeFile(join(output,'manifest.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({output,pages:result.pages.length,references:result.textures.length,gpuBytes:result.gpuBytes,rgbaComparisonBytes:bank.gpuBytes,requiredFeatures:result.requiredFeatures}));
