/**
 * @shopify/react-native-skia is a pnpm alias of react-native-skia@3.0.2 (see
 * pnpm-workspace.yaml), kept only so react-native-graph's JS import resolves.
 * Autolinking would otherwise register the one directory twice, as two native
 * projects, and link Skia twice. The real name links it once.
 */
module.exports = {
  dependencies: {
    '@shopify/react-native-skia': { platforms: { android: null, ios: null } },
  },
};
