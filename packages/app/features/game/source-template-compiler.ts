import type { Three } from '@acme/ui/three';
import type { Camera, Mesh, Scene, WebGPURenderer, Object3D, Light, LightShadow } from 'three/webgpu';
import type { CityPostPipeline } from './post/pipeline.ts';
import { applyReversedDepthOffsets } from './world/reversed-depth-offset.ts';
import { withCompileProgressEvent } from './compile-progress-event.ts';
import type { SourceCompileProgress } from './scene-build-progress.ts';

/** Compile detached authentic templates against the live scene's lights and MRT, without publishing geometry. */
export function createSourceTemplateCompiler(THREE: Three, renderer: WebGPURenderer, scene: Scene, camera: Camera,
  pass: CityPostPipeline['scenePass'] | null, extraPasses: () => readonly {camera:Camera;target:ReturnType<WebGPURenderer['getRenderTarget']>}[] = () => [],
  onProgress?: (progress: SourceCompileProgress) => void) {
  let disposed = false;
  let tail = Promise.resolve();
  let pending = 0;
  let restoreFrameState: (() => void) | undefined;
  const check = (signal: AbortSignal) => {
    if (disposed || signal.aborted) { const error = new Error('Source template preparation aborted'); error.name = 'AbortError'; throw error; }
  };
  const progressFor = (kind: SourceCompileProgress['kind'], signal: AbortSignal) => {
    let last = -1;
    return (fraction: number) => {
      if (disposed || signal.aborted || !Number.isFinite(fraction)) return;
      const next = Math.min(1, Math.max(0, fraction));
      if (next <= last) return;
      last = next; onProgress?.({ kind, fraction: next });
    };
  };
  const compileFor = (signal:AbortSignal) => async (object: Object3D, view: Camera, target: ReturnType<WebGPURenderer['getRenderTarget']>,
    mrt: ReturnType<WebGPURenderer['getMRT']> | null, override = scene.overrideMaterial, progress?: (fraction: number) => void) => {
    const previousTarget = renderer.getRenderTarget(), previousMrt = renderer.getMRT();
    const previousOverride = scene.overrideMaterial;
    const previousFace = renderer.getActiveCubeFace(), previousMip = renderer.getActiveMipmapLevel();
    const restore = () => {
      renderer.setRenderTarget(previousTarget, previousFace, previousMip);
      renderer.setMRT(previousMrt);
      scene.overrideMaterial = previousOverride;
    };
    restoreFrameState = restore;
    const releaseProgress = withCompileProgressEvent();
    let last = -1;
    const advance = (fraction: number) => {
      if (disposed || signal.aborted || !Number.isFinite(fraction)) return;
      const next = Math.min(1, Math.max(0, fraction));
      if (next <= last) return;
      last = next; progress?.(next);
    };
    try {
      let compilation: Promise<void>;
      try {
        renderer.setRenderTarget(target);
        renderer.setMRT(mrt);
        scene.overrideMaterial = override;
        // Snapshot before the first yield. Only real render-object completion
        // reports with a known total advance this pass; unknown totals do not
        // become guessed steps or periodic watchdog heartbeats.
        compilation = renderer.compileAsync(object, view, scene, progress ? event => {
          const total = Number(event.total), loaded = Number(event.loaded);
          if (Number.isFinite(total) && total > 0 && Number.isFinite(loaded) && loaded >= 0 && loaded <= total) advance(loaded / total);
        } : undefined);
      } finally { restore(); }
      await compilation; check(signal); advance(1);
    } finally {
      try { restore(); }
      finally { restoreFrameState = undefined; releaseProgress(); }
    }
  };
  return {
    /** Cooperative compile work may reapply its MRT between yields; every visible frame starts in its own context. */
    beforeFrame() { restoreFrameState?.(); },
    prepare(templates: readonly Mesh[], signal: AbortSignal): Promise<void> {
      if (disposed || signal.aborted) return Promise.reject(Object.assign(new Error('Source template preparation aborted'), {name:'AbortError'}));
      pending++;
      const job = tail.then(async () => {
        check(signal);
        if (templates.some(template => template.parent !== null)) throw new Error('Source templates must remain detached until compiled');
        const group = new THREE.Group();
        const flags = templates.map(template => ({visible:template.visible,frustumCulled:template.frustumCulled}));
        for (const template of templates) { template.visible = true; template.frustumCulled = false; group.add(template); }
        applyReversedDepthOffsets(group, renderer);
        const compile = compileFor(signal);
        const progress = progressFor('templates', signal);
        try {
          // Three actual preparation stages: main, per-light shadow work and
          // auxiliary passes. Empty stages finish after their real inspection.
          await compile(group, camera, pass?.renderTarget ?? null, pass?.getMRT() ?? null, undefined, fraction => progress(fraction / 3));
          // r187 deliberately skips ShadowNode.updateBefore during compileAsync. Compile the same shared
          // per-light shadow material explicitly, so a late caster does not compile synchronously on first draw.
          const casts = (template: Mesh) => template.castShadow || (renderer.shadowMap.type === THREE.VSMShadowMap && template.receiveShadow);
          if (renderer.shadowMap?.enabled && templates.some(casts)) {
            const lights: (Light & {shadow: LightShadow})[] = [];
            scene.traverseVisible(object => {
              const light = object as Light & {shadow?: LightShadow};
              if (light.isLight && light.castShadow && light.shadow && light.layers.test(camera.layers)) lights.push(light as Light & {shadow:LightShadow});
            });
            for (const [lightIndex, light] of lights.entries()) {
              check(signal);
              const shadow = light.shadow;
              const cascaded = (light as Light & {isSunLight?:boolean}).isSunLight === true;
              const needsReceiver = !shadow.map;
              // A receiver initialization, when actually required, is one
              // prerequisite stage before the actual cascade count is known.
              const receiverShare = needsReceiver ? 0.5 : 0;
              const shadowProgress = (fraction: number) => progress((1 + (lightIndex + fraction) / lights.length) / 3);
              if (!light.shadow.map) {
                let receiver: Mesh | undefined;
                scene.traverseVisible(object => {
                  const mesh = object as Mesh;
                  if (!receiver && mesh.isMesh && mesh.receiveShadow && mesh.layers.test(camera.layers)) {
                    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                    if (materials.some(material => material.visible && ((material as typeof material & {lights?:boolean}).lights === true ||
                      ['MeshStandardMaterial','MeshPhysicalMaterial','MeshPhongMaterial','MeshLambertMaterial','MeshToonMaterial'].includes(material.type)))) receiver = mesh;
                  }
                });
                if (receiver) {
                  const culled = receiver.frustumCulled; receiver.frustumCulled = false;
                  try { await compile(receiver, camera, pass?.renderTarget ?? null, pass?.getMRT() ?? null, undefined, fraction => shadowProgress(fraction * receiverShare)); }
                  finally { receiver.frustumCulled = culled; }
                }
              }
              if (!light.shadow.map) throw new Error('Source shadow preparation requires the actual light shadow target');
              if ((light as Light & {isPointLight?:boolean}).isPointLight) throw new Error('Source Point-shadow pipeline preparation is not implemented');
              if (renderer.shadowMap.type === THREE.VSMShadowMap) throw new Error('Source VSM blur pipeline preparation is not implemented');
              if (cascaded) (shadow.updateMatrices as unknown as (light:Light,view:Camera)=>void)(light,camera);
              else shadow.updateMatrices(light);
              const shadowNode = new THREE.ShadowNode(light, light.shadow);
              for (const template of templates) template.visible = casts(template);
              const count = cascaded ? shadow.getViewportCount() : 1;
              for (let i = 0; i < count; i++) await compile(group, cascaded ? shadow.getCamera(i) : shadow.camera, shadow.map, null, shadowNode.getShadowMaterial(),
                fraction => shadowProgress(receiverShare + (1 - receiverShare) * (i + fraction) / count));
              for (const template of templates) template.visible = true;
            }
          }
          progress(2 / 3);
          const extras = extraPasses();
          for (const [index, extra] of extras.entries()) await compile(group,extra.camera,extra.target,null,undefined,
            fraction => progress((2 + (index + fraction) / extras.length) / 3));
          progress(1);
        }
        finally {
          restoreFrameState?.(); restoreFrameState = undefined;
          for (let i = 0; i < templates.length; i++) {
            const template = templates[i]!; group.remove(template);
            template.visible = flags[i]!.visible; template.frustumCulled = flags[i]!.frustumCulled;
          }
        }
      }).finally(() => { pending--; });
      tail = job.catch(() => {});
      return job;
    },
    /** Warm the complete initial scene against actual auxiliary targets before reveal. */
    prepareScene(signal:AbortSignal):Promise<void> {
      if(disposed||signal.aborted)return Promise.reject(Object.assign(new Error('Source scene preparation aborted'),{name:'AbortError'}));
      pending++;
      const job=tail.then(async()=>{
        check(signal);
        const flags:{mesh:Mesh;culled:boolean}[]=[];
        scene.traverseVisible(object=>{const mesh=object as Mesh;if(mesh.isMesh){flags.push({mesh,culled:mesh.frustumCulled});mesh.frustumCulled=false;}});
        const compile=compileFor(signal);
        const progress=progressFor('scene',signal);
        try {
          const extras=extraPasses();
          for(const [index,extra] of extras.entries())await compile(scene,extra.camera,extra.target,null,undefined,
            fraction=>progress((index+fraction)/extras.length));
          progress(1);
        }
        finally {for(const saved of flags)saved.mesh.frustumCulled=saved.culled;}
      }).finally(()=>{pending--;});
      tail=job.catch(()=>{});return job;
    },
    /** Closing rejects future work; resources/renderer must remain alive until the active job settles. */
    dispose(): void | Promise<void> { disposed = true; if (pending > 0) return tail; },
  };
}
