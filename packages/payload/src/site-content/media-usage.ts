import { hasStaffRole } from '../collections/access/roles';
import { APIError, type CollectionBeforeChangeHook, type CollectionBeforeDeleteHook, type Field, type PayloadRequest } from 'payload';
import { mediaPlacements, record } from '@acme/content/site-content';

type Snapshot = { page: unknown; state: 'published/current' | 'latest draft' | 'revision' };
const contextKey = 'nycMonWebsiteMediaSnapshots';

/** One paginated scan per request, shared by all media rows; no permanent derived tags to go stale. */
async function snapshots(req: PayloadRequest): Promise<Snapshot[]> {
  const existing = req.context[contextKey];
  if (existing instanceof Promise) return existing as Promise<Snapshot[]>;
  const work = (async () => {
    const collection = req.payload.config.collections.find((item) => String(item.slug) === 'site-pages');
    if (!collection) return [];
    const result: Snapshot[] = [];
    for (const draft of [false, true]) {
      let page = 1;
      for (;;) {
        // Internal reference integrity, not user-facing data access. Pass req for the same transaction.
        const batch = await req.payload.find({ collection: collection.slug, draft, page, limit: 100, depth: 0, overrideAccess: true, req });
        result.push(...batch.docs.map((doc) => ({ page: doc, state: draft ? 'latest draft' as const : 'published/current' as const })));
        if (!batch.hasNextPage) break;
        if (!batch.nextPage || batch.nextPage <= page) throw new Error('Could not finish website-media reference scan');
        page = batch.nextPage;
      }
    }
    // A saved revision must still be restorable after a page swaps its image.
    let page = 1;
    for (;;) {
      const batch = await req.payload.findVersions({ collection: collection.slug, page, limit: 100, depth: 0, overrideAccess: true, req });
      for (const doc of batch.docs) {
        if (!record(doc) || !record(doc.version)) continue;
        result.push({ page: { ...doc.version, id: (record(doc.parent) ? doc.parent.id : doc.parent) ?? doc.version.id }, state: 'revision' });
      }
      if (!batch.hasNextPage) break;
      if (!batch.nextPage || batch.nextPage <= page) throw new Error('Could not finish website-media revision scan');
      page = batch.nextPage;
    }
    return result;
  })();
  req.context[contextKey] = work;
  return work;
}

async function usedOn(req: PayloadRequest, id: string | number): Promise<string[]> {
  const pages = await snapshots(req);
  return [...new Set(pages.flatMap((item) => mediaPlacements(item.page, id).map((place) =>
    `${place.page || place.route} (${place.route}) → ${place.section || place.sectionKey} → ${place.field} [${item.state}]`)))];
}

export const websiteMediaUsage: Field = {
  name: 'websiteUsage', label: 'Used on website pages', type: 'textarea', virtual: true,
  access: { read: ({ req }) => hasStaffRole(req, ['ops', 'content']) },
  admin: { readOnly: true, description: 'Derived from real page, section and image references, including saved revisions.' },
  hooks: { afterRead: [async ({ req, siblingData }) => {
    if (!hasStaffRole(req, ['ops', 'content'])) return undefined;
    const id: unknown = siblingData.id;
    if (typeof id !== 'string' && typeof id !== 'number') return '';
    const placements = await usedOn(req, id);
    return placements.length ? placements.join('\n') : 'No website page references. Other game/app uses are not included in this report.';
  }] },
};

export const protectWebsiteMediaReplacement: CollectionBeforeChangeHook = ({ req, operation, data }) => {
  if (operation === 'update' && req.file) throw new APIError('Media files are version-safe and cannot be overwritten. Upload a new image and select it in the page section; saved revisions keep their original image.', 409);
  return data;
};
export const protectWebsiteMediaDelete: CollectionBeforeDeleteHook = () => {
  // Do not race a simultaneous draft/page save or erase bytes needed by a revision.
  // Storage garbage collection is a separate audited maintenance operation, not a CMS user action.
  throw new APIError('Media deletion is disabled to protect website drafts and revisions. Swap the image in its section instead.', 409);
};
