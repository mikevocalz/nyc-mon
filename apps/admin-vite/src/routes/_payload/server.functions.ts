/**
 * The three server functions the admin runs on: render an admin page to a
 * Flight payload, resolve the panel's layout data, and dispatch every
 * `ServerFunctionClient` call the panel makes (form state, document locks).
 *
 * `.functions.` in the filename keeps TanStack's route generator from reading
 * this file as a route (the adapter's `routeFileIgnorePattern`). The config
 * and import map load through `import()` inside each handler because route
 * modules that import this file ship to the browser; the Start compiler
 * prunes handler bodies from the client build.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/exports/server.d.ts (loadAdminPage, handleServerFunctions)
 *      node_modules/@payloadcms/tanstack-start/dist/exports/layouts.d.ts (loadLayoutData)
 */
import type { ServerFunctionClientArgs } from 'payload';

import { createServerFunctionClient } from '@payloadcms/tanstack-start/client';
import { createServerFn } from '@tanstack/react-start';

type LoadInput = {
  _splat?: string;
  search?: Record<string, string | string[]>;
};

/*
  One injection point for the shared config and the generated map, shared by all
  three functions below. `@payload-config` is aliased by `withPayload` to
  packages/payload/src/payload.config.ts, the single config this app consumes
  and never extends.
*/
const getConfig = async () => (await import('@payload-config')).default;
const getImportMap = async () => (await import('./importMap.js')).importMap;

export const loadAdminPageRSC = createServerFn({ method: 'GET' })
  .validator((data: LoadInput): LoadInput => data ?? {})
  .handler(async ({ data }) => {
    const { loadAdminPage } = await import('@payloadcms/tanstack-start/server');
    return loadAdminPage({
      config: await getConfig(),
      importMap: await getImportMap(),
      search: data.search,
      splat: data._splat,
    });
  });

export const getLayoutDataFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { loadLayoutData } = await import('@payloadcms/tanstack-start/layouts');
  return loadLayoutData({ config: await getConfig(), importMap: await getImportMap() });
});

const runPayloadServerFn = createServerFn({ method: 'POST' })
  .validator((args: ServerFunctionClientArgs): ServerFunctionClientArgs => args)
  .handler(async ({ data }) => {
    const { handleServerFunctions } = await import('@payloadcms/tanstack-start/server');
    /*
      The adapter (4.0.0-beta.6) renders the dispatcher's result to a React
      Flight stream and returns it as a `text/x-component` Response;
      `createServerFunctionClient` below decodes that stream on the client.
      TanStack Start passes a returned Response through untouched.
    */
    return handleServerFunctions({
      args: data.args,
      config: await getConfig(),
      importMap: await getImportMap(),
      name: data.name,
    });
  });

/*
  Sanitises args for TanStack Start's seroval wire format before dispatch.
  Payload's own callers (`getFormState`) can hand over live form state carrying
  stray functions, which seroval throws on rather than dropping.
*/
export const serverFunctionHandler = createServerFunctionClient({
  runServerFn: runPayloadServerFn,
});
