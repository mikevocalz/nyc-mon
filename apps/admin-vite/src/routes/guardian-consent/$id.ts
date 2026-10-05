import { handleGuardianConsentDecision } from '@acme/payload/admin/console/guardian-consent';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `GET /guardian-consent/:id?decision=approve|deny` is the link the parent
 * email sends (`guardianConsentMail` in packages/payload). The caller is
 * anonymous: the URL itself is the capability, so the handler answers with a
 * rendered page for every outcome rather than JSON (ADR 0001 § Age and
 * consent).
 */
export const Route = createFileRoute('/guardian-consent/$id')({
  server: {
    handlers: {
      GET: ({ request, params }: { request: Request; params: { id: string } }) =>
        handleGuardianConsentDecision(request, params.id),
    },
  },
});
