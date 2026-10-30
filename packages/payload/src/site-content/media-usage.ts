import { randomUUID } from 'node:crypto';
import { APIError, type CollectionBeforeOperationHook, type CollectionBeforeChangeHook, type CollectionBeforeDeleteHook, type Field, type PayloadRequest } from 'payload';
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

export const protectWebsiteMediaReplacement: CollectionBeforeChangeHook = ({ req, operation, data }) => {
  if (operation === 'update' && req.file) throw new APIError('Upload a new media item and select it in the section. Files stay immutable so published pages and revision restores remain safe.', 409);
  return data;
};
export const protectWebsiteMediaDelete: CollectionBeforeDeleteHook = () => {
  throw new APIError('Media files are retained for published pages and revisions. Use a new upload to replace a section image; permanent cleanup is a separate maintenance operation.', 409);
};

/** Generate collision-free object names before Payload computes upload metadata. */
export const nameWebsiteUpload: CollectionBeforeOperationHook = ({operation, req, args}) => {
  if (operation === 'create' && req.file) {
    const extension = /\.([a-z0-9]{1,10})$/i.exec(req.file.name)?.[1]?.toLowerCase();
    req.file.name = `website-${randomUUID()}${extension ? `.${extension}` : ''}`;
  }
  return args;
};
