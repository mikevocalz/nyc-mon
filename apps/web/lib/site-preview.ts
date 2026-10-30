import 'server-only';
import { verifyPreview } from '@acme/content/site-preview';
import { parseSitePage, record } from '@acme/content/site-content';
/** Authorization is checked here AND by Payload. Nothing in the public reader accepts this token. */
export async function readPreview(token: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? '', secret = process.env.SITE_PREVIEW_SECRET ?? '';
  const claim = verifyPreview(token, secret, origin);
  const base = process.env.PAYLOAD_SITE_API_URL;
  if (!claim || !base) return null;
  const endpoint = new URL(`${base.replace(/\/$/, '')}/site-preview`);
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname))) return null;
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(5000) });
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new Error('The draft preview is temporarily unavailable');
  const value: unknown = await response.json();
  if (!record(value) || String(value.id) !== claim.id || value.route !== claim.route) return null;
  // Only this already-authorized scoped draft crosses the shape parser. Public parseSitePage remains published-only.
  const page = parseSitePage({ ...value, _status: 'published' });
  return page ? { page, claim, adminOrigin: endpoint.origin } : null;
}
