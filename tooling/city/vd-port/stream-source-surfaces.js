/** Await bounded source batches; accumulate tiny groups without changing their original order. */
export async function streamSourceSurfaces(root,materials,shadowPolicy,sourceSignKitSha256,batchTriangles=1000){
 if(!Number.isInteger(batchTriangles)||batchTriangles<1||batchTriangles>8192)throw new Error('Source stream batch must be1..8192 triangles');
 const batchIndices=batchTriangles*3;
 const materialIds=new Map(materials.map((material,index)=>[material.uuid,index]));
 const diagnostics={triangles:0,omittedZeroAreaTriangles:0,normalRepairs:[]};
 let vertices=[],variants=[],variantKeys=new Map();
 const flush=async()=>{if(!vertices.length)return;await window.__writeSurfaceStream({id:root.id,vertices,variants});vertices=[];variants=[];variantKeys=new Map();};
 const visit=async(object,path)=>{
  if(object.visible===false)return;
  if(object.isMesh&&object.geometry?.attributes.position){
   const geometry=object.geometry,end=geometry.index?.count??geometry.attributes.position.count;
   const groups=geometry.groups.length&&Array.isArray(object.material)?geometry.groups:[{start:0,count:end,materialIndex:0}];
   for(let instance=0;instance<(object.isInstancedMesh?object.count:1);instance++)for(const group of groups){
    const begin=Math.max(group.start,geometry.drawRange?.start??0),limit=Math.min(group.start+group.count,(geometry.drawRange?.start??0)+(geometry.drawRange?.count??Infinity),end);
    for(let start=begin;start+2<limit;){
     const count=Math.min(batchIndices-vertices.length,limit-start);
     const isolated=Object.create(object),part=Object.create(geometry);
     isolated.children=[];isolated.updateMatrixWorld=()=>{};isolated.geometry=part;
     part.groups=[group];part.drawRange={start,count};
     if(object.isInstancedMesh){isolated.count=1;isolated.getMatrixAt=(_index,matrix)=>object.getMatrixAt(instance,matrix);}
     if(object.instanceColor){
      const color=Object.create(object.instanceColor);
      color.getComponent=(_index,component)=>object.instanceColor.getComponent(instance,component);
      isolated.instanceColor=color;
     }
     const result=window.__harvestSurfaceTriangles(isolated,{
      shadowPolicy:()=>shadowPolicy(object),sourceSignKitSha256,
      sourceShaderSha256:material=>materials[materialIds.get(material.uuid)]?.shader?.sha256,
      material:material=>{const id=materialIds.get(material.uuid);if(id===undefined)throw new Error('Uncaptured production material');return{material:id,family:0};},
      variant:(_material,fields,frame)=>{const key=JSON.stringify({fields,frame});if(!variantKeys.has(key)){variantKeys.set(key,variants.length);variants.push({fields,frame});}return variantKeys.get(key);},
      triangle:triangle=>{vertices.push(...triangle);diagnostics.triangles++;},
     });
     start+=count;diagnostics.omittedZeroAreaTriangles+=result.omittedZeroAreaTriangles;
     diagnostics.normalRepairs.push(...result.normalRepairs.map(repair=>({...repair,meshPath:path})));
     if(vertices.length===batchIndices)await flush();
    }
   }
  }
  const children=object.isLOD&&object.levels?.length?[object.levels[0].object]:object.children;
  for(const child of children)await visit(child,`${path}/${object.children.indexOf(child)}`);
 };
 root.group.updateMatrixWorld(true);await visit(root.group,'root');await flush();
 return diagnostics;
}
