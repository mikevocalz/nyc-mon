import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload';
import { APIError } from 'payload';
import { allSpecies } from '@acme/content';
import { bunnyMediaAfterChange, bunnyMediaAfterDelete, bunnyMediaAfterRead } from '../storage/bunnyMedia';
import { hasStaffRole, STAFF_ROLES, staffRoles } from './access/roles.ts';
import { readGlb } from './glb.ts';
import { MON_ANIMATION_ROLES, MON_MODEL_LICENSES } from './monModelOptions.ts';
import { checkMonModelFile, MON_MODEL_FILE_MESSAGES } from './monModelFile.ts';

/**
 * One 3D model per Mon form (a species at one lifecycle stage). The file is a
 * GLB that Viro loads on phones, headsets and the web; the console's Models
 * page uploads, previews and replaces it. Species stay code-only in
 * @acme/content, so `speciesId` is a select over that roster.
 */

export { MON_MODEL_MAX_BYTES } from './monModelFile.ts';

const speciesById = new Map(allSpecies.map((species) => [species.speciesId, species]));

const vector = (name: string, label: string, defaultValue: number, description: string) => ({
  name,
  type: 'group' as const,
  label,
  admin: { description },
  fields: (['x', 'y', 'z'] as const).map((axis) => ({ name: axis, type: 'number' as const, defaultValue, required: true })),
});

const inspectUpload: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const species = typeof data.speciesId === 'string' ? speciesById.get(data.speciesId) : undefined;
  if (data.speciesId !== undefined && !species) throw new APIError('Pick a Mon form from the roster.', 400);
  if (species) {
    data.stage = species.stage;
    data.bloodlineId = species.bloodlineId;
  }
  const file = req.file;
  if (file) {
    const check = checkMonModelFile(file);
    if (!check.ok) throw new APIError(MON_MODEL_FILE_MESSAGES[check.problem], 400);
    let facts;
    try {
      facts = readGlb(file.data);
    } catch (error) {
      throw new APIError(error instanceof Error ? error.message : 'This file is not a GLB model.', 400);
    }
    data.animationClips = facts.animationClips.map((name) => ({ name }));
    // A replacement keeps only the role mappings whose clip is still in the file.
    const mapped = (data.animations ?? originalDoc?.animations ?? []) as { clip?: string }[];
    data.animations = mapped.filter((row) => typeof row.clip === 'string' && facts.animationClips.includes(row.clip));
    // A fresh key per upload: Bunny's edge never serves an older model from a reused URL.
    data.filename = `${data.speciesId ?? originalDoc?.speciesId ?? 'mon'}-${Date.now().toString(36)}.glb`;
    data.morphTargets = facts.morphTargets.map((name) => ({ name }));
    data.heightMeters = facts.heightMeters;
    // A new file has not been looked at yet.
    data.status = 'in-review';
  }
  return data;
};

export const MonModels: CollectionConfig = {
  slug: 'mon-models',
  labels: { singular: 'Mon model', plural: 'Mon models' },
  admin: {
    useAsTitle: 'speciesId',
    defaultColumns: ['speciesId', 'stage', 'status', 'updatedAt'],
    components: {
      views: {
        // The console's Models page replaces the stock list and edit views.
        list: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/models' } } },
        edit: { root: { Component: { path: './admin/console/Redirects#CollectionRedirect', clientProps: { to: '/admin/models' } } } },
      },
    },
  },
  access: {
    // Game clients load approved models; every staff role sees all of them.
    read: ({ req }) => hasStaffRole(req, STAFF_ROLES) || { status: { equals: 'approved' } },
    create: staffRoles(['ops', 'content']),
    update: staffRoles(['ops', 'content']),
    delete: staffRoles(['ops', 'content']),
  },
  upload: {
    disableLocalStorage: true,
    // Browsers send .glb as an empty type or octet-stream; readGlb checks the bytes.
    mimeTypes: ['model/gltf-binary', 'application/octet-stream'],
  },
  hooks: {
    beforeChange: [inspectUpload],
    afterChange: [bunnyMediaAfterChange],
    afterRead: [bunnyMediaAfterRead],
    afterDelete: [bunnyMediaAfterDelete],
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
      admin: { position: 'sidebar', description: 'Only approved models reach the game. Uploading a new file sets this back to In review.' },
    },
    // Written only by the Bunny hook through the Local API (access bypassed); never by REST or MCP.
    { name: 'bunnyUrl', type: 'text', access: { create: () => false, update: () => false }, admin: { readOnly: true, hidden: true } },
    {
      name: 'scale',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 0.001,
      admin: { description: 'Uniform scale applied in every scene. 1 keeps the exported size.' },
    },
    vector('position', 'Position offset (m)', 0, 'Moves the model so its feet sit on the floor at the origin.'),
    vector('rotation', 'Rotation (degrees)', 0, 'Turns the model so it faces the camera (+Z).'),
    {
      name: 'animations',
      type: 'array',
      admin: { description: 'Which clip in the file plays for each moment. Clip names come from the uploaded file.' },
      fields: [
        { name: 'role', type: 'select', required: true, options: [...MON_ANIMATION_ROLES] },
        { name: 'clip', type: 'text', required: true },
        { name: 'loop', type: 'checkbox', defaultValue: true },
      ],
    },
    // Read from the file on every upload (glb.ts); never typed by hand.
    { name: 'animationClips', type: 'array', admin: { readOnly: true }, fields: [{ name: 'name', type: 'text' }] },
    { name: 'morphTargets', type: 'array', admin: { readOnly: true }, fields: [{ name: 'name', type: 'text' }] },
    { name: 'heightMeters', type: 'number', admin: { readOnly: true } },
    {
      name: 'credit',
      type: 'group',
      fields: [
        { name: 'author', type: 'text' },
        { name: 'license', type: 'select', defaultValue: 'owned', options: [...MON_MODEL_LICENSES] },
        { name: 'sourceUrl', type: 'text' },
      ],
    },
    { name: 'notes', type: 'textarea', access: { read: ({ req }) => hasStaffRole(req, STAFF_ROLES) } },
  ],
  timestamps: true,
};
