import { handleCreateGuardianConsent } from '@acme/payload/admin/console/guardian-consent';
import { createFileRoute } from '@tanstack/react-router';

/**
 * `POST /v1/guardian-consents` is called by the mobile app before an account
 * exists: an under-13 child submits a parent email and birth year, and the
 * server creates a pending guardian-consent request (ADR 0001 § Age and
 * consent).
 */
export const Route = createFileRoute('/v1/guardian-consents')({
  server: {
    handlers: {
      POST: ({ request }) => handleCreateGuardianConsent(request),
    },
  },
});
