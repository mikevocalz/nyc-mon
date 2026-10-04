/**
 * `/admin`: the dashboard, or the login view without a session. Separate from
 * the splat route because an index miss has no server-built NotFound page and
 * falls back to the client view.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/routes/adminRoutes.d.ts (payloadAdminIndexRoute)
 */
import { payloadAdminIndexRoute } from '@payloadcms/tanstack-start/client';
import { createFileRoute } from '@tanstack/react-router';

import { loadAdminPageRSC } from './server.functions';

export const Route = createFileRoute('/_payload/admin/')(
  payloadAdminIndexRoute({ load: loadAdminPageRSC }),
);
