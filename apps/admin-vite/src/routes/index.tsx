/**
 * `/` redirects to `/admin`. `routes.admin` is a property of the shared
 * Payload config, so the panel stays one segment down instead of forking that
 * config for this host. `beforeLoad` throws during the server render, so the
 * response is a real 307, not a blank document and a client-side hop.
 *
 * SOT: node_modules/@tanstack/react-router/dist/esm/redirect.d.ts (redirect)
 */
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin' });
  },
  headers: () => ({
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
  }),
});
