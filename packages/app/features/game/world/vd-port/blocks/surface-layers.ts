import { platformIo } from '#cell-source-platform';
import type { VdPortCtx, VdStreamLayer } from '../types.ts';
import { cellNum, type CellPackage } from '../../cells/cell-rules.ts';
import { ditherFadeMask, type ExternalBudget } from '../../cells/cell-stream.ts';
import { lazyNearPackage, nearCellBytes, type NearCellInfo, type NearCellResources } from './codec.ts';
import type { createSurfaceMaterialBank } from './surface-material-bank.ts';
import type { createNearCohortMask } from './cohort-mask.ts';

const dithered = new WeakSet<object>();

const sourceDiagnostics=new WeakMap<VdPortCtx,{attached:number}>();

type Bank = Awaited<ReturnType<typeof createSurfaceMaterialBank>>;
export interface SurfaceCellInfo extends NearCellInfo {
  family: number; textures: readonly number[]; materials: readonly number[]; variants: readonly number[];
  sha256: string; fileBytes: number;
}

export type SurfaceCohortPlan = ReadonlyMap<number, { key: object; cells: SurfaceCellInfo[]; siblings: CellPackage[]; bounds: Float64Array; budget?: NonNullable<CellPackage['groupBudget']> }>;

/** Plan before registering any legacy siblings, so the stream sees the final shared group identity from the start. */
export function createSurfaceCohortPlan(cells: readonly SurfaceCellInfo[], siblings: readonly CellPackage[] = []): SurfaceCohortPlan {
  const groups = new Map<number, { key: object; cells: SurfaceCellInfo[]; siblings: CellPackage[]; bounds: Float64Array; budget?: NonNullable<CellPackage['groupBudget']> }>();
  const extend = (bounds: Float64Array, other: ArrayLike<number>) => {
    for (let c = 0; c < 3; c++) { bounds[c] = Math.min(bounds[c]!, other[c]!); bounds[c + 3] = Math.max(bounds[c + 3]!, other[c + 3]!); }
  };
  for (const info of cells) {
    const num = cellNum(info.cx, info.cz);
    let group = groups.get(num);
    if (!group) { group = { key: {}, cells: [], siblings: [], bounds: new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]) }; groups.set(num, group); }
    group.cells.push(info); extend(group.bounds, info.bounds);
  }
  for (const pkg of siblings) {
    const group = groups.get(pkg.num);
    if (!group) continue;
    if (pkg.triangles === undefined) throw new Error('Source cohort sibling needs explicit triangle metadata');
    group.siblings.push(pkg); extend(group.bounds, pkg.bounds);
    Object.assign(pkg, { group: group.key, demandBounds: group.bounds });
  }
  for(const group of groups.values()){
    group.budget={cells:group.cells.length+group.siblings.length,
      bytes:group.cells.reduce((sum,cell)=>sum+nearCellBytes(cell),0)+group.siblings.reduce((sum,pkg)=>sum+pkg.bytes,0),
      triangles:group.cells.reduce((sum,cell)=>sum+cell.triangles,0)+group.siblings.reduce((sum,pkg)=>sum+pkg.triangles!,0),
      vertices:group.cells.reduce((sum,cell)=>sum+cell.vertices,0)+group.siblings.reduce((sum,pkg)=>sum+pkg.vertexCount,0)};
    for(const pkg of group.siblings)Object.assign(pkg,{groupBudget:group.budget});
  }
  return groups;
}

/** Stable mask/template identity, including a logical cohort when activating bounded subsets. */
export function surfaceTemplateName(info: SurfaceCellInfo, family: number, tag?: string): string {
  return `city:vd-blocks-source:${info.surface!.sha256.slice(0,12)}:f${family}${tag ? `:${tag}` : ''}`;
}

