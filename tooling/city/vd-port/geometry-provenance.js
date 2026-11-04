export const GEOMETRY_PROVENANCE_FIELDS = ['position.xyz','color.rgb','uv.xy','normal.xyz','grime','weather.xyzw','presenceFlags','renderOrder','effectiveCastShadow','effectiveReceiveShadow','sourceCastShadow','sourceReceiveShadow','castOwner(0native/1source)','receiveOwner(0native/1source)'];
/** Constant-buffer ordered SHA over exact JS Float64 source channels; no vertex payload persists. */
export function auditSourceGeometry(root, materialRecords, textureRecords, shadowPolicy, sourceSignKitSha256) {
  const encoder=new TextEncoder(), materialById=new Map(materialRecords.map((record,index)=>[record.uuid,{record,index}])),textureById=new Map(textureRecords.map(record=>[record.uuid,record.sha256]));
  const normalize=value=>{
    if(Array.isArray(value))return value.map(normalize);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).filter(key=>key!=='uuid'&&value[key]!==undefined).sort().map(key=>[key,key==='texture'&&textureById.has(value[key])?{payloadSha256:textureById.get(value[key])}:normalize(value[key])]));
    if(typeof value==='string'&&textureById.has(value))return {payloadSha256:textureById.get(value)};
    if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Nonfinite geometry provenance metadata');
    return value;
  };
  const digest=value=>window.sha256(encoder.encode(JSON.stringify(normalize(value))));
  const materialDigests=new Map(materialRecords.map(record=>[record.uuid,digest(record)]));
  const hash=new window.sha256.Hash(),variantCache=new Map(),variantMaterials=new Map(),bytes=new Uint8Array(3*24*8),view=new DataView(bytes.buffer);
  let variantDigest,triangles=0;const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],usedMaterials=new Set();
  const callbacks={sourceSignKitSha256,
    sourceShaderSha256:material=>materialById.get(material.uuid)?.record.shader?.sha256,
    shadowPolicy,
    material:material=>{const entry=materialById.get(material.uuid);if(!entry)throw new Error('Uncaptured provenance material');usedMaterials.add(entry.index);return{material:entry.index,family:0};},
    variant:(material,fields,frame)=>{const key=JSON.stringify({fields,frame});if(!variantCache.has(key)){variantCache.set(key,digest({fields,frame}));variantMaterials.set(key,new Set());}variantMaterials.get(key).add(material);variantDigest=variantCache.get(key);return 0;},
    triangle:vertices=>{
      hash.update(materialDigests.get(materialRecords[vertices[0].material].uuid));hash.update(variantDigest);
      let offset=0;
      for(const vertex of vertices){const values=[...vertex.position,...vertex.color,...vertex.uv,...vertex.normal,vertex.grime,...vertex.weather,vertex.flags,vertex.renderOrder,Number(vertex.castShadow),Number(vertex.receiveShadow),Number(vertex.sourceCastShadow),Number(vertex.sourceReceiveShadow),Number(vertex.castOwner==='authored-source'),Number(vertex.receiveOwner==='authored-source')];if(values.length!==24)throw new Error('Geometry digest layout mismatch');for(const value of values){if(!Number.isFinite(value))throw new Error('Nonfinite geometry channel');view.setFloat64(offset,value,true);offset+=8;}for(let axis=0;axis<3;axis++){bounds[axis]=Math.min(bounds[axis],vertex.position[axis]);bounds[axis+3]=Math.max(bounds[axis+3],vertex.position[axis]);}}
      hash.update(bytes);triangles++;
    },
  };
  const surface=window.__harvestSurfaceTriangles(root.group,callbacks);
  const hex=bytes=>[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
  return {id:root.id,triangles,vertices:triangles*3,sourceWorldBounds:triangles?bounds:null,sha256:hex(hash.digest()),variantSignatures:variantCache.size,variants:[...variantCache].map(([key,value])=>({...JSON.parse(key),materials:[...variantMaterials.get(key)].sort((a,b)=>a-b),sha256:hex(value)})),
    materials:[...usedMaterials].sort((a,b)=>a-b).map(index=>({index,sha256:hex(materialDigests.get(materialRecords[index].uuid)),shaderSha256:materialRecords[index].shader.sha256})),
    omittedZeroAreaTriangles:surface.omittedZeroAreaTriangles,normalRepairs:surface.normalRepairs,shadowAudit:surface.shadowAudit};
}
