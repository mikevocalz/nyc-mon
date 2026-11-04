// Original KTX2 mips/channels to the same ASTC4x4 target selected by Three's KTX2Loader on capable devices.
import {readFile}from'node:fs/promises';import{createHash}from'node:crypto';import{createRequire}from'node:module';import{fileURLToPath}from'node:url';import{dirname,join}from'node:path';import vm from'node:vm';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const kernels=new WeakMap();
const JS_SHA='8478b5b6d6b74e7d3082b89f6417321d8d1dc0307f2b30d4484bb11b441696a1',WASM_SHA='6cf17dc889352c42e9acf8897107978d127005fe3386c36a0e3845e27967630a';
export const SURFACE_ASTC_FORMAT=37808;
export async function loadSurfaceBasis(threeRoot=new URL('../../../packages/app/node_modules/three/',import.meta.url)){
 const root=threeRoot instanceof URL?fileURLToPath(threeRoot):threeRoot,base=join(root,'examples/jsm/libs/basis'),jsPath=join(base,'basis_transcoder.js'),wasmPath=join(base,'basis_transcoder.wasm');
 const[js,wasm]=await Promise.all([readFile(jsPath),readFile(wasmPath)]),module={exports:{}};
 if(sha(js)!==JS_SHA||sha(wasm)!==WASM_SHA)throw new Error('Unreviewed installed Basis kernel; update provenance deliberately');
 vm.runInThisContext(`(function(module,exports,require,__filename,__dirname){${js.toString('utf8')}\n})`)(module,module.exports,createRequire(import.meta.url),jsPath,dirname(jsPath));
 const basis=await module.exports({wasmBinary:wasm});basis.initializeBasis();
 const provenance={source:'installed Three Basis Universal',jsSha256:sha(js),wasmSha256:sha(wasm),target:'ASTC_4x4',targetEnum:10};kernels.set(basis,provenance);
 return{basis,provenance};
}
export function transcodeSurfaceKtx(bytes,{basis,sourceSha256,role,set}){
 const kernel=kernels.get(basis);if(!kernel)throw new Error('Basis must come from the verified source loader');
 if(!['albedo','normal','orm'].includes(role)||typeof set!=='string'||!set)throw new Error('Unknown source PBR role/set');
 if(!/^[a-f0-9]{64}$/.test(sourceSha256??'')||sha(bytes)!==sourceSha256)throw new Error('KTX source integrity failure');
 const buffer=Buffer.from(bytes);if(buffer.subarray(0,12).toString('hex')!=='ab4b5458203230bb0d0a1a0a')throw new Error('Invalid KTX2 identifier');
 const transfer=buffer[buffer.readUInt32LE(48)+14];if(transfer!==1&&transfer!==2)throw new Error('Unsupported original KTX transfer');
 const file=new basis.KTX2File(new Uint8Array(buffer));
 try{
  if(!file.isValid()||file.isHDR()||(!file.isUASTC()&&!file.isETC1S())||file.getFaces()!==1||(file.getLayers()||1)!==1)throw new Error('Unsupported original KTX2 shape/encoding');
  const width=file.getWidth(),height=file.getHeight(),levels=file.getLevels();if(!width||!height||!levels||!file.startTranscoding())throw new Error('KTX2 transcoding initialization failed');
  const chunks=[],mipLevels=[];let offset=0;
  for(let level=0;level<levels;level++){
   const info=file.getImageLevelInfo(level,0,0),w=Math.max(1,width>>level),h=Math.max(1,height>>level);
   if(info.origWidth!==w||info.origHeight!==h)throw new Error('Original KTX mip dimensions changed');
   const size=file.getImageTranscodedSizeInBytes(level,0,0,10),expected=Math.ceil(w/4)*Math.ceil(h/4)*16;
   if(size!==expected)throw new Error('ASTC4x4 source block size mismatch');
   const data=new Uint8Array(size);if(!file.transcodeImage(data,level,0,0,10,0,-1,-1))throw new Error(`ASTC source mip${level} failed`);
   chunks.push(data);mipLevels.push({width:w,height:h,byteOffset:offset,byteLength:size});offset+=size;
  }
  const payload=new Uint8Array(offset);let at=0;for(const chunk of chunks){payload.set(chunk,at);at+=chunk.length;}
  return{payload,texture:{uuid:`pbr:${set}:${role}`,width,height,format:SURFACE_ASTC_FORMAT,type:1009,compressed:true,compression:'astc-4x4',requiredFeature:'texture-compression-astc',basis:kernel,sourceSha256,originalSourceBytes:buffer.length,sha256:sha(payload),sourceBytes:payload.length,mipLevels,generateMipmaps:false,colorSpace:transfer===2?'srgb':'',flipY:false,premultiplyAlpha:!!(file.getDFDFlags()&1),wrapS:1000,wrapT:1000,minFilter:levels===1?1006:1008,magFilter:1006,anisotropy:role==='albedo'?16:8,unpackAlignment:4,channel:0,repeat:[1,1],offset:[0,0],center:[0,0],rotation:0,matrix:[1,0,0,0,1,0,0,0,1],hasAlpha:!!file.getHasAlpha()}};
 }finally{file.close();file.delete();}
}
