import { createFileRoute } from '@tanstack/react-router';
import { handleCompanionMemory } from '@acme/payload/admin/console/v1-memory';

export const Route = createFileRoute('/v1/me/companion-memory')({
  server: { handlers: {
    GET: ({ request }: { request: Request }) => handleCompanionMemory(request),
    PUT: ({ request }: { request: Request }) => handleCompanionMemory(request),
    DELETE: ({ request }: { request: Request }) => handleCompanionMemory(request),
  } },
});
