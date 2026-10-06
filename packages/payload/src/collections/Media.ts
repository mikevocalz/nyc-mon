import type { CollectionConfig } from 'payload';
import { bunnyMediaAfterChange, bunnyMediaAfterDelete } from '../storage/bunnyMedia';

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
  upload: {
    disableLocalStorage: true,
    adminThumbnail: ({ doc }) =>
      typeof doc.bunnyUrl === 'string' ? doc.bunnyUrl : '',
    bulkUpload: true,
    displayPreview: true,
  },
  hooks: {
    afterChange: [bunnyMediaAfterChange],
    afterDelete: [bunnyMediaAfterDelete],
  },
  fields: [
    {
      name: 'bunnyUrl',
      type: 'text',
      admin: { readOnly: true, hidden: true },
    },
    { name: 'alt', type: 'text', required: true },
  ],
};
