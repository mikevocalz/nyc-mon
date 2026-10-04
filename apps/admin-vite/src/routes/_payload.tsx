/**
 * The Payload admin's layout route. `_payload` is pathless, so its children
 * own `/admin` and `/payload-api` directly. The id is what the adapter keys
 * its `splitBehavior` on (`adminRouteId`, default `'/_payload'`), so this
 * subtree is eager-loaded rather than code-split.
 *
 * `headers()` covers every admin document. It does not reach the API route
 * beside it: a `server.handlers` response never passes through a route's
 * `headers()`, so `payload-api.$.ts` sets the same headers itself.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/routes/layoutRoute.d.ts (payloadLayoutRoute)
 */
import { payloadLayoutRoute } from '@payloadcms/tanstack-start/client';
import { createFileRoute } from '@tanstack/react-router';

// Payload's own panel stylesheet, then the ops console's. The console sheet
// is scoped to `.nycmon-console` and layered after `payload-default`
// (console-scope.postcss.mjs), so on a stock Payload screen it matches nothing.
import '@payloadcms/ui/css/app.css';
import '../console.css';

import { getLayoutDataFn, serverFunctionHandler } from './_payload/server.functions';

export const Route = createFileRoute('/_payload')({
  ...payloadLayoutRoute({
    load: getLayoutDataFn,
    serverFunction: serverFunctionHandler,
  }),
  headers: () => ({
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
  }),
});
