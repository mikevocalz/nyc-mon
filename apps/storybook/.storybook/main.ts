import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import react from '@vitejs/plugin-react';

const here = dirname(fileURLToPath(import.meta.url));

// pnpm installs isolated, so a dependency of @acme/ui is only reachable from
// @acme/ui itself. Resolve through its manifest instead of guessing a
// hoisted ../../node_modules path.
const uiManifest = resolve(here, '../../../packages/ui/package.json');
const requireFromUi = createRequire(uiManifest);
// @legendapp/motion's package entry is `export * from './lib/commonjs'`,
// which the optimizer cannot enumerate, so named exports such as
// AnimatePresence disappear. Its ESM build exports them statically.
const legendMotionEsm = resolve(
  dirname(requireFromUi.resolve('@legendapp/motion/package.json')),
  'lib/module/index.js',
);

// Reanimated hooks need the worklets Babel plugin (apps/mobile/babel.config.js
// runs it), or `useAnimatedStyle` without a dependency array throws in dev
// (EggCase, ScannerLed, MonStillReaction, HatchSequence). plugin-react 6 has
// no Babel step, so a pre-transform runs that one plugin over kit sources.
// Resolved the same way as above: through the packages that depend on them.
const requireFromReanimated = createRequire(requireFromUi.resolve('react-native-reanimated/package.json'));
const workletsPlugin = requireFromReanimated.resolve('react-native-worklets/plugin');
const babelCorePath = createRequire(requireFromReanimated.resolve('react-native-worklets/package.json')).resolve('@babel/core');
const kitSources = resolve(here, '../../../packages');
const WORKLET_HINT = /\b(useAnimatedStyle|useAnimatedProps|useDerivedValue|useAnimatedReaction|useFrameCallback|'worklet')/;

function workletsTransform(): import('vite').Plugin {
  return {
    name: 'nyc-mon:worklets',
    enforce: 'pre',
    async transform(code, id) {
      const file = id.split('?')[0] ?? id;
      if (!file.startsWith(kitSources) || !/\.[jt]sx?$/.test(file) || !WORKLET_HINT.test(code)) return null;
      const babel = (await import(pathToFileURL(babelCorePath).href)) as typeof import('@babel/core');
      const out = await babel.transformAsync(code, {
        filename: file,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        parserOpts: { plugins: ['jsx', 'typescript'] },
        plugins: [workletsPlugin],
      });
      return out?.code ? { code: out.code, map: out.map } : null;
    },
  };
}

const WEB_EXTENSIONS =['.web.tsx', '.web.ts', '.web.jsx', '.web.js'];
// Vite's built-in `resolve.extensions` default.
const VITE_DEFAULT_EXTENSIONS = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'];

