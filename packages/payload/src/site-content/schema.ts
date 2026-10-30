import type { Block, CollectionConfig, Field } from 'payload';
import { hasStaffRole, staffRoles } from '../collections/access/roles';
import { iframeEmbed, safeLink, safeRoute, sectionKeysAreUnique, youtubeEmbed } from '@acme/content/site-content';

const canEdit = staffRoles(['ops', 'content']);
const image = (): Field => ({
  name: 'image', type: 'upload', relationTo: 'media', required: true,
  filterOptions: { mimeType: { in: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'] } },
  admin: { description: 'Drop an image into the upload control, upload a new file, or choose from the media library. To change one placement, select a new media item rather than replacing a shared file.' },
});
const caption = (): Field => ({ name: 'caption', type: 'text', maxLength: 500 });
const alternative = (): Field => ({
  name: 'alt', label: 'Alternative text for this placement', type: 'text', maxLength: 500,
  admin: { description: 'Leave blank to use the media library alternative text.' },
});
const title = (): Field => ({ name: 'title', type: 'text', required: true, maxLength: 160 });

const blocks: Block[] = [
  {
    slug: 'text', labels: { singular: 'Section text', plural: 'Text blocks' },
    fields: [
      { name: 'heading', type: 'text', maxLength: 200 },
      { name: 'body', type: 'textarea', required: true, maxLength: 20000 },
      { name: 'linkLabel', type: 'text', maxLength: 120 },
      { name: 'link', type: 'text', validate: (value: unknown) => !value || Boolean(safeLink(value)) || 'Use a local path, an anchor, or an HTTPS URL.' },
    ],
  },
  {
    slug: 'image', labels: { singular: 'Image', plural: 'Images' },
    fields: [
      { name: 'slot', label: 'Image position', type: 'text', defaultValue: 'inline', required: true, maxLength: 100,
        validate: (value: unknown) => (typeof value === 'string' && /^[a-z][a-z0-9.-]{0,99}$/.test(value)) || 'Use the existing image-position key or inline.',
        admin: { description: 'inline adds an image below the section. Existing homepage positions include hero, world.primary, world.secondary, hlynk.static, hlynk.scanner, hlynk.controls, starter.1, starter.2, starter.3, and hatch.' } },
      image(), alternative(), { name: 'decorative', type: 'checkbox', defaultValue: false }, caption(),
      { name: 'focalX', label: 'Horizontal focal point (0 = left, 1 = right)', type: 'number', min: 0, max: 1, defaultValue: 0.5 },
      { name: 'focalY', label: 'Vertical focal point (0 = top, 1 = bottom)', type: 'number', min: 0, max: 1, defaultValue: 0.5 },
    ],
  },
  {
    slug: 'gallery', labels: { singular: 'Image gallery', plural: 'Image galleries' },
    fields: [{ name: 'images', type: 'array', minRows: 1, maxRows: 24, required: true, fields: [image(), alternative(), caption()] }],
  },
  {
    slug: 'youtube', labels: { singular: 'YouTube video', plural: 'YouTube videos' },
    fields: [title(), { name: 'url', label: 'YouTube URL', type: 'text', required: true,
      validate: (value: unknown) => Boolean(youtubeEmbed(value)) || 'Paste a valid HTTPS YouTube watch, short, share, or embed URL.' }, caption()],
  },
  {
    slug: 'iframe', labels: { singular: 'UI / iframe embed', plural: 'UI / iframe embeds' },
    fields: [title(), { name: 'url', label: 'Approved UI embed URL', type: 'text', required: true,
      validate: (value: unknown) => Boolean(iframeEmbed(value, (process.env.SITE_EMBED_ORIGINS ?? '').split(','))) || 'Use an HTTPS URL from SITE_EMBED_ORIGINS. Admin and authentication routes cannot be embedded.',
      admin: { description: 'Paste the URL only, not iframe HTML. Embed hosts are approved on the server. The target must allow this website to frame it.' } },
      { name: 'aspect', label: 'Frame aspect ratio', type: 'select', defaultValue: '16:9', options: ['16:9', '4:3', '1:1', '9:16'] }, caption()],
  },
];

/** Existing site + existing Payload admin. Never creates a parallel CMS. */
export const SitePages: CollectionConfig = {
  slug: 'site-pages',
  labels: { singular: 'Website page', plural: 'Website pages' },
  admin: {
    group: 'Website', useAsTitle: 'title',
    components: {edit: {PreviewButton: './site-content/PreviewButton#WebsitePreviewButton'}},
    preview: doc => process.env.SITE_PREVIEW_SECRET && doc.id ? `/payload-api/site-preview/start?id=${encodeURIComponent(String(doc.id))}` : null,
    defaultColumns: ['title', 'route', '_status', 'updatedAt'],
    description: 'Choose the page, then its named section. Copy, image positions and embeds stay attached to that section. Save a draft before publishing.',
  },
  access: {
    admin: ({req}) => hasStaffRole(req, ['ops', 'content']),
    read: ({ req }) => hasStaffRole(req, ['ops', 'content']) ? true : { _status: { equals: 'published' } },
    create: canEdit, update: canEdit, delete: staffRoles(['ops']), readVersions: canEdit,
  },
  versions: { drafts: true, maxPerDoc: 30 },
  fields: [
    { name: 'title', label: 'Page name', type: 'text', required: true, maxLength: 160 },
    { name: 'route', label: 'Website path', type: 'text', required: true, unique: true, index: true,
      validate: (value: unknown) => Boolean(safeRoute(value)) || 'Use / for Home or a lowercase path such as /how-it-works.',
      hooks: { beforeValidate: [({ value }) => safeRoute(value) ?? value] },
      admin: { description: 'Examples: /, /story, /city, /mons, /how-it-works, /get. Creating a record alone does not register a new website route.' } },
    { name: 'seo', label: 'Search / sharing copy', type: 'group', fields: [
      { name: 'title', type: 'text', maxLength: 200 }, { name: 'description', type: 'textarea', maxLength: 500 },
    ] },
    { name: 'sections', type: 'array', required: true, minRows: 1, maxRows: 40,
      admin: { initCollapsed: true, components: { RowLabel: './site-content/RowLabels#SectionRowLabel' } },
      validate: (value: unknown) => sectionKeysAreUnique(value) || 'Each section needs a unique lowercase key, for example hero or world.',
      fields: [
        { name: 'label', label: 'Section name', type: 'text', required: true, maxLength: 160 },
        { name: 'sectionKey', label: 'Section identifier', type: 'text', required: true, maxLength: 64,
          admin: { description: 'Keep this stable when editing an existing section. Homepage identifiers: hero, signage, world, district-divider, hlynk, starters, grid, care, hatch, waitlist.' } },
        { name: 'hidden', label: 'Hide this section', type: 'checkbox', defaultValue: false },
        { name: 'copy', label: 'Existing section copy', type: 'array', maxRows: 100,
          admin: { isSortable: false, components: { RowLabel: './site-content/RowLabels#CopyRowLabel' } }, fields: [
          { name: 'label', label: 'Field name', type: 'text', required: true, maxLength: 160 },
          { name: 'key', label: 'Field identifier', type: 'text', required: true, maxLength: 100,
            validate: (value: unknown) => (typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9.-]{0,99}$/.test(value)) || 'Use a field key such as title, body, or proof.0.title.' },
          { name: 'value', label: 'Copy', type: 'textarea', maxLength: 20000 },
        ] },
        { name: 'content', label: 'Images, videos and extra content', type: 'blocks', maxRows: 40, blocks,
          admin: { description: 'Reorder these blocks with their drag handles. Image positions replace an existing slot; inline images, galleries, text, YouTube and UI embeds appear after the section.' } },
      ],
    },
  ],
};
