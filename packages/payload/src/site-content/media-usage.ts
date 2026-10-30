import { APIError, type CollectionBeforeChangeHook, type CollectionBeforeDeleteHook, type Field, type PayloadRequest } from 'payload';
import { hasStaffRole } from '../collections/access/roles';
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

export const protectWebsiteMediaReplacement: CollectionBeforeChangeHook = async ({ req, operation, originalDoc, data }) => {
  if (operation !== 'update' || !originalDoc?.id) return data;
  if (!req.file && hasStaffRole(req, ['ops', 'content'])) return data;
  if ((await usedOn(req, originalDoc.id)).length) {
    if (!hasStaffRole(req, ['ops', 'content'])) throw new APIError('Only website editors can change media used by a website page.', 403);
    if (req.file) throw new APIError('This image is used by a website page or revision. Upload a new image and select it in the section; replacing the shared file would also change published pages.', 409);
  }
  return data;
};
export const protectWebsiteMediaDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  if ((await usedOn(req, id)).length) throw new APIError('This image is used by a website page, draft, or revision. Remove those references before deleting it.', 409);
};
