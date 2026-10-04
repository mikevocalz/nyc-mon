import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import react from '@vitejs/plugin-react';

const here = dirname(fileURLToPath(import.meta.url));

// pnpm installs isolated, so a dependency of @acme/ui is only reachable from
// @acme/ui itself. Resolve through its manifest instead of guessing a
// hoisted ../../node_modules path.
const requireFromUi = createRequire(resolve(here, '../../../packages/ui/package.json'));
// @legendapp/motion's package entry is `export * from './lib/commonjs'`,
// which the optimizer cannot enumerate, so named exports such as
// AnimatePresence disappear. Its ESM build exports them statically.
const legendMotionEsm = resolve(
  dirname(requireFromUi.resolve('@legendapp/motion/package.json')),
  'lib/module/index.js',
);

const WEB_EXTENSIONS = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js'];
// Vite's built-in `resolve.extensions` default.
const VITE_DEFAULT_EXTENSIONS = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'];

// Stories live co-located with components in packages/* (§3.2);
// this app only configures and aggregates.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  typescript: { reactDocgen: false },
  addons: ['@storybook/addon-a11y'],
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
    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
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
