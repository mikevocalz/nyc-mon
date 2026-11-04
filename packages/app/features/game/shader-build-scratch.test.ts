import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installGpuGlobals, recordingCanvas, recordingGpuDevice } from './render-runtime/recording-gpu.test-support.ts';
import { withCompileProgressEvent } from './compile-progress-event.ts';

// The A12X startup heap retained completed builders through TSL callback closures.
test('completed shader builders drop scratch while render state survives reuse and rebuild', async () => {
  installGpuGlobals();
  const THREE = await import('three/webgpu');
  const { device, record } = recordingGpuDevice();
  const renderer = new THREE.WebGPURenderer({device,canvas:recordingCanvas(128,128)} as never);
  await renderer.init();
  const builders: {nodes:Set<unknown>;sequentialNodes:Set<unknown>}[] = [];
  renderer.debug.onNodeBuilderCreated = builder => { builders.push(builder as never); };
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60,1,0.1,100);
  camera.position.z=4;
  const material = new THREE.MeshStandardNodeMaterial({color:0x885522,roughness:0.6});
  const geometry = new THREE.BoxGeometry();
  scene.add(new THREE.HemisphereLight(0xffffff,0x333333,1),new THREE.Mesh(geometry,material));
  const release=withCompileProgressEvent();
  try {
    await renderer.compileAsync(scene,camera);
    assert.ok(builders.length>0);
    for(const builder of builders){assert.equal(builder.nodes.size,0);assert.equal(builder.sequentialNodes.size,0);}
    renderer.render(scene,camera);
    const shaders=record.shaders.length;
    material.color.setHex(0x225588);material.roughness=0.2;
    renderer.render(scene,camera);
    assert.equal(record.shaders.length,shaders,'uniform updates reuse the compiled shader');
    material.needsUpdate=true;
    await renderer.compileAsync(scene,camera);
    renderer.render(scene,camera);
    for(const builder of builders){assert.equal(builder.nodes.size,0);assert.equal(builder.sequentialNodes.size,0);}
  } finally {release();geometry.dispose();material.dispose();await renderer.dispose();}
});
