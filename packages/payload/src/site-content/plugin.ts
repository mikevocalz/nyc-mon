import { websitePreviewEndpoints } from './preview';
import { staffRoles } from '../collections/access/roles';
import type { PayloadRequest, Plugin } from 'payload';
import { SitePages } from './schema';
import { nameWebsiteUpload, protectWebsiteMediaDelete, protectWebsiteMediaReplacement, websiteMediaUsage } from './media-usage';

/** Opt-in until the additive migration, content import and live QA gates have passed. */
export const siteContentPlugin: Plugin = (config) => ({
  ...config,
  endpoints: [...(config.endpoints ?? []), ...websitePreviewEndpoints],
  admin: { ...config.admin, components: { ...config.admin?.components, Nav: './site-content/Navigation#WebsiteNavigation' } },
  collections: [
    ...(config.collections ?? []).map((collection) => collection.slug !== 'media' ? collection : {
      ...collection,
      // Website objects are immutable. Swap relationships rather than racing a shared-byte overwrite/delete.
      access: {...collection.access, admin: ({req}: {req: PayloadRequest}) => ['ops', 'content'].includes(String(req.user?.role)), create: staffRoles(['ops', 'content']), update: staffRoles(['ops', 'content']), delete: () => false},
      admin: {
        ...collection.admin, group: 'Website', useAsTitle: 'filename',
        // The old list/edit overrides redirect to Overview, hiding the upload library.
        components: { ...collection.admin?.components, views: undefined },
      },
      fields: [...collection.fields, websiteMediaUsage],
      hooks: {
        ...collection.hooks,
        beforeOperation: [...(collection.hooks?.beforeOperation ?? []), nameWebsiteUpload],
        beforeChange: [...(collection.hooks?.beforeChange ?? []), protectWebsiteMediaReplacement],
        beforeDelete: [...(collection.hooks?.beforeDelete ?? []), protectWebsiteMediaDelete],
      },
    }),
    SitePages,
  ],
});
