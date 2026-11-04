// Verify immutable source bytes while retaining only KTX2 headers; no decode or page output.
import {createHash} from 'node:crypto';
import {createReadStream,existsSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {SURFACE_WORKSPACE,SURFACE_PBR_FOOTPRINT} from './surface-paths.mjs';
const revision='09b583662e760b5976d636d341d0e5f81a7c7fcf';
const repo='https://huggingface.co/datasets/mehmetkeremturkcan/valdrada';
const input=process.argv[2]??join(SURFACE_WORKSPACE,'source-dependencies.json'),output=process.argv[3]??SURFACE_PBR_FOOTPRINT;
const dependencies=JSON.parse(await readFile(input,'utf8')),sets=[...new Set(dependencies.cells.flatMap(cell=>cell.pbrSets))].sort();
const files=[];
async function verify(set,role,metadata){
 const path=`Content/textures/pbr/${set}/${role}.ktx2`,expected=metadata.find(entry=>entry.path===path);
 if(!expected?.lfs?.oid||!/^[0-9a-f]{64}$/.test(expected.lfs.oid))throw new Error(`No immutable source SHA ${path}`);
 const cached=join('tooling/city/.cache/vd-pbr',set,`${role}.ktx2`);
 const response=existsSync(cached)?null:await fetch(`${repo}/resolve/${revision}/${path}`);
 if(response&&!response.ok)throw new Error(`${path} HTTP${response.status}`);
 const stream=response?response.body:createReadStream(cached),hash=createHash('sha256');let size=0,head=Buffer.alloc(0);
 for await(const chunk of stream){const bytes=Buffer.from(chunk);hash.update(bytes);size+=bytes.length;if(head.length<65536)head=Buffer.concat([head,bytes.subarray(0,65536-head.length)]);}
 const sha256=hash.digest('hex');if(sha256!==expected.lfs.oid||size!==expected.size)throw new Error(`Source integrity mismatch ${path}`);
 if(head.subarray(0,12).toString('hex')!=='ab4b5458203230bb0d0a1a0a')throw new Error(`Invalid KTX2 ${path}`);
 const width=head.readUInt32LE(20),height=head.readUInt32LE(24),depth=head.readUInt32LE(28),layers=head.readUInt32LE(32),faces=head.readUInt32LE(36),levels=head.readUInt32LE(40);
 if(!width||!height||depth>1||layers>1||faces!==1||!levels||80+levels*24>head.length)throw new Error(`Unsupported KTX dimensions ${path}`);
 const mipLevels=Array.from({length:levels},(_,level)=>({width:Math.max(1,width>>level),height:Math.max(1,height>>level),byteOffset:Number(head.readBigUInt64LE(80+level*24)),byteLength:Number(head.readBigUInt64LE(88+level*24)),uncompressedByteLength:Number(head.readBigUInt64LE(96+level*24))}));
 if(mipLevels.some(level=>level.byteOffset+level.byteLength>size))throw new Error(`Invalid KTX level bounds ${path}`);
 const rgba8Bytes=mipLevels.reduce((sum,mip)=>sum+mip.width*mip.height*4,0),astc4x4Bytes=mipLevels.reduce((sum,mip)=>sum+Math.ceil(mip.width/4)*Math.ceil(mip.height/4)*16,0);
 const record={set,role,path,sha256,sourceBytes:size,width,height,levels,transfer:head[head.readUInt32LE(48)+14],vkFormat:head.readUInt32LE(12),supercompression:head.readUInt32LE(44),rgba8Bytes,astc4x4Bytes,mipLevels};
 files.push(record);console.log(JSON.stringify({set,role,width,height,levels,sourceBytes:size,verified:true}));
}
let next=0;
await Promise.all(Array.from({length:3},async()=>{while(next<sets.length){const set=sets[next++];const response=await fetch(`https://huggingface.co/api/datasets/mehmetkeremturkcan/valdrada/tree/${revision}/Content/textures/pbr/${set}`);if(!response.ok)throw new Error(`Metadata ${set} HTTP${response.status}`);const metadata=await response.json();for(const role of['albedo','normal','orm'])await verify(set,role,metadata);}}));
const rows=sets.map(set=>{const entries=files.filter(file=>file.set===set);return{set,sourceBytes:entries.reduce((s,f)=>s+f.sourceBytes,0),rgba8Bytes:entries.reduce((s,f)=>s+f.rgba8Bytes,0),astc4x4Bytes:entries.reduce((s,f)=>s+f.astc4x4Bytes,0)};});
const result={revision,source:`${repo}/tree/${revision}/Content/textures/pbr`,verification:'Every full source stream SHA-256 and byte count matches immutable HF LFS metadata; only headers retained, no decode or cached writes',formatPolicy:'RGBA8 logical size assumes complete original channel preservation; ASTC4x4 is a measured header/block-size alternative only, not a runtime capability claim',sets:rows,files:files.sort((a,b)=>a.path.localeCompare(b.path)),totals:rows.reduce((sum,row)=>({sourceBytes:sum.sourceBytes+row.sourceBytes,rgba8Bytes:sum.rgba8Bytes+row.rgba8Bytes,astc4x4Bytes:sum.astc4x4Bytes+row.astc4x4Bytes}),{sourceBytes:0,rgba8Bytes:0,astc4x4Bytes:0})};
await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({output,sets:sets.length,files:files.length,totals:result.totals}));
