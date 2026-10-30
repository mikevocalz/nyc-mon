import type { Plugin } from 'payload';
import { SitePages } from './schema';
import { protectWebsiteMediaDelete, protectWebsiteMediaReplacement, websiteMediaUsage } from './media-usage';

/** Opt-in until the additive migration, content import and live QA gates have passed. */
export const siteContentPlugin: Plugin = (config) => ({
  ...config,
  admin: { ...config.admin, components: { ...config.admin?.components, Nav: './site-content/Navigation#WebsiteNavigation' } },
  collections: [
    ...(config.collections ?? []).map((collection) => collection.slug !== 'media' ? collection : {
      ...collection,
      admin: {
        ...collection.admin, group: 'Website', useAsTitle: 'filename',
        // The old list/edit overrides redirect to Overview, hiding the upload library.
        components: { ...collection.admin?.components, views: undefined },
      },
      fields: [...collection.fields, websiteMediaUsage],
      hooks: {
        ...collection.hooks,
        beforeChange: [...(collection.hooks?.beforeChange ?? []), protectWebsiteMediaReplacement],
        beforeDelete: [...(collection.hooks?.beforeDelete ?? []), protectWebsiteMediaDelete],
      },
    }),
    SitePages,
  ],
});
