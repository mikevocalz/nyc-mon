import { handleMonModelGlb } from '@acme/payload/admin/console/mon-models';
import { createFileRoute } from '@tanstack/react-router';

/** `GET /v1/mon-models/glb/:species` 302s to the approved model's CDN object. */
export const Route = createFileRoute('/v1/mon-models/glb/$species')({
  server: {
    handlers: {
      GET: ({ request, params }: { request: Request; params: { species: string } }) =>
        handleMonModelGlb(request, params.species),
      OPTIONS: ({ request, params }: { request: Request; params: { species: string } }) =>
        handleMonModelGlb(request, params.species),
    },
  },
});
