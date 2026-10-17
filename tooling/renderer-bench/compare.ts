/**
 * Comparable WebGPU/WebGL2 captures for NYC-Mon's existing Three renderer
 * vs closed-beta PixiJS 3D. This module executes neither engine and contains
 * no fake FPS values; callers must supply measured frames with provenance.
 */
export type Engine = 'three-webgpu'|'pixijs3d';
export type Backend = 'webgpu'|'webgl2';
export interface RendererCapture {
  engine: Engine;
  backend: Backend;
  deviceClass: string;
  gpuModel: string;
  sceneId: string;
  buildId: string;
  cameraPathId: string;
  /** Shared canonical OSM tile geometry + content hash, not engine-specific bytes. */
  datasetDigest: string;
  widthPx: number;
  heightPx: number;
  devicePixelRatio: number;
  triangles: number;
  drawCalls: number;
  /** Effects/signature must match for a fair comparison. */
  qualitySignature: string;
  /** Milliseconds between physically presented frame timestamps, if available. */
  frameIntervalsMs: number[];
  /** CPU submission time; not interchangeable with GPU elapsed time. */
  cpuSubmitMs: number[];
  capturedFrom: 'physical-device'|'synthetic-test';
}
export interface TimingStats { frames:number; p50Ms:number; p90Ms:number; p99Ms:number; over60HzBudget:number }
const safe=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const matches=(value:unknown,max=256):value is string=>typeof value==='string'&&value.length>0&&value.length<=max;
function validSeries(series: unknown): series is number[] {
  return Array.isArray(series)&&series.length>=120&&series.length<=200_000&&
    series.every(x=>safe(x)&&x>0&&x<2000);
}
export function validateCapture(v:RendererCapture): void {
  if (!v || !['three-webgpu','pixijs3d'].includes(v.engine) ||
    !['webgpu','webgl2'].includes(v.backend) ||
    !matches(v.deviceClass)||!matches(v.gpuModel)||!matches(v.sceneId)||
    !matches(v.buildId)||!matches(v.cameraPathId)||!matches(v.datasetDigest)||
    !matches(v.qualitySignature)||!safe(v.widthPx)||!safe(v.heightPx)||
    v.widthPx<64||v.heightPx<64||v.widthPx>10000||v.heightPx>10000||
    !safe(v.devicePixelRatio)||v.devicePixelRatio<.5||v.devicePixelRatio>4||
    !Number.isSafeInteger(v.triangles)||v.triangles<=0||
    !Number.isSafeInteger(v.drawCalls)||v.drawCalls<=0||
    !validSeries(v.frameIntervalsMs)||!validSeries(v.cpuSubmitMs)||
    v.frameIntervalsMs.length!==v.cpuSubmitMs.length||
    !['physical-device','synthetic-test'].includes(v.capturedFrom)
  ) throw new Error('Invalid renderer capture');
}
export function timingStats(values:readonly number[]):TimingStats {
  const s=[...values].sort((a,b)=>a-b);
  const pct=(p:number)=>s[Math.ceil(p*s.length)-1]!;
  return {
    frames:s.length,
    p50Ms:pct(.5),
    p90Ms:pct(.9),
    p99Ms:pct(.99),
    over60HzBudget:s.filter(v=>v>1000/60).length,
  };
}
/**
 * Refuses mismatched content/device/settings, rather than awarding PixiJS or
 * Three a misleading victory based on the marketing demo's low scene cost.
 */
export function compareCaptures(a:RendererCapture,b:RendererCapture){
  validateCapture(a);validateCapture(b);
  if (a.engine===b.engine) throw new Error('Requires two different renderers');
  for (const key of ['backend','deviceClass','gpuModel','sceneId','cameraPathId',
    'datasetDigest','widthPx','heightPx','devicePixelRatio','triangles','qualitySignature'] as const)
    if (a[key]!==b[key]) throw new Error(`Not comparable: ${key}`);
  if(a.capturedFrom!=='physical-device'||b.capturedFrom!=='physical-device')
    throw new Error('No production renderer recommendation from synthetic samples');
  const three=a.engine==='three-webgpu'?a:b;
  const pixi=a.engine==='pixijs3d'?a:b;
  const threeFrame=timingStats(three.frameIntervalsMs);
  const pixiFrame=timingStats(pixi.frameIntervalsMs);
  return { sceneId:a.sceneId,deviceClass:a.deviceClass,backend:a.backend,
    threeFrame,pixiFrame,
    pixiP90DifferencePercent:(pixiFrame.p90Ms-threeFrame.p90Ms)/threeFrame.p90Ms*100,
    threeCpu:timingStats(three.cpuSubmitMs),
    pixiCpu:timingStats(pixi.cpuSubmitMs),
    drawCalls:{three:three.drawCalls,pixi:pixi.drawCalls},
    /** Comparison is diagnostic only; same quality and real device are necessary but not sufficient. */
    note:'Device-reported timing comparison; inspect visual fidelity, memory, GPU completion and frame pacing separately',
  };
}
