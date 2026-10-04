// Cross-platform WebGPU surface for TypeGPU scenes (web + iOS + Android).
export { GpuCanvas } from './GpuCanvas';
export { useGpuSupport, ensureGpu } from './gpu-store';
export type {
  GpuCanvasProps, GpuCanvasHandle, GpuContext, GpuFrame, GpuScene, GpuSetup, GpuSupport,
} from './types';
