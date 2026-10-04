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
 * No react-native-web, no Tailwind and no `@acme/ui` here: the panel is
 * Payload's own React and stylesheet.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/withPayload/index.d.ts (withPayload)
 *      node_modules/@tanstack/react-start/dist/esm/plugin/vite.d.ts (tanstackStart)
 *      https://github.com/payloadcms/payload/tree/main/packages/tanstack-start
 */
import { fileURLToPath } from 'node:url';
import { withPayload } from '@payloadcms/tanstack-start';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import rsc from '@vitejs/plugin-rsc';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

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

export default defineConfig(
  withPayload(
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
        alias: { '@': src },
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
      optimizeDeps: { rolldownOptions: { tsconfig: appTsconfig } },
      environments: {
        rsc: { optimizeDeps: { rolldownOptions: { tsconfig: appTsconfig } } },
        ssr: { optimizeDeps: { rolldownOptions: { tsconfig: appTsconfig } } },
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
  ),
);
