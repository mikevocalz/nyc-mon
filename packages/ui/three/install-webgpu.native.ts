// react-native-webgpu installs navigator.gpu and the GPU* flag globals on the
// main JS runtime only. Called first inside a worklet on the render runtime,
// this installs them there (the GPU object crosses through the worklets custom
// serializer). Same `.ts` extension as the web fork, so Metro's fork order holds.
export { installWebGPU as installWebGPUOnRuntime } from 'react-native-webgpu';
