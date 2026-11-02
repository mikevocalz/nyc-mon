/// <reference types="@webgpu/types" />
import { Skia } from 'react-native-skia';
import { importDevice } from 'react-native-webgpu';

/**
 * Skia's Graphite device as a GPUDevice: react-native-skia 3.6.1
 * `Skia.getNativeDevice()` (lib/typescript/src/skia/types/Skia.d.ts) wrapped
 * by react-native-webgpu 0.16.0 `importDevice` (src/importDevice.ts). Sound
 * because both packages link one Dawn and share its wgpu::Instance
 * (react-native-webgpu docs, integrations/react-native-skia.mdx; 0.16.x pairs
 * with Skia 3.4.0 to 3.6.3). Throws when react-native-webgpu is not
 * installed natively.
 */
export function importSharedDevice(): GPUDevice {
  return importDevice(Skia.getNativeDevice());
}