/** Register a complete, authenticated source set before the prereveal asset gate resolves. */
export async function registerSurfaceLayers(ctx: VdPortCtx, options: {
  bank: Bank;
  suppressed?(): boolean;
  decoratePackage?(info: SurfaceCellInfo, pkg: CellPackage): CellPackage;
  cells: readonly SurfaceCellInfo[];
  lease: ReturnType<Bank['lease']>;
  cohorts: ReturnType<typeof createNearCohortMask>;
  plan?: SurfaceCohortPlan;
  budget: ExternalBudget;
  layer: VdStreamLayer;
  readCell(info: SurfaceCellInfo, signal?: AbortSignal): Promise<Uint8Array>;
  sha256Hex?: (bytes: Uint8Array) => Promise<string>;
  signal?: AbortSignal;
  /** Authenticate and compile real templates before any source package can become visible. */
  prepareTemplates?(templates: readonly InstanceType<VdPortCtx['THREE']['Mesh']>[], signal?: AbortSignal): Promise<void>;
  /** Full metadata was already registered with the atomic shell mask. */
  cohortsPlanned?: boolean;
  /** Stable logical cohort suffix when registering bounded subsets. */
  cohortTag?: string;
}) {
  const { THREE } = ctx;
  const geometries: InstanceType<typeof THREE.BufferGeometry>[] = [];
  const templates: InstanceType<typeof THREE.Mesh>[] = [];
  const packages: CellPackage[] = [];
  const registrations: { template: InstanceType<typeof THREE.Mesh>; packages: CellPackage[] }[] = [];
  const resourceOwners: NearCellResources[] = [];
  const files = new Map<string, Uint8Array>();
  const lifetime = new AbortController();
  let committed = false;
  const check = () => { if (disposed || (!committed && options.signal?.aborted)) { const error = new Error('Source family registration aborted'); error.name = 'AbortError'; throw error; } };
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true; lifetime.abort();
    for (const pkg of packages) { pkg.release?.(); pkg.releaseResources?.(); }
    for (const resources of resourceOwners) resources.release?.();
    files.clear();
    for (const mesh of templates) ctx.group.remove(mesh);
    for (const geometry of geometries) geometry.dispose();
  };
  try {
    check();
    if (!options.lease.ready()) throw new Error('Source templates need their complete initial page cohort');
    const groups = options.plan ?? createSurfaceCohortPlan(options.cells);
    for (const info of options.cells) {
      if (typeof info.wide !== 'boolean' || !info.materials.length || !info.variants.length) throw new Error(`Source cell ${info.key} has incomplete family metadata`);
      if (!groups.has(cellNum(info.cx, info.cz))) throw new Error('Source cohort plan is incomplete');
    }
    for (const group of groups.values()) {
      if (group.cells.length + group.siblings.length > options.budget.cellDraws || group.cells.reduce((n, info) => n + nearCellBytes(info), 0) + group.siblings.reduce((n, pkg) => n + pkg.bytes, 0) > options.budget.geometryBytes ||
        group.cells.reduce((n, info) => n + info.triangles, 0) + group.siblings.reduce((n, pkg) => n + pkg.triangles!, 0) > options.budget.triangles ||
        (options.budget.vertices !== undefined && group.cells.reduce((n, info) => n + info.vertices, 0) + group.siblings.reduce((n, pkg) => n + pkg.vertexCount, 0) > options.budget.vertices)) {
        throw new Error('A complete authored source cohort exceeds its explicit admission budget');
      }
    }
    for (const info of options.cells) {
      check();
      if (!/^[a-f0-9]{64}$/.test(info.sha256)) throw new Error(`Source cell ${info.key} has no binary identity`);
      const bytes = new Uint8Array(await options.readCell(info, options.signal));
      check();
      if (bytes.byteLength !== info.fileBytes || await (options.sha256Hex ?? ((input) => platformIo().sha256Hex(input)))(bytes) !== info.sha256) throw new Error(`Source cell ${info.key} binary verification failed`);
      check(); files.set(info.key, bytes);
      ctx.onAssetProgress?.({kind:'cell-ready',id:info.key});
    }
    const byFamily = new Map<number, CellPackage[]>();
    for (const info of options.cells) {
      check();
      const group = groups.get(cellNum(info.cx, info.cz))!;
      const pages = options.bank.resources(info, group.cells);
      let resourceEpoch=0, wanted=true;
      let pending: Promise<boolean> | undefined;
      const resources: NearCellResources = {
        ready:()=>wanted && files.has(info.key) && pages.ready(),
        get error(){return pages.error;},
        release(){wanted=false;resourceEpoch++;pending=undefined;files.delete(info.key);pages.release?.();},
        prefetch(){
          wanted=true;
          if(pending)return pending;
          const epoch=resourceEpoch;
          const request=(async()=>{
          const [snapshot,ready]=await Promise.all([
            files.has(info.key) ? Promise.resolve(files.get(info.key)!) : (async()=>{
              const bytes=new Uint8Array(await options.readCell(info,committed ? lifetime.signal : options.signal));check();
              if(bytes.byteLength!==info.fileBytes || await (options.sha256Hex ?? ((input)=>platformIo().sha256Hex(input)))(bytes)!==info.sha256)throw new Error(`Source cell ${info.key} binary verification failed`);
              check();return bytes;
            })(),pages.prefetch(),
          ]);
          check();
          if(!wanted || epoch!==resourceEpoch)return false;
          files.set(info.key,snapshot);return ready;
          })().finally(()=>{if(epoch===resourceEpoch && pending===request)pending=undefined;});
          pending=request;
          return request;
        },
      };
      resourceOwners.push(resources);
      if (!await resources.prefetch()) throw resources.error ?? new Error(`Source cell ${info.key} page cohort could not become ready`);
      check();
      let pkg: CellPackage = Object.assign(lazyNearPackage(info, () => files.get(info.key)!, 'cell-local', resources), {
        group: group.key, demandBounds: group.bounds, groupBudget:group.budget,
        ...(options.suppressed ? {suppressed:options.suppressed} : {}),
      });
      pkg = options.decoratePackage?.(info, pkg) ?? pkg;
      if(ctx.log){
        const onAttach=pkg.onAttach;
        pkg.onAttach=mesh=>{onAttach?.(mesh);let counts=sourceDiagnostics.get(ctx);if(!counts){counts={attached:0};sourceDiagnostics.set(ctx,counts);}
          if(counts.attached++<64)ctx.log?.('source-attached',{key:info.key,family:info.family,cohort:pkg.num,triangles:info.triangles,name:mesh.name});};
      }
      packages.push(pkg);
      const list = byFamily.get(info.family) ?? []; list.push(pkg); byFamily.set(info.family, list);
    }
    for (const [family, familyPackages] of byFamily) {
      check();
      const material = options.bank.material(family, options.lease);
      const masked = material as typeof material & { maskNode: ReturnType<typeof ditherFadeMask> | null };
      if (!dithered.has(material)) {
        const dither = ditherFadeMask(THREE);
        masked.maskNode = masked.maskNode ? masked.maskNode.and(dither) : dither;
        dithered.add(material);
      }
      const geometry = new THREE.BufferGeometry(); geometries.push(geometry);
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9).fill(1), 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
      const info = options.cells.find((cell) => cell.family === family)!;
      const surface = new Float32Array(12);
      for (let vertex = 0; vertex < 3; vertex++) { surface[vertex * 4] = info.materials[0]!; surface[vertex * 4 + 1] = info.variants[0]!; }
      geometry.setAttribute('aVdSurface', new THREE.BufferAttribute(surface, 4));
      geometry.setAttribute('aVdWeather', new THREE.BufferAttribute(new Float32Array(12), 4));
      geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
      geometry.userData.keepCpuArrays = true;
      const template = new THREE.Mesh(geometry, material); templates.push(template);
      registrations.push({template,packages:familyPackages});
      template.name = surfaceTemplateName(info,family,options.cohortTag);
      template.renderOrder = options.bank.renderOrder(family);
      const shadows = options.bank.shadowFlags(family);
      template.castShadow = shadows.cast; template.receiveShadow = shadows.receive;
      template.matrixAutoUpdate = false;


    }
    await options.prepareTemplates?.(templates, options.signal);
    check();
    for (const {template, packages:familyPackages} of registrations) {
      ctx.group.add(template);
      if (!options.cohortsPlanned) options.cohorts.register(template.name, familyPackages);
      ctx.registerChunks(template, { ...options.layer, sharedMaterial: true }, familyPackages, options.budget);
    }
    committed = true;
    return { dispose, registered: true, templates, packages, stats: { meshes: templates.length, triangles: options.cells.reduce((n, info) => n + info.triangles, 0), structures: 0 } };
  } catch (error) { dispose(); throw error; }
}
