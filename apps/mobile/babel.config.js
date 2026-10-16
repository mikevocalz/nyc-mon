const { createRequire } = require('node:module');

const uiRequire = createRequire(require.resolve('@acme/ui'));
const typegpuBabel = uiRequire.resolve('unplugin-typegpu/babel');

// EXPO_PUBLIC_WORKLET_RENDER=1 turns on react-native-worklets Bundle Mode for
// the opt-in worklet render runtime (docs/implementation/worklet-rendering.md).
// Unset, the plugin gets no options: the default build is unchanged. Bundle
// Mode changes how every worklet in the app compiles, so toggling the flag
// needs `expo start --clear` (Metro's transform cache does not see it).
const workletRender = /^(1|true|worklet)$/i.test((process.env.EXPO_PUBLIC_WORKLET_RENDER ?? '').trim());
const workletsPlugin = workletRender
  ? [
      'react-native-worklets/plugin',
      {
        bundleMode: true,
        // Worklets in these files may import from relative modules; the
        // render runtime evaluates those modules itself (three.js and the city).
        importForwarding: { relativePaths: ['features/game/render-runtime'] },
      },
    ]
  : 'react-native-worklets/plugin';

module.exports = function (api) {
  api.cache.using(() => String(workletRender));
  return {
    presets: ['babel-preset-expo'],
    // TypeGPU is owned by @acme/ui, where the shader source lives
    // (backgrounds/CityBlocks.gpu.ts). Resolve from that workspace explicitly so pnpm's strict node_modules
    // layout does not make Metro search from apps/mobile and miss the plugin.
    plugins: [typegpuBabel, workletsPlugin],
  };
};
