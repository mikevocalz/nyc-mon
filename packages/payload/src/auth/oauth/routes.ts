// Request handlers admin-vite mounts for Alexa+ account linking (ADR 0016).
// The OAuth endpoints themselves live under Better Auth at
// `/payload-api/auth/oauth2/*`; these are the pages it redirects to and the
// root metadata document, plus the data the linking pages render.
import { getPayload } from 'payload';
import { oauthConfig } from '../options';
import { createAuthServerMetadataHandler, type LinkPageData, type LinkPageKind, loadLinkPage } from './pages';

export { LINK_PAGE_HEADERS, type LinkPageData, type LinkPageKind } from './pages';

type MetadataHandler = ReturnType<typeof createAuthServerMetadataHandler>;
let metadataHandler: MetadataHandler | undefined;

async function liveMetadataHandler(): Promise<MetadataHandler> {
  if (metadataHandler !== undefined) return metadataHandler;
  const { default: config } = await import('../../payload.config.ts');
  const payload = await getPayload({ config });
  const auth = (payload as unknown as { betterAuth?: Parameters<typeof createAuthServerMetadataHandler>[0] }).betterAuth;
  if (auth === undefined) throw new Error('Better Auth is not attached to Payload.');
  metadataHandler = createAuthServerMetadataHandler(auth);
  return metadataHandler;
}

/** `GET /.well-known/oauth-authorization-server`. */
export async function handleAuthServerMetadata(request: Request): Promise<Response> {
  return (await liveMetadataHandler())(request);
}

/** Data for `/oauth/sign-in`, `/oauth/consent` and `/oauth/refused`, from the raw query string. */
export function loadOAuthLinkPage(kind: LinkPageKind, search: string): Promise<LinkPageData> {
  return loadLinkPage(kind, search, { config: oauthConfig });
}
