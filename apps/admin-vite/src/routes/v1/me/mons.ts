import { handleListMyMons } from '@acme/payload/admin/console/v1-game';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `GET /v1/me/mons` returns the signed-in caller's Mons and their latest care
 * states. This is the server restore path used during boot (ADR 0001 §1.4).
 */
export const Route = createFileRoute('/v1/me/mons')({
  server: {
    handlers: {
      GET: ({ request }) => handleListMyMons(request),
    },
  },
});
