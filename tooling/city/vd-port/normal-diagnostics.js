/** Read-only invalid-normal census. It neither repairs nor emits any geometry. */
export function diagnoseSourceNormals(root,materialRecords){
 const records=new Map(materialRecords.map(record=>[record.uuid,record])),meshes=[];
 const component=(attribute,index)=>[0,1,2].map(axis=>attribute.getComponent(index,axis));
 const visit=(object,path)=>{
  if(object.visible===false)return;
  const geometry=object.geometry;
  if(object.isMesh&&geometry?.attributes.position&&geometry.attributes.normal){
   const attrs=geometry.attributes,materials=Array.isArray(object.material)?object.material:[object.material],groups=geometry.groups.length&&Array.isArray(object.material)?geometry.groups:[{start:0,count:geometry.index?.count??attrs.position.count,materialIndex:0}];
   for(const group of groups){const material=materials[group.materialIndex];if(!material||material.visible===false)continue;const record=records.get(material.uuid);if(!record)throw new Error('Uncaptured normal diagnostic material');
    const summary={mesh:object.name,path,material:material.name,type:material.type,key:record.key,shaderSha256:record.shader.sha256,triangles:0,nondegenerateZero:0,zeroAreaZero:0,mixedZero:0,nonfinite:0,examples:[]};
    const start=Math.max(group.start,geometry.drawRange.start),end=Math.min(group.start+group.count,geometry.drawRange.start+geometry.drawRange.count,geometry.index?.count??attrs.position.count);
    for(let at=start;at+2<end;at+=3){summary.triangles++;const ids=[0,1,2].map(corner=>geometry.index?geometry.index.getX(at+corner):at+corner),normals=ids.map(index=>component(attrs.normal,index));
     if(normals.some(normal=>normal.some(value=>!Number.isFinite(value)))){summary.nonfinite++;continue;}const zeros=normals.map(normal=>normal.every(value=>value===0));if(!zeros.some(Boolean))continue;if(!zeros.every(Boolean)){summary.mixedZero++;continue;}
     const points=ids.map(index=>component(attrs.position,index)),a=points[1].map((v,i)=>v-points[0][i]),b=points[2].map((v,i)=>v-points[0][i]),cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
     if(cross.every(value=>value===0))summary.zeroAreaZero++;else{summary.nondegenerateZero++;if(summary.examples.length<3)summary.examples.push({triangle:at/3,sourceCross:cross,positions:points});}
    }
    if(summary.nondegenerateZero||summary.mixedZero||summary.nonfinite)meshes.push(summary);
   }
  }
  const children=object.isLOD&&object.levels?.length?[object.levels[0].object]:object.children;for(const child of children)visit(child,`${path}/${object.children.indexOf(child)}`);
 };
 visit(root.group,'root');return{id:root.id,meshes};
}
