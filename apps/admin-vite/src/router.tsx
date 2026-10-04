/**
 * TanStack Start's router entry: `src/router.tsx` exporting `getRouter`,
 * resolved by name. No `defaultPreload`: every route here is a per-request
 * server render behind a session, so preloading on hover would fire
 * authenticated Flight requests for views nobody opened.
 *
 * SOT: node_modules/@tanstack/start-client-core/dist/esm/startEntry.d.ts (RouterEntry)
 */
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
