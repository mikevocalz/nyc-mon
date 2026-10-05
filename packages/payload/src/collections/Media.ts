import type { CollectionConfig } from 'payload';

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    components: {
      views: {
        // No console counterpart for uploads; stock views go to the overview.
        list: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/overview' } } },
        edit: { root: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/overview' } } } },
      },
    },
  },
  access: { read: () => true },
  upload: true,
  fields: [
    { name: 'alt', type: 'text', required: true },
  ],
};
