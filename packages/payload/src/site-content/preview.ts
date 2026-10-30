import type { Endpoint, PayloadRequest } from 'payload';
import { signPreview, verifyPreview, previewOrigin } from '@acme/content/site-preview';
import { hasStaffRole } from '../collections/access/roles';
const privateHeaders = {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow'};
const error = (status: number) => Response.json({error: 'Preview is unavailable or access has expired.'}, {status, headers: privateHeaders});
const origin = () => previewOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? '');
async function start(req: PayloadRequest) {
  const secret = process.env.SITE_PREVIEW_SECRET ?? '';
  if (secret.length < 32) return error(503);
  const headers = new Headers(req.headers); headers.set('DisableAutologin', 'true');
  req.user = (await req.payload.auth({headers, req})).user;
  if (!hasStaffRole(req, ['ops', 'content'])) return error(403);
  const id = new URL(req.url ?? 'http://localhost').searchParams.get('id');
  if (!id || !/^\d+$/.test(id)) return error(400);
  try {
    const page = await req.payload.findByID({collection: 'site-pages', id: Number(id), draft: true, depth: 0, req, user: req.user, overrideAccess: false});
    const token = signPreview({id: String(page.id), actor: String(req.user!.id), route: page.route, audience: origin()}, secret);
    const url = new URL('/api/site-content/preview', origin()); url.searchParams.set('token', token);
    return new Response(null, {status: 303, headers: {...privateHeaders, Location: url.href}});
  } catch { return error(404); }
}
async function content(req: PayloadRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  let grant; try { grant = verifyPreview(token, process.env.SITE_PREVIEW_SECRET ?? '', origin()); } catch { return error(503); }
  if (!grant || !/^\d+$/.test(grant.actor) || !/^\d+$/.test(grant.id)) return error(403);
  try {
    // A grant remains page-scoped, short-lived, and is revoked immediately by removing the issuer's editor role.
    const actor = await req.payload.findByID({collection: 'users', id: Number(grant.actor), depth: 0, overrideAccess: true, req});
    if (!hasStaffRole({user: actor}, ['ops', 'content'])) return error(403);
    req.user = actor;
    const page = await req.payload.findByID({collection: 'site-pages', id: Number(grant.id), draft: true, depth: 1, user: actor, overrideAccess: false, req});
    if (page.route !== grant.route) return error(403);
    return Response.json(page, {headers: privateHeaders});
  } catch { return error(404); }
}
export const websitePreviewEndpoints: Endpoint[] = [
  {path: '/site-preview/start', method: 'get', handler: start},
  {path: '/site-preview/content', method: 'get', handler: content},
];
