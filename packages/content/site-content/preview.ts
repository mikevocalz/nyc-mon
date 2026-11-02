import { createHmac, timingSafeEqual } from 'node:crypto';
import { record, safeRoute } from './core.ts';
export const PREVIEW_COOKIE = 'nycmon-site-preview';
export const PREVIEW_SECONDS = 600;
export interface PreviewGrant { version: 1; purpose: 'nycmon-site-preview'; id: string; actor: string; route: string; audience: string; issued: number; expires: number }
export function previewOrigin(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Preview origin must use HTTPS');
  return url.origin;
}
export function signPreview(input: Pick<PreviewGrant, 'id' | 'actor' | 'route' | 'audience'>, secret: string, now = Date.now()): string {
  if (secret.length < 32 || !safeRoute(input.route) || !input.id || !input.actor) throw new Error('Preview is not configured');
  const issued = Math.floor(now / 1000);
  const grant: PreviewGrant = {...input, audience: previewOrigin(input.audience), version: 1, purpose: 'nycmon-site-preview', issued, expires: issued + PREVIEW_SECONDS};
  const body = Buffer.from(JSON.stringify(grant)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function verifyPreview(token: string, secret: string, audience: string, now = Date.now()): PreviewGrant | null {
  if (secret.length < 32 || token.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
  try {
    const [body, signature] = token.split('.') as [string, string];
    const expected = createHmac('sha256', secret).update(body).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const grant: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const time = Math.floor(now / 1000);
    if (!record(grant) || grant.version !== 1 || grant.purpose !== 'nycmon-site-preview' ||
      typeof grant.id !== 'string' || !grant.id || typeof grant.actor !== 'string' || !grant.actor ||
      !safeRoute(grant.route) || grant.audience !== previewOrigin(audience) ||
      typeof grant.issued !== 'number' || typeof grant.expires !== 'number' ||
      !Number.isInteger(grant.issued) || !Number.isInteger(grant.expires) || grant.issued > time + 5 ||
      grant.expires <= time || grant.expires - grant.issued !== PREVIEW_SECONDS) return null;
    return grant as unknown as PreviewGrant;
  } catch { return null; }
}
export const previewTarget = (grant: PreviewGrant) => grant.route === '/website-shell' ? '/' : grant.route;
