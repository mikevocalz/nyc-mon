import { LINK_PAGE_HEADERS, LinkPage } from '@acme/payload/auth/oauth/ui';
import { createFileRoute } from '@tanstack/react-router';
import { loadLinkPageFn } from '../../oauth-link.functions';
import '../../console.css';

/**
 * `/oauth/sign-in`: a step of Alexa+ account linking (ADR 0016), drawn with the
 * kit. The server function checks the signed `oauth_query` before anything
 * renders; on a client-side visit the browser's raw query is sent instead.
 */
export const Route = createFileRoute('/oauth/sign-in')({
  loader: () =>
    loadLinkPageFn({ data: { kind: 'sign-in', search: typeof window === 'undefined' ? undefined : window.location.search } }),
  headers: () => ({ ...LINK_PAGE_HEADERS }),
  component: function OAuthLinkRoute() {
    return <LinkPage data={Route.useLoaderData()} />;
  },
});
