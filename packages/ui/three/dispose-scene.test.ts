import assert from 'node:assert/strict';
import { test } from 'node:test';
import { disposeSceneResources } from './dispose-scene.ts';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return{promise,resolve};};

test('idle scene and renderer teardown retains synchronous ordering',()=>{
 const order:string[]=[];
 const result=disposeSceneResources({disposeScene(){order.push('scene');},releaseRenderer(){order.push('renderer');},onError(){assert.fail();}});
 assert.equal(result,undefined);assert.deepEqual(order,['scene','renderer']);
});

test('active compile drain keeps renderer and buffers alive until scene resources are safely disposed',async()=>{
 const compile=deferred(),order:string[]=[];let live=true;
 const result=disposeSceneResources({disposeScene(){live=false;order.push('closed');return compile.promise.then(()=>{order.push('scene resources');});},
  releaseRenderer(){order.push('buffers');order.push('renderer');},onError(){assert.fail();}});
 assert.equal(live,false);assert.deepEqual(order,['closed']);compile.resolve();await result;
 assert.deepEqual(order,['closed','scene resources','buffers','renderer']);
});

test('failed scene cleanup is observed and still releases renderer exactly once',async()=>{
 const errors:unknown[]=[],error=new Error('cleanup');let released=0;
 await disposeSceneResources({disposeScene:()=>Promise.reject(error),releaseRenderer(){released++;},onError:e=>{errors.push(e);}});
 assert.deepEqual(errors,[error]);assert.equal(released,1);
});
