import { handleAdoptMon } from '@acme/payload/admin/console/v1-adopt';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `POST /v1/mons/adopt` claims a Mon that hatched on the signed-in Caller's
 * device but is missing on the server, so its queued care writes have a Mon
 * to land on (packages/payload/src/admin/console/v1/adopt.ts).
 */
export const Route = createFileRoute('/v1/mons/adopt')({
  server: {
    handlers: {
      POST: ({ request }) => handleAdoptMon(request),
    },
  },
});
