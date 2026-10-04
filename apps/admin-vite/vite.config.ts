/**
 * The Payload admin and API host, and nothing else (docs/adr/0003-admin-app-split.md).
 *
 * Ported from MoyoLearn's apps/admin-vite (its ADR-004), which split the admin
 * out of a TanStack Start marketing app after measuring what RSC cost the
 * marketing bundle. Here the product site stays on Next (apps/web) and this
 * app owns `/admin` and `/payload-api`, including Better Auth at
 * `/payload-api/auth` (ADR 0001).
 *
 * `withPayload` from `@payloadcms/tanstack-start` owns the base config in its
 * "guest mode": it aliases `@payload-config`, externalises what the RSC/SSR
 * environments need and adds its own workaround plugins, and this file adds
 * exactly one copy of each framework plugin. `@vitejs/plugin-rsc` is a hard
 * singleton; two copies load two module registries and the admin's Flight
 * payload decodes against the wrong one.
 *
 * The ops console renders `@acme/ui` inside Payload's custom views
 * (docs/design/admin/08-handoff.md P1-P5), so this file also carries the
 * react-native-web half of apps/storybook/.storybook/main.ts: the
 * `react-native` alias, `.web.*` resolution, CJS pre-bundling and SSR
 * inlining. Tailwind runs through postcss.config.mjs, scoped to the console
 * root. The kit enters through `@acme/ui/admin` only (G19).
 *
 * `global`: `withPayload` defines it as `globalThis` for every environment.
 * MoyoLearn's ADR-003 broke on `vite-plugin-react-native-web`, whose config
 * hook redefines it as `self` and kills `@payloadcms/ui`'s server-side
 * `global._payload_clientConfigs`. That plugin is deliberately not used here;
 * nothing in this file touches `global`.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/withPayload/index.d.ts (withPayload)
 *      node_modules/@tanstack/react-start/dist/esm/plugin/vite.d.ts (tanstackStart)
 *      https://github.com/payloadcms/payload/tree/main/packages/tanstack-start
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withPayload } from '@payloadcms/tanstack-start';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import rsc from '@vitejs/plugin-rsc';
import { nitro } from 'nitro/vite';
import { defineConfig, type ConfigEnv, type UserConfig } from 'vite';

const src = fileURLToPath(new URL('./src', import.meta.url));
const appTsconfig = fileURLToPath(new URL('./tsconfig.json', import.meta.url));

/** The one shared Payload config. This app consumes it and never extends it. */
const payloadConfigPath = fileURLToPath(
  new URL('../../packages/payload/src/payload.config.ts', import.meta.url),
);

/**
 * 5174 so this runs beside apps/web (3000) and Storybook. `strictPort`
 * because Better Auth's baseURL and Payload's cors/csrf lists name this
 * origin: a silently reassigned port turns every sign-in POST into a
 * rejected origin, which looks like a wrong password.
 */
const DEV_PORT = 5174;

// --- react-native-web (P1), ported from apps/storybook/.storybook/main.ts ----

const here = dirname(fileURLToPath(import.meta.url));
const requireFromApp = createRequire(import.meta.url);
// pnpm installs isolated: a dependency of @acme/ui resolves only from @acme/ui.
const requireFromUi = createRequire(requireFromApp.resolve('@acme/ui'));
const rnwRoot = resolve(here, 'node_modules/react-native-web');
// @legendapp/motion's entry is `export * from './lib/commonjs'`, which the
// optimizer cannot enumerate, so named exports vanish. Its ESM build is static.
const legendMotionEsm = resolve(
  dirname(requireFromUi.resolve('@legendapp/motion/package.json')),
  'lib/module/index.js',
);

const WEB_EXTENSIONS = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js'];
/** Platform files first, exactly as Metro and Next resolve them for web. */
const RESOLVE_EXTENSIONS = [...WEB_EXTENSIONS, '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'];

const rnwAlias = [
  // @expo/html-elements imports RNW internals by deep path; send every one to
  // this app's concrete install so pnpm's strict graph cannot stub them.
  { find: /^react-native-web\/(.*)$/, replacement: `${rnwRoot}/$1` },
  { find: /^react-native-web$/, replacement: `${rnwRoot}/dist/index.js` },
  { find: /^react-native$/, replacement: `${rnwRoot}/dist/index.js` },
  { find: /^@legendapp\/motion$/, replacement: legendMotionEsm },
];

/**
 * CJS reached from the kit's raw (unoptimised) import chains. `parent > dep`
 * resolves each from the package that depends on it (pnpm isolation).
 */
const rnwCjsDeps = [
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
].map((dep) => `react-native-web > ${dep}`);

const kitOptimizeInclude = [
  '@acme/ui > @legendapp/motion > @legendapp/tools',
  '@acme/ui > @legendapp/motion > @legendapp/tools/react',
  'react-native-web',
  ...rnwCjsDeps,
];

