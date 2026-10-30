import type { Endpoint, PayloadRequest } from 'payload';
import { record, safeRoute } from '@acme/content/site-content';
import { previewOrigin, signPreview, verifyPreview } from '@acme/content/site-preview';
import { hasStaffRole, readStaffRole } from '../collections/access/roles';

export function previewURL(doc: unknown, req: PayloadRequest): string | null {
  const secret = process.env.SITE_PREVIEW_SECRET, origin = process.env.SITE_PUBLIC_URL;
  if (!secret || !origin || !hasStaffRole(req, ['ops', 'content']) || !record(doc) || !safeRoute(doc.route) || (typeof doc.id !== 'string' && typeof doc.id !== 'number') || !req.user?.id) return null;
  const audience = previewOrigin(origin);
  const token = signPreview({ id: String(doc.id), route: String(doc.route), editor: String(req.user.id), audience }, secret);
  return `${audience}/cms-preview/${token}`;
}
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' };
/** A short-lived signed capability for one page. Recheck staff role on every request, including refresh. */
export const sitePreviewEndpoint: Endpoint = {
  path: '/site-preview', method: 'get', handler: async (req) => {
    const secret = process.env.SITE_PREVIEW_SECRET, audience = process.env.SITE_PUBLIC_URL;
    const token = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
    const claim = secret && audience ? verifyPreview(token, secret, audience) : null;
    if (!claim) return Response.json({ error: 'Preview unavailable or expired' }, { status: 403, headers });
    const editor = await req.payload.findByID({ collection: 'users', id: claim.editor, depth: 0, overrideAccess: true, req, disableErrors: true });
    if (!editor || !['ops', 'content'].includes(readStaffRole(editor) ?? '')) return Response.json({ error: 'Preview unavailable or expired' }, { status: 403, headers });
    const page = await req.payload.findByID({ collection: 'site-pages', id: claim.id, draft: true, depth: 1, user: { ...editor, collection: 'users' }, overrideAccess: false, req, disableErrors: true });
    if (!page || page.route !== claim.route) return Response.json({ error: 'Preview unavailable or expired' }, { status: 404, headers });
    return Response.json(page, { headers });
  },
};
