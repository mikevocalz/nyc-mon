/**
 * Server function behind the Alexa+ linking pages (ADR 0016). It reads the raw
 * query string of the document request, because the signature on
 * `oauth_query` covers the exact parameters and the router's parsed search
 * may re-serialize them. Verification runs in @acme/payload (auth/oauth/pages.ts);
 * the handler body never reaches the browser bundle.
 */
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import type { LinkPageData, LinkPageKind } from '@acme/payload/auth/oauth';

/** Runtime check on what reaches the server: an unknown `kind` is refused, never rendered. */
const LinkPageInput = z.object({
  kind: z.enum(['sign-in', 'consent', 'refused'] satisfies readonly LinkPageKind[]),
  search: z.string().max(8192).optional(),
});

export const loadLinkPageFn = createServerFn({ method: 'GET' })
  .validator((data: unknown) => LinkPageInput.parse(data))
  .handler(async ({ data }): Promise<LinkPageData> => {
    const { getRequest } = await import('@tanstack/react-start/server');
    const { loadOAuthLinkPage } = await import('@acme/payload/auth/oauth');
    const search = data.search ?? new URL(getRequest().url).search;
    return loadOAuthLinkPage(data.kind, search);
  });