// Stories live co-located with components in packages/* (§3.2);
// this app only configures and aggregates.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  typescript: { reactDocgen: false },
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  stories: [
    '../../../packages/ui/*.stories.@(ts|tsx)',
    '../../../packages/ui/primitives/*.stories.@(ts|tsx)',
    // packages/app has no stories yet, and Storybook warns on every pattern
    // that matches nothing. Re-add this line when the first feature story
    // lands (features live at packages/app/features/<name>/, so the glob
    // needs the feature-name level — the old `app/*/components/*` pattern
    // resolved to packages/app/features/components/ and never matched):
    //   '../../../packages/app/features/*/**/*.stories.@(ts|tsx)',
  ],
  viteFinal: async (viteConfig) => {
    // TypeGPU's 'use gpu' functions are compiled to WGSL by unplugin-typegpu
    // (Next and Expo run its Babel build). Resolved through @acme/ui, which
    // owns the GPU foundation.
    // require.resolve from @acme/ui lands on the CJS build, whose module
    // namespace nests the plugin factory one `default` deeper than ESM.
    type PluginFactory = (options?: object) => import('vite').PluginOption;
    const typegpuModule = (await import(
      pathToFileURL(requireFromUi.resolve('unplugin-typegpu/vite')).href
    )) as { default: PluginFactory | { default: PluginFactory } };
    const typegpu =
      typeof typegpuModule.default === 'function' ? typegpuModule.default : typegpuModule.default.default;
    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
      workletsTransform(),
      typegpu(),
      react(),
    ];
    const existingAlias = viteConfig.resolve?.alias;
    const aliasEntries = Array.isArray(existingAlias)
      ? existingAlias
      : Object.entries(existingAlias ?? {}).map(([find, replacement]) => ({
          find,
          replacement,
        }));

    viteConfig.resolve = {
      ...(viteConfig.resolve ?? {}),
      // Prefer web platform files exactly like Metro/Next do, then fall back
      // to the plain extensions. Setting `extensions` replaces Vite's default
      // list rather than extending it, and Storybook 10 passes none in, so
      // the plain `.tsx`/`.ts` entries must be spelled out here or every
      // extensionless import (`./Button`, `../tw`) fails to resolve.
      extensions: [
        ...WEB_EXTENSIONS,
        ...(viteConfig.resolve?.extensions ?? VITE_DEFAULT_EXTENSIONS).filter(
          (extension) => !WEB_EXTENSIONS.includes(extension),
        ),
      ],
      alias: [
        // @expo/html-elements imports RNW internals directly. Under pnpm's
        // strict graph Vite can otherwise turn those optional-peer imports
        // into virtual stubs, so resolve both the root and every deep RNW path
        // to the Storybook workspace's concrete installation.
        {
          find: /^react-native-web\/(.*)$/,
          replacement: `${resolve(here, '../node_modules/react-native-web')}/$1`,
        },
        {
          find: /^react-native-web$/,
          replacement: resolve(here, '../node_modules/react-native-web/dist/index.js'),
        },
        // react-native-svg's resolveAssetUri imports
        // `@react-native/assets-registry/registry`, which React Native 0.88
        // no longer installs, so the svg dep fails to load (EggCase,
        // IncubationRing). react-native-web ships the same registry
        // (registerAsset / getAssetByID); point at it like the RNW aliases above.
        {
          find: /^@react-native\/assets-registry\/registry$/,
          replacement: resolve(here, '../node_modules/react-native-web/dist/modules/AssetRegistry/index.js'),
        },
        { find: /^@legendapp\/motion$/, replacement: legendMotionEsm },
        {
          find: /^react-native$/,
          replacement: resolve(here, '../node_modules/react-native-web/dist/index.js'),
        },
        ...aliasEntries.filter(
          (entry) => entry.find !== 'react-native' && entry.find !== 'react-native-web',
        ),
      ],
      dedupe: [
        ...(viteConfig.resolve?.dedupe ?? []),
        'react',
        'react-dom',
        'react-native-web',
      ],
    };
    viteConfig.server = { ...(viteConfig.server ?? {}), hmr: false };
    viteConfig.optimizeDeps = {
      ...(viteConfig.optimizeDeps ?? {}),
      // @expo/html-elements has a .tsx entry Vite refuses to optimize, so its
      // import chain into react-native-web/dist is served raw. Every CJS dep
      // that chain touches must be pre-bundled explicitly (exact subpaths) or
      // the browser gets CJS files with no ESM exports.
      //
      // pnpm 12 installs isolated (it no longer reads `node-linker` from
      // .npmrc), so none of these transitive deps sit in a node_modules that
      // apps/storybook can see. The `parent > dep` form tells Vite to resolve
      // each one from the package that actually depends on it.
      include: [
        ...(viteConfig.optimizeDeps?.include ?? []),
        // CJS deps of @legendapp/motion (a dependency of @acme/ui)
        '@acme/ui > @legendapp/motion > @legendapp/tools',
        '@acme/ui > @legendapp/motion > @legendapp/tools/react',
        'react-native-web',
        ...[
          '@react-native/normalize-colors',
          'styleq',
          'styleq/transform-localize-style',
          'postcss-value-parser',
          'memoize-one',
          'nullthrows',
          'fbjs/lib/invariant',
          'inline-style-prefixer/lib/createPrefixer',
          'inline-style-prefixer/lib/plugins/crossFade',
          'inline-style-prefixer/lib/plugins/imageSet',
          'inline-style-prefixer/lib/plugins/logical',
          'inline-style-prefixer/lib/plugins/position',
          'inline-style-prefixer/lib/plugins/sizing',
          'inline-style-prefixer/lib/plugins/transition',
        ].map((dep) => `react-native-web > ${dep}`),
      ],
      rolldownOptions: {
        ...(viteConfig.optimizeDeps?.rolldownOptions ?? {}),
        resolve: {
          ...(viteConfig.optimizeDeps?.rolldownOptions?.resolve ?? {}),
          // The optimizer bundles with its own extension list
          // (.tsx/.ts/.jsx/.js), ignoring `resolve.extensions` above. Without
          // the web entries it picks Skia's native `specs/*.js` over the
          // `.web.js` siblings and fails on TurboModuleRegistry.
          extensions: [...WEB_EXTENSIONS, '.tsx', '.ts', '.jsx', '.js', '.css', '.json'],
        },
      },
    };
    return viteConfig;
  },
};

export default config;
