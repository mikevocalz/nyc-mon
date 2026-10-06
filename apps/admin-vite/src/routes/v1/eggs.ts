import { handleCreateEgg } from '@acme/payload/admin/console/v1-game';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `POST /v1/eggs` records an egg draw for the signed-in caller (ADR 0001 §1.4).
 */
export const Route = createFileRoute('/v1/eggs')({
  server: {
    handlers: {
      POST: ({ request }) => handleCreateEgg(request),
    },
  },
});
