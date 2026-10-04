const { createRequire } = require('node:module');

const uiRequire = createRequire(require.resolve('@acme/ui'));
const typegpuBabel = uiRequire.resolve('unplugin-typegpu/babel');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // TypeGPU is owned by @acme/ui, where the shader source lives
    // (backgrounds/CityBlocks.gpu.ts). Resolve from that workspace explicitly so pnpm's strict node_modules
    // layout does not make Metro search from apps/mobile and miss the plugin.
    plugins: [typegpuBabel, 'react-native-worklets/plugin'],
  };
};
