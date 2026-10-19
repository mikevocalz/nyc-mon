// Web and node: there are no worklet render runtimes to install WebGPU on.
// The native fork (`install-webgpu.native.ts`) re-exports react-native-webgpu's.
export const installWebGPUOnRuntime = (): void => {
  'worklet';
};
