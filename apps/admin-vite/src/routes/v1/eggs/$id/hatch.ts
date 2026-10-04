import { handleHatchEgg } from '@acme/payload/admin/console/v1-game';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `POST /v1/eggs/:id/hatch` hatches an egg into a Mon for the signed-in caller
 * (ADR 0001 §1.4). The egg id is taken from the URL.
 */
export const Route = createFileRoute('/v1/eggs/$id/hatch')({
  server: {
    handlers: {
      POST: ({ request, params }: { request: Request; params: { id: string } }) =>
        handleHatchEgg(request, params.id),
    },
  },
});
