/**
 * Payload's REST catch-all on this origin, including Better Auth at
 * `/payload-api/auth/*`: the payload-better-auth plugin mounts Better Auth's
 * handler as Payload endpoints (ADR 0001), so it arrives through the same
 * `handleEndpoints` call as every collection route.
 *
 * `payloadApiHandlers` from the adapter is not used. It delegates to
 * `handleAPIRoute`, which strips and re-adds a hard-coded `/api` prefix, so
 * with `routes.api: '/payload-api'` Payload receives
 * `/api/payload-api/users/me` and answers "Route not found" (found in
 * MoyoLearn's port; same adapter line). `handleEndpoints` without a `path`
 * reads the request pathname and matches it against `config.routes.api`,
 * which keeps the prefix a property of the shared config.
 *
 * GraphQL is not served: the adapter has no GraphQL handler, and nothing in
 * NYC-MON calls it (docs/adr/0003-admin-app-split.md).
 *
 * `server.handlers` is a literal key on the options object because that is the
 * shape TanStack Start's client compiler strips; the dynamic imports keep the
 * Postgres pool and sharp out of the browser bundle if it ever did not.
 *
 * SOT: node_modules/payload/dist/utilities/handleEndpoints.d.ts (handleEndpoints)
 *      node_modules/@payloadcms/tanstack-start/dist/utilities/handleAPIRoute.server.js
 */
import { createFileRoute } from '@tanstack/react-router';

// The adapter declares this shape as a local, unexported type in
// dist/routes/apiRoute.d.ts.
type ApiRouteHandler = (ctx: { request: Request }) => Promise<Response>;

// A route's headers() never reaches a server handler's Response, and a 200 GET
// with no Cache-Control is heuristically cacheable: a cached `users/me` or
// `auth/get-session` is somebody else's session.
const PRIVATE_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
};

const handler: ApiRouteHandler = async ({ request }) => {
  const { handleEndpoints } = await import('payload');
  const response = await handleEndpoints({
    config: (await import('@payload-config')).default,
    request,
  });
  // Rebuilt, not mutated: a fetch-style Response can carry immutable headers.
  // Payload's own headers (Set-Cookie, Access-Control-*) are copied first.
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) headers.set(name, value);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

export const Route = createFileRoute('/_payload/payload-api/$')({
  server: {
    handlers: {
      DELETE: handler,
      GET: handler,
      OPTIONS: handler,
      PATCH: handler,
      POST: handler,
      PUT: handler,
    },
  },
});
