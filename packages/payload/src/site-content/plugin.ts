import { sitePreviewEndpoint } from './preview';
import { staffRoles, nobody } from '../collections/access/roles';
import type { Plugin, CollectionConfig } from 'payload';
import { SitePages } from './schema';
import { protectWebsiteMediaDelete, protectWebsiteMediaReplacement, websiteMediaUsage } from './media-usage';

/** Opt-in until the additive migration, content import and live QA gates have passed. */
export const siteContentPlugin: Plugin = (config) => ({
  ...config,
  endpoints: [...(config.endpoints ?? []), sitePreviewEndpoint],
  admin: { ...config.admin, components: { ...config.admin?.components, Nav: './site-content/Navigation#WebsiteNavigation' } },
  collections: [
    ...(config.collections ?? []).map((collection): CollectionConfig => collection.slug !== 'media' ? collection : {
      ...collection,
      access: { ...collection.access, create: staffRoles(['ops', 'content']), update: staffRoles(['ops', 'content']), delete: nobody },
      admin: {
        ...collection.admin, group: 'Website', useAsTitle: 'filename',
        // The old list/edit overrides redirect to Overview, hiding the upload library.
        components: { ...collection.admin?.components, views: undefined },
      },
      fields: [...collection.fields, { name: 'siteSourceHash', type: 'text', index: true, access: { create: () => false, update: () => false, read: () => false }, admin: { hidden: true, readOnly: true } }, websiteMediaUsage],
      hooks: {
        ...collection.hooks,
        beforeChange: [...(collection.hooks?.beforeChange ?? []), protectWebsiteMediaReplacement],
        beforeDelete: [...(collection.hooks?.beforeDelete ?? []), protectWebsiteMediaDelete],
      },
    }),
    SitePages,
  ],
});
