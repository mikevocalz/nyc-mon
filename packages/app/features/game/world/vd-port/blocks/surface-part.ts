import { createSourceAdmission } from './source-admission.ts';
import { createSourceVegetationActivity } from './source-vegetation-activity.ts';
import { WORLD_PRESETS } from '../../../perf/tier-presets.ts';
import { cellNum } from '../../cells/cell-rules.ts';
import { createSourceActivation, selectSourceCohorts } from './source-activation.ts';
import { createSourceVegetationClock } from './source-vegetation-clock.ts';
import type { createResidentCollisionScene } from '../../../resident-collision.ts';
import { collisionPackage } from './collision-package.ts';
import type { VdPortCtx, VdPortPart, VdStreamLayer } from '../types.ts';
import type { CellPackage } from '../../cells/cell-rules.ts';
import type { ExternalBudget } from '../../cells/cell-stream.ts';
import { createSourcePageLoader, type SourcePageManifest, type SourcePageSpec } from './source-page-loader.ts';
import { createSurfaceMaterialBank } from './surface-material-bank.ts';
import type { SurfaceRegistry } from './surface-registry.ts';
import { createSurfaceCohortPlan, surfaceTemplateName, registerSurfaceLayers, type SurfaceCellInfo, type SurfaceCohortPlan } from './surface-layers.ts';
import type { createNearCohortMask } from './cohort-mask.ts';

/** Loader-owned, hash-pinned source assets; no native resources are stored in serialized application state. */
export interface SourceBlockAssets {
  registry: SurfaceRegistry;
  expectedSha256: string;
  manifest: SourcePageManifest & { cityAORect: readonly number[] };
  cells: readonly SurfaceCellInfo[];
  materialBytes: number;
  admission?: { legacyMinimum: ExternalBudget };
  /** Explicit reviewed admission budget, shared by every family; never an implicit global preset increase. */
  budget: ExternalBudget;
  readPage(page: SourcePageSpec, signal: AbortSignal): Promise<Uint8Array>;
  readCell(info: SurfaceCellInfo, signal?: AbortSignal): Promise<Uint8Array>;
  sha256Hex?: (bytes: Uint8Array) => Promise<string>;
}

