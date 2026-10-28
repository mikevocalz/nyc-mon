import type { GlobalConfig, Validate } from 'payload';
import { LIFECYCLE_STAGES, MON_MOODS, parseVoiceLineageId } from '@acme/core';
import { invalidateMonLingo } from '../admin/console/v1/mon-lingo-cache.ts';
import { STAFF_ROLES, staffRoles } from '../collections/access/roles.ts';

export const MON_VOICES_SLUG = 'mon-voices';

/**
 * Who voices each Mon and how a line is delivered: the numbers half of the
 * Mon's voice. The words half (lines, pronunciations, stage directions) is in
 * `language-lexicon`, which has no place for a voice id or a stability value;
 * hence one global instead of more lexicon rows. `GET /v1/mon-lingo` serves
 * both together. Seeded by migration 20261028_200000_mon_lingo_seed from what
 * packages/content/voices.ts held on 2026-10-28.
 *
 * Each Mon keeps one voice lineage for life (Bible v11 ¶56). After launch a
 * slot is never re-cast: append a slot or a new line instead.
 */

const lineageIdValid: Validate<string | null | undefined> = (value) =>
  typeof value === 'string' && parseVoiceLineageId(value) !== undefined ? true : 'Use <egg speciesId>/<female|male>/<slot>, e.g. dex-001/female/1.';

const unit = (name: string, label: string, description: string) => ({ name, label, type: 'number' as const, required: true, min: 0, max: 1, admin: { description, step: 0.05 } });

const STAGE_FIELDS = LIFECYCLE_STAGES.map((stage) => ({
  name: stage.toLowerCase(),
  label: stage,
  type: 'number' as const,
  min: 0.5,
  max: 2,
  admin: { description: stage === 'Egg' ? 'Empty: an Egg is silent.' : 'Pitch factor, 1 is the voice as cast. Empty: silent.', step: 0.01 },
}));

export const MonVoices: GlobalConfig = {
  slug: MON_VOICES_SLUG,
  label: 'Mon voices',
  admin: { group: 'Content', description: 'The voice each Mon lineage speaks with, pitch by stage, and delivery by mood. Words and pronunciations are in the Language Lexicon.' },
  access: {
    read: staffRoles(STAFF_ROLES),
    update: staffRoles(['ops', 'content']),
  },
  hooks: { afterChange: [() => invalidateMonLingo()] },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'provider', type: 'select', required: true, defaultValue: 'elevenlabs', options: ['elevenlabs'], admin: { width: '50%' } },
        { name: 'model', type: 'text', required: true, defaultValue: 'eleven_v4_turbo', maxLength: 64, admin: { width: '50%', description: 'ElevenLabs model id. v4 Turbo performs audio tags.' } },
      ],
    },
    {
      name: 'lineages',
      type: 'array',
      admin: { description: 'One row per lineage slot. A pool shorter than the slot count wraps, so fill each pool.' },
      validate: (rows: unknown) => {
        const ids = Array.isArray(rows) ? rows.map((row) => (row as { lineageId?: unknown }).lineageId) : [];
        return new Set(ids).size === ids.length ? true : 'Each lineage id appears once.';
      },
      fields: [
        { name: 'lineageId', type: 'text', required: true, maxLength: 64, validate: lineageIdValid },
        { name: 'voiceId', type: 'text', required: true, maxLength: 64, admin: { description: 'ElevenLabs voice id.' } },
        { name: 'name', type: 'text', required: true, maxLength: 120 },
        {
          type: 'row',
          fields: [
            { ...unit('style', 'Style', 'How strongly the voice’s own delivery is exaggerated.'), admin: { width: '50%', step: 0.05 } },
            { name: 'speed', type: 'number', required: true, min: 0.7, max: 1.2, defaultValue: 1, admin: { width: '50%', step: 0.01 } },
          ],
        },
      ],
    },
    { name: 'stagePitch', type: 'group', label: 'Pitch by stage', fields: STAGE_FIELDS },
    {
      name: 'moods',
      type: 'array',
      label: 'Delivery by mood',
      validate: (rows: unknown) => {
        const moods = Array.isArray(rows) ? rows.map((row) => (row as { mood?: unknown }).mood) : [];
        return new Set(moods).size === moods.length ? true : 'Each mood appears once.';
      },
      fields: [
        { name: 'mood', type: 'select', required: true, options: [...MON_MOODS] },
        { name: 'tag', type: 'text', maxLength: 40, admin: { description: 'Audio tag before the line, e.g. [happily]. Empty: none.' } },
        unit('stability', 'Stability', 'Lower is livelier, higher is flatter.'),
        unit('similarityBoost', 'Similarity', 'How closely the output keeps to the cast voice.'),
      ],
    },
    {
      name: 'defaultDelivery',
      type: 'group',
      label: 'Delivery without a mood',
      fields: [
        { name: 'tag', type: 'text', maxLength: 40 },
        { ...unit('stability', 'Stability', 'Lower is livelier, higher is flatter.'), defaultValue: 0.45 },
        { ...unit('similarityBoost', 'Similarity', 'How closely the output keeps to the cast voice.'), defaultValue: 0.8 },
      ],
    },
    {
      name: 'lowEnergy',
      type: 'group',
      label: 'Tired delivery',
      admin: { description: 'In these moods the Mon keeps its voice but drops the swagger.' },
      fields: [
        { name: 'moods', type: 'select', hasMany: true, options: [...MON_MOODS] },
        { ...unit('styleFactor', 'Style factor', 'Multiplies the voice’s style.'), defaultValue: 0.5 },
        { name: 'maxSpeed', type: 'number', required: true, min: 0.7, max: 1.2, defaultValue: 0.95 },
      ],
    },
  ],
};
