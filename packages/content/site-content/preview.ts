import { createHmac, timingSafeEqual } from 'node:crypto';
import { record, safeRoute } from './core.ts';

export interface PreviewClaim { v: 1; id: string; route: string; editor: string; audience: string; issued: number; expires: number }
const lifetime = 15 * 60;
export function previewOrigin(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Invalid website preview origin');
  return url.origin;
}
function key(secret: string) { if (secret.length < 32) throw new Error('SITE_PREVIEW_SECRET must contain at least 32 characters'); return secret; }
export function signPreview(input: Pick<PreviewClaim, 'id' | 'route' | 'editor' | 'audience'>, secret: string, now = Date.now()): string {
  if (!safeRoute(input.route) || !input.id || !input.editor) throw new Error('Invalid preview scope');
  const issued = Math.floor(now / 1000);
  const claim: PreviewClaim = { ...input, audience: previewOrigin(input.audience), v: 1, issued, expires: issued + lifetime };
  const body = Buffer.from(JSON.stringify(claim)).toString('base64url');
  return `${body}.${createHmac('sha256', key(secret)).update(body).digest('base64url')}`;
}
export function verifyPreview(token: string, secret: string, audience: string, now = Date.now()): PreviewClaim | null {
  try {
    if (token.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const [body, signature] = token.split('.') as [string, string];
    const expected = createHmac('sha256', key(secret)).update(body).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const claim: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const time = Math.floor(now / 1000);
    if (!record(claim) || claim.v !== 1 || typeof claim.id !== 'string' || !claim.id || typeof claim.editor !== 'string' || !claim.editor || typeof claim.route !== 'string' || safeRoute(claim.route) !== claim.route || claim.audience !== previewOrigin(audience) || typeof claim.issued !== 'number' || typeof claim.expires !== 'number' || !Number.isInteger(claim.issued) || !Number.isInteger(claim.expires) || claim.issued > time + 30 || claim.expires <= time || claim.expires - claim.issued !== lifetime) return null;
    return claim as unknown as PreviewClaim;
  } catch { return null; }
}
