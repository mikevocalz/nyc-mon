import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload';
import { APIError } from 'payload';
import { allSpecies } from '@acme/content';
import { bunnyMediaAfterChange, bunnyMediaAfterDelete, bunnyMediaAfterRead } from '../storage/bunnyMedia';
import { hasStaffRole, STAFF_ROLES, staffRoles } from './access/roles.ts';
import { checkMonArtAlt, checkMonArtFile, MON_ART_FILE_MESSAGES, MON_ART_MIME_TYPES, readImageFacts } from './monArtFile.ts';
import { monArtAfterChange, monArtAfterDelete } from './monArtRevalidate.ts';

/**
 * One still picture per Mon form (a species at one lifecycle stage): the art
 * the website, the app's Dex and the Alexa view show where a Mon appears as a
 * picture. Uploaded on the console's Models page beside the form's 3D model.
 * An approved still wins over the bundled one in @acme/assets/creatures; a
 * form with neither shows Coming Soon.
 */

const speciesById = new Map(allSpecies.map((species) => [species.speciesId, species]));

export const inspectMonArt: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const species = typeof data.speciesId === 'string' ? speciesById.get(data.speciesId) : undefined;
  if (data.speciesId !== undefined && !species) throw new APIError('Pick a Mon form from the roster.', 400);
  if (species) {
    data.stage = species.stage;
    data.bloodlineId = species.bloodlineId;
  }
  if (!checkMonArtAlt(data.alt ?? originalDoc?.alt)) throw new APIError(MON_ART_FILE_MESSAGES.alt, 400);
  const file = req.file;
  if (file) {
    const check = checkMonArtFile(file);
    if (!check.ok) throw new APIError(MON_ART_FILE_MESSAGES[check.problem], 400);
    // The bytes decide the type and size, never the name or the browser's claim.
    const facts = readImageFacts(new Uint8Array(file.data.buffer, file.data.byteOffset, Math.min(file.data.byteLength, 64 * 1024)));
    if (!facts || facts.width <= 0 || facts.height <= 0) throw new APIError(MON_ART_FILE_MESSAGES.header, 400);
    data.width = facts.width;
    data.height = facts.height;
    data.mimeType = facts.mimeType;
    const extension = facts.mimeType === 'image/jpeg' ? 'jpg' : facts.mimeType.slice('image/'.length);
    // A fresh key per upload: Bunny's edge never serves an older picture from a reused URL.
    data.filename = `${data.speciesId ?? originalDoc?.speciesId ?? 'mon'}-${Date.now().toString(36)}.${extension}`;
    // A new picture has not been looked at yet.
    data.status = 'in-review';
  }
  return data;
};

export const MonArt: CollectionConfig = {
  slug: 'mon-art',
  labels: { singular: 'Mon still', plural: 'Mon stills' },
  admin: {
    useAsTitle: 'speciesId',
    defaultColumns: ['speciesId', 'stage', 'status', 'updatedAt'],
    components: {
      views: {
        // The console's Models page uploads and reviews stills beside the 3D models.
        list: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/models' } } },
        edit: { root: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/models' } } } },
      },
    },
  },
  access: {
    // The site and the apps read approved stills; every staff role sees all of them.
    read: ({ req }) => hasStaffRole(req, STAFF_ROLES) || { status: { equals: 'approved' } },
    create: staffRoles(['ops', 'content']),
    update: staffRoles(['ops', 'content']),
    delete: staffRoles(['ops', 'content']),
  },
  upload: {
    disableLocalStorage: true,
    mimeTypes: [...MON_ART_MIME_TYPES],
  },
  hooks: {
    beforeChange: [inspectMonArt],
    // Store on Bunny first, then tell the site, so it never refetches before the URL exists.
    afterChange: [bunnyMediaAfterChange, monArtAfterChange],
    afterRead: [bunnyMediaAfterRead],
    afterDelete: [bunnyMediaAfterDelete, monArtAfterDelete],
  },
  fields: [
    {
      name: 'speciesId',
      label: 'Mon form',
      type: 'select',
      required: true,
      unique: true,
      index: true,
      options: allSpecies.map((species) => ({
        value: species.speciesId,
        label: `${species.dexId === null ? species.speciesId : `#${String(species.dexId).padStart(3, '0')}`} ${species.formName ?? species.bloodlineName} (${species.stage})`,
      })),
    },
    { name: 'stage', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'bloodlineId', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'in-review',
      options: [{ label: 'In review', value: 'in-review' }, { label: 'Approved', value: 'approved' }],
      admin: { position: 'sidebar', description: 'Only approved stills reach the site and apps. Uploading a new picture sets this back to In review.' },
    },
    {
      name: 'alt',
      label: 'Alt text',
      type: 'text',
      required: true,
      admin: { description: 'What the picture shows, for screen readers. Name the Mon; no pronoun for it.' },
    },
    // Written only by the Bunny hook through the Local API (access bypassed); never by REST or MCP.
    { name: 'bunnyUrl', type: 'text', access: { create: () => false, update: () => false }, admin: { readOnly: true, hidden: true } },
    {
      name: 'credit',
      type: 'group',
      fields: [
        { name: 'author', type: 'text' },
        { name: 'sourceUrl', type: 'text' },
      ],
    },
  ],
  timestamps: true,
};