export function buildSourceSurfacePart(ctx: VdPortCtx, source: SourceBlockAssets,
  cohorts: ReturnType<typeof createNearCohortMask>, layer: VdStreamLayer, plan?: SurfaceCohortPlan, collision?: { scene: ReturnType<typeof createResidentCollisionScene>; region: readonly [number, number, number, number, number, number] }): VdPortPart {
  const vegetationFamilies=new Set(source.registry.families.filter(family=>family.name==='source-vegetation').map(family=>family.id));
  const vegetation = vegetationFamilies.size ? createSourceVegetationClock(ctx.THREE,ctx.env.wet,ctx.env.snow) : undefined;
  const trace=(stage:string,data:Record<string,unknown>={})=>ctx.log?.('source-assets',{stage,...data});
  trace('constructed',{cells:source.cells.length});
  const controller = new AbortController();
  let disposed = false;
  let bank: Awaited<ReturnType<typeof createSurfaceMaterialBank>> | undefined;
  let activation: ReturnType<typeof createSourceActivation> | undefined;
  let admission: ReturnType<typeof createSourceAdmission> | undefined;
  let admitted = new Set<number>();
  const applyAdmission=(ids:readonly number[])=>{admitted=new Set(ids);wantedIds=ids;activity.setWanted(ids);};
  let initialDone = false, demandKey = '', failure: unknown;
  let wantedIds:readonly number[]=[];const reportedMasks=new Map<number,string>();let maskReports=0;
  type View = { camera: {x:number;y:number;z:number}; k:number; startRadius:number };
  let start!: (view: View) => void, rejectStart!: (error: unknown) => void;
  let started = false;
  const initial = new Promise<View>((resolve,reject) => { start=resolve; rejectStart=reject; });
  void initial.catch(() => {});
  const groups = plan ?? createSurfaceCohortPlan(source.cells);
  const activity=createSourceVegetationActivity(new Set([...groups].filter(([,group])=>group.cells.some(cell=>vegetationFamilies.has(cell.family))).map(([id])=>id)));
  const preset=ctx.preset ?? WORLD_PRESETS['ipad-a12x'];
  const select=(camera:View['camera'],k:number,startRadius?:number)=>selectSourceCohorts(groups,{camera,k,layer,
    residentRadius:preset.residentRadiusM,screenErrorPx:preset.screenErrorPx,hysteresis:preset.hysteresis,startRadius});
  for(const [id,group] of groups)for(const pkg of group.siblings){const prior=pkg.suppressed;pkg.suppressed=()=>!admitted.has(id)||prior?.()===true;}
  // Declare the complete replacement before any source cohort can draw.
  for (const [id,group] of groups) for (const family of new Set(group.cells.map(cell=>cell.family))) {
    const cells=group.cells.filter(cell=>cell.family===family);
    cohorts.register(surfaceTemplateName(cells[0]!,family,String(id)),cells.map(cell=>({num:cellNum(cell.cx,cell.cz)})));
  }
  const check = () => { if (disposed) { const error = new Error('Source block preparation aborted'); error.name = 'AbortError'; throw error; } };
  const dispose = () => {
    if (disposed) return;
    disposed = true; admitted.clear();
    controller.abort();
    rejectStart(new Error('Source surface disposed before START'));
    activity.dispose();activation?.dispose(); bank?.dispose();
  };
  const ready = (async () => {
    try {
      const namespace = `blocks-${source.expectedSha256.slice(0, 12)}`;
      const loader = createSourcePageLoader(ctx.THREE, { namespace, manifest: source.manifest,
        ...(ctx.hasTextureFeature ? { hasFeature: ctx.hasTextureFeature } : {}),
        readPayload: (page, signal) => source.readPage(page, signal),
        onReady:id=>ctx.onAssetProgress?.({kind:'page-ready',id}), ...(source.sha256Hex ? { sha256Hex: source.sha256Hex } : {}) });
      bank = await createSurfaceMaterialBank(ctx.THREE, { registry: source.registry, expectedSha256: source.expectedSha256,
        manifest: source.manifest, namespace, loader, limitBytes: source.materialBytes, signal: controller.signal,
        ...(vegetation ? {vegetation:vegetation.dynamics} : {}),
        environment: { night: ctx.night, reflectionGain: ctx.env.reflGain, sunDirection: ctx.env.sunDir, sunColor: ctx.env.sunColor,
          // The source's uZenC is ENV.skyAmbient (kitMats545/pbrLib873/materials1028), not the dome zenith.
          zenith: ctx.env.skyAmbient, horizon: ctx.env.fogColor }, ...(source.sha256Hex ? { sha256Hex: source.sha256Hex } : {}) });
      check();trace('bank-ready');
      admission=createSourceAdmission(groups,{materialBytes:source.materialBytes,parameterBytes:bank.parameterBytes,geometry:source.budget,
        legacyMinimum:source.admission?.legacyMinimum ?? preset.vdPort.blocksNear,pages:cells=>bank!.pageRequirements(cells)});
      activation=createSourceActivation({wake:()=>ctx.wake?.(),async activate(id,signal){
        const group=groups.get(id);
        if(!group)throw new Error('Unknown source cohort');
        const lease=bank!.lease(group.cells);
        try {
          trace('cohort-pages',{id,cells:group.cells.length});
          if(!await lease.prefetch())throw lease.error ?? new SourceAdmissionPending();
          trace('cohort-pages-ready',{id});
          if(signal.aborted) {const error=new Error('Source activation aborted');error.name='AbortError';throw error;}
          if(!ctx.prepareTemplates)throw new Error('Authored source template compiler is not installed');
          const registered=await registerSurfaceLayers(ctx,{bank:bank!,cells:group.cells,lease,cohorts,budget:source.budget,layer,
            readCell:(info,readSignal)=>source.readCell(info,readSignal),signal,plan:groups,cohortTag:String(id),cohortsPlanned:true,
            suppressed:()=>!admitted.has(id),
            ...(collision ? { decoratePackage: (info: SurfaceCellInfo, pkg: CellPackage) => {
              const policy = bank!.collisionPolicy(info.family);
              return policy.camera || policy.body ? collisionPackage(ctx.THREE, pkg, collision.scene, collision.region, policy) : pkg;
            } } : {}),
            prepareTemplates:async(templates,compileSignal)=>{trace('compile',{id,templates:templates.length});ctx.onAssetProgress?.({kind:'compile-start',id});await ctx.prepareTemplates!(templates,compileSignal!);ctx.onAssetProgress?.({kind:'compile-ready',id});trace('compiled',{id});},
            ...(source.sha256Hex?{sha256Hex:source.sha256Hex}:{})});
          trace('registered',{id,packages:registered.packages.length});
          const foliage=registered.packages.filter((_pkg,index)=>vegetationFamilies.has(group.cells[index]!.family));
          const remove=activity.register(id,()=>foliage.some(pkg=>pkg.ready?.()===true));
          return {...registered,dispose(){remove();registered.dispose();}};
        } finally {lease.release();}
      }});
      const view=await initial;
      check();
      const initialIds=admission.select(select(view.camera,view.k,view.startRadius));
      trace('start-selected',{cohorts:initialIds});
      const initialCells=initialIds.flatMap(id=>groups.get(id)!.cells);
      ctx.onAssetProgress?.({kind:'source-plan',cohorts:initialIds,cells:initialCells.map(cell=>cell.key),pages:bank.pageRequirements(initialCells).map(page=>page.id)});
      applyAdmission(initialIds);await activation.request(initialIds);
      check();initialDone=true;trace('ready');
    } catch (error) { dispose(); throw error; }
  })();
  // The containing numeric generator may yield before its aggregate is created. Observe immediately, retaining rejection.
  void ready.catch(() => {});
  return { ready, dispose, get animated(){return activity.animated;},
    prime(camera,k,startRadius){trace('prime',{camera,k,startRadius});if(!started){started=true;start({camera:{...camera},k,startRadius});}return ready;},
    demand(camera,k){
      if(failure)throw failure;
      if(!initialDone || !activation)return false;
      const ids=admission!.select(select(camera,k)),key=ids.join(',');applyAdmission(ids);
      if(key!==demandKey){demandKey=key;void activation.request(ids).catch((error:unknown)=>{
        if(error instanceof SourceAdmissionPending)demandKey='';
        else if((error as Error)?.name!=='AbortError')failure=error;
      }).finally(()=>{if(!disposed)ctx.wake?.();});}
      return activation.busy;
    },
    update(timeS,reducedMotion=false){
      vegetation?.update(timeS,reducedMotion || !activity.animated);
      if(ctx.log && maskReports<128)for(const id of wantedIds){
        const status=cohorts.status(id),key=JSON.stringify(status);
        if(reportedMasks.get(id)!==key){reportedMasks.set(id,key);maskReports++;trace('mask',{id,...status});}
      }
    },
    // Actual streamed triangles belong to the cell stream's counters; these are zero-area family templates.
    stats: { meshes: new Set(source.cells.map((cell) => cell.family)).size, triangles: 0, structures: 0 } };
}

class SourceAdmissionPending extends Error { constructor(){super('Authored source cohort awaits its bounded page budget');} }
