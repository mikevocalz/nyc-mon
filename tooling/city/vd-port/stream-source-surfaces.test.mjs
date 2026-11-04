import test from 'node:test';
import assert from 'node:assert/strict';
import{pathToFileURL}from'node:url';
import{harvestSurfaceTriangles}from'./surface-harvest.mjs';
import{streamSourceSurfaces}from'./stream-source-surfaces.js';
import{SURFACE_BAKE_DEPS}from'./surface-paths.mjs';
import{join}from'node:path';

test('bounded source streaming preserves instance/group/draw-range order and exact original channels',async()=>{
 const THREE=await import(pathToFileURL(join(SURFACE_BAKE_DEPS,'three/build/three.module.js')));
 const geometry=new THREE.BufferGeometry(),positions=[],normals=[];
 for(let tri=0;tri<1002;tri++){positions.push(0,0,0,1,0,0,0,0,1);normals.push(0,1,0,0,1,0,0,1,0);}
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.addGroup(0,3003,0);geometry.addGroup(3003,3,1);geometry.setDrawRange(3,3003);
 const materials=[new THREE.MeshStandardMaterial(),new THREE.MeshStandardMaterial()],mesh=new THREE.InstancedMesh(geometry,materials,2);
 mesh.setMatrixAt(0,new THREE.Matrix4().makeScale(-2,3,4));mesh.setMatrixAt(1,new THREE.Matrix4().makeTranslation(4,5,6));
 const group=new THREE.Group();group.add(mesh);group.updateMatrixWorld(true);
 const records=materials.map(material=>({uuid:material.uuid,shader:{sha256:'a'.repeat(64)}}));
 const variants=[],expected=[],policy=()=>({castShadow:true,receiveShadow:false,castOwner:'native-block-owner',receiveOwner:'native-block-owner',sourceCastShadow:false,sourceReceiveShadow:false});
 harvestSurfaceTriangles(group,{shadowPolicy:policy,material:m=>({material:materials.indexOf(m),family:0}),variant:(_m,fields,frame)=>{variants.push({fields,frame});return variants.length-1;},triangle:triangle=>expected.push(...triangle.map(vertex=>({...vertex,variant:variants[vertex.variant]})))});
 const previous=globalThis.window,actual=[];let maxBatch=0;
 globalThis.window={__harvestSurfaceTriangles:harvestSurfaceTriangles,__writeSurfaceStream:async batch=>{maxBatch=Math.max(maxBatch,batch.vertices.length);actual.push(...batch.vertices.map(vertex=>({...vertex,variant:batch.variants[vertex.variant]})));}};
 try{const result=await streamSourceSurfaces({id:'fixture',group},records,policy,'b'.repeat(64));assert.equal(result.triangles,2002);assert.equal(result.omittedZeroAreaTriangles,0);}
 finally{globalThis.window=previous;geometry.dispose();materials.forEach(material=>material.dispose());}
 assert.ok(maxBatch<=3000);assert.deepEqual(actual,expected);
});