/**
 * Packages the kit imports that must go through Vite during SSR rather than
 * Node: they import `react-native` (which only the alias turns into RNW), ship
 * `.tsx` entries, or use extensionless ESM imports Node rejects.
 */
const kitSsrNoExternal = [
  'react-native-web',
  '@expo/html-elements',
  '@expo/ui',
  'react-native-css',
  '@legendapp/motion',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-safe-area-context',
  'uniwind',
  // CJS that RNW's ESM imports as a default. Node's ESM loader hands back
  // `module.exports` rather than the Babel `exports.default`
  // ("createPrefixer is not a function"), so the SSR optimizer pre-bundles
  // them with the same interop the client gets (`rnwCjsDeps`).
  'inline-style-prefixer',
  'css-in-js-utils',
  'styleq',
  'postcss-value-parser',
  'memoize-one',
  'nullthrows',
  'fbjs',
  '@react-native/normalize-colors',
];

const payloadConfig = withPayload(
    ({ pluginOptions }) => ({
      plugins: [
        rsc(pluginOptions.rsc),
        tanstackStart({
          // rsc.enabled, the `.client.*` SSR exemption for @payloadcms/*, and
          // eager loading of the `/_payload` subtree so the panel is
          // interactive on first paint.
          ...pluginOptions.tanstackStart,
          // A prerendered /admin would be a stale, signed-out dashboard served
          // ahead of the server route.
          prerender: { enabled: false },
        }),
        // Widened to every .[jt]sx? file: Payload's admin ships JSX inside
        // node_modules, which plugin-react's default exclude would skip.
        viteReact(pluginOptions.react),
        // Vercel Functions + Build Output API v3 in .vercel/output, locally and in CI.
        nitro({ preset: 'vercel' }),
      ],
      resolve: {
        alias: [{ find: '@', replacement: src }, ...rnwAlias],
        dedupe: ['react-native-web'],
        // withPayload turns tsconfigPaths on. Its resolver walks up to the
        // repo-root tsconfig.json, which extends `expo/tsconfig.base`, and expo
        // is installed only under apps/mobile, so the build fails with
        // "Tsconfig not found expo/tsconfig.base". Nothing here needs tsconfig
        // paths: `@payload-config` is aliased by withPayload and `@` above.
        tsconfigPaths: false,
      },
      // The dependency optimizer runs Rolldown with tsconfig auto-discovery,
      // which hits the same root tsconfig.json and fails on `node:module` with
      // "Tsconfig not found". Point every environment's optimizer at this
      // app's own tsconfig instead.
      optimizeDeps: {
        include: kitOptimizeInclude,
        rolldownOptions: {
          tsconfig: appTsconfig,
          // The optimizer keeps its own extension list and ignores
          // `resolve.extensions`; without the web entries it bundles native
          // files over their `.web.*` siblings.
          resolve: { extensions: [...WEB_EXTENSIONS, '.tsx', '.ts', '.jsx', '.js', '.css', '.json'] },
        },
      },
      environments: {
        rsc: { optimizeDeps: { rolldownOptions: { tsconfig: appTsconfig } } },
        ssr: {
          // The SSR optimizer discovers nothing on its own, so what the client
          // optimizer pre-bundles by discovery is listed here. Reanimated mixes
          // ESM with a CJS `require('semver/...')` version check
          // (scripts/validate-worklets-version.js) that the RSC plugin's dev
          // CJS rewrite cannot evaluate ("__cjs_module_runner_transform");
          // a pre-bundle can.
          optimizeDeps: {
            include: [
              ...rnwCjsDeps,
              '@acme/ui > react-native-reanimated',
              // Reanimated imports this by its own package name, so the
              // pre-bundle above leaves it external; bundle it on its own.
              '@acme/ui > react-native-reanimated/scripts/validate-worklets-version',
            ],
            rolldownOptions: { tsconfig: appTsconfig },
          },
          resolve: { noExternal: kitSsrNoExternal },
        },
      },
      server: { port: DEV_PORT, strictPort: true },
      preview: { port: DEV_PORT, strictPort: true },
    }),
    {
      payloadConfigPath,
      // CJS that breaks under the RSC plugin's CJS-to-ESM rewrite in dev
      // ("reading '__cjs_module_runner_transform'"); Node requires it directly.
      // packages/payload/src/auth/options.ts imports waitUntil from it.
      devServerExternalPackages: ['@vercel/functions'],
      // Payload's adapter defaults to the demo's `src/app`.
      routesDirectory: 'routes',
    },
);

/**
 * `withPayload` deep-merges this file's config with `mergeConfig`, which
 * concatenates arrays, so `.web.*` could only be appended after its own
 * `resolve.extensions`. The extension order is set on the merged result.
 */
export default defineConfig((env: ConfigEnv): UserConfig => {
  const config = payloadConfig(env);
  config.resolve = { ...config.resolve, extensions: RESOLVE_EXTENSIONS };
  return config;
});
