/// <reference types="@webgpu/types" />
// Web and node: Skia shares its device on native only (react-native-skia 3.6.1
// lib/typescript/src/skia/types/Skia.d.ts `getNativeDevice`, "Native only").
// The throw sends acquireSharedOrOwnDevice to the app's own device.
export function importSharedDevice(): GPUDevice {
  throw new Error('Skia shares its GPU device on native only; using the own device');
}
