import type { CollectionConfig, Validate } from 'payload';
import { allSpecies, bloodlines } from '@acme/content';
import { MON_LINGO_CATEGORIES } from '@acme/content/lingo';
import { LIFECYCLE_STAGES, MON_MOODS } from '@acme/core';
import { invalidateMonLingo } from '../admin/console/v1/mon-lingo-cache.ts';
import { STAFF_ROLES, staffRoles } from './access/roles.ts';

export const LANGUAGE_LEXICON_SLUG = 'language-lexicon';

const CONTENT_EDITORS = ['ops', 'content'] as const;

const SPECIES_IDS = new Set(allSpecies.map((species) => species.speciesId));
const BLOODLINE_IDS = new Set<string>(bloodlines.map((bloodline) => bloodline.bloodlineId));

const knownSpecies: Validate<string | null | undefined> = (value) =>
  value === null || value === undefined || value === '' || SPECIES_IDS.has(value) ? true : 'Use a speciesId from the roster, such as dex-002.';

const knownBloodline: Validate<string | null | undefined> = (value) =>
  value === null || value === undefined || value === '' || BLOODLINE_IDS.has(value) ? true : 'Use a bloodlineId from the roster, such as F01.';

/**
 * The Mon's lines and lingo live here (Mike, 2026-10-28: "all of this should
 * be in payload as far as the lines/lingo"). The rows in the categories below
 * are what the Mon's voice reads, served by `GET /v1/mon-lingo`; only
 * published (canon), active rows reach it. See packages/content/lingo/rows.ts.
 */
const VOICE_CATEGORY_HELP = `Categories the Mon's voice reads: ${MON_LINGO_CATEGORIES.join(', ')}. mon-line: triggerText is the occasion (hello, first-words, hungry…), responseText the line, with speciesId and stage. pronunciation: canonicalText is the screen word, variants the other spellings, spokenForm what the voice says. stage-direction: variants are the keywords, spokenForm the audio tag.`;

export const LanguageLexicon: CollectionConfig = {
  slug: LANGUAGE_LEXICON_SLUG,
  admin: {
    group: 'Content',
    useAsTitle: 'canonicalText',
    defaultColumns: ['canonicalText', 'entryType', 'category', 'communityTags', 'active'],
    description:
      'NYC-Mon voice/dialect lexicon and the Mon\'s lines. Publish a row to make it canon; only published, active rows are spoken. Identity-linked language is opt-in/persona-driven only; never infer identity from a Caller.',
  },
  // Draft, then publish: a published row is canon and the only kind served.
  versions: { drafts: true },
  access: {
    // Staff read it in the console. Callers and anonymous requests get the
    // published voice rows through GET /v1/mon-lingo, never this collection.
    read: staffRoles(STAFF_ROLES),
    create: staffRoles(CONTENT_EDITORS),
    update: staffRoles(CONTENT_EDITORS),
    delete: staffRoles(CONTENT_EDITORS),
  },
  hooks: {
    afterChange: [() => invalidateMonLingo()],
    afterDelete: [() => invalidateMonLingo()],
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true, maxLength: 160 },
    {
      name: 'entryType',
      type: 'select',
      required: true,
      index: true,
      options: [
        'lexicon',
        'pronunciation_rule',
        'grammar_rule',
        'call_response',
        'ballroom_term',
        'style_rule',
      ],
    },
    { name: 'canonicalText', type: 'text', required: true, index: true, maxLength: 220 },
    { name: 'spokenForm', type: 'text', maxLength: 260 },
    { name: 'meaning', type: 'textarea', required: true },
    { name: 'category', type: 'text', required: true, index: true, maxLength: 120, admin: { description: VOICE_CATEGORY_HELP } },
    { name: 'subcategory', type: 'text', maxLength: 160 },
    {
      name: 'communityTags',
      type: 'text',
      index: true,
      admin: { description: 'Pipe-delimited tags, e.g. Black NYC English|AAE|NYC' },
    },
    {
      name: 'boroughTags',
      type: 'text',
      admin: { description: 'Pipe-delimited borough/neighborhood tags or all' },
    },
    {
      type: 'row',
      fields: [
        { name: 'register', type: 'text', admin: { width: '33%' } },
        { name: 'tone', type: 'text', admin: { width: '33%' } },
        { name: 'ageMin', type: 'number', defaultValue: 13, admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'usageFrequency',
          type: 'select',
          defaultValue: 'medium',
          options: ['low', 'medium', 'high'],
          admin: { width: '50%' },
        },
        {
          name: 'mirrorStrength',
          type: 'select',
          defaultValue: 'low',
          options: ['none', 'low', 'medium', 'high'],
          admin: { width: '50%' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Voice & pronunciation',
      fields: [
        { name: 'ttsPronunciation', type: 'text' },
        { name: 'pronunciationNotes', type: 'textarea' },
        { name: 'grammarNotes', type: 'textarea' },
      ],
    },
    {
      type: 'collapsible',
      label: 'Call and response',
      fields: [
        { name: 'triggerText', type: 'text' },
        { name: 'responseText', type: 'textarea' },
      ],
    },
    {
      type: 'collapsible',
      label: 'Activation & cultural safety',
      fields: [
        { name: 'relationshipGate', type: 'textarea' },
        { name: 'activationPolicy', type: 'textarea', required: true },
        { name: 'avoidWhen', type: 'textarea' },
        {
          name: 'identityInference',
          type: 'textarea',
          defaultValue:
            'never infer identity; use explicit persona, user opt-in, or user-led mirroring',
          required: true,
        },
        {
          name: 'profanity',
          type: 'select',
          defaultValue: 'none',
          options: ['none'],
          required: true,
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Mon voice',
      admin: { description: 'Who and when a voice row applies to. Empty means every Mon.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'speciesId', type: 'text', index: true, maxLength: 32, validate: knownSpecies, admin: { width: '25%', description: 'Mon form, e.g. dex-002' } },
            { name: 'bloodlineId', type: 'text', maxLength: 16, validate: knownBloodline, admin: { width: '25%', description: 'Bloodline, e.g. F01' } },
            { name: 'stage', type: 'select', options: [...LIFECYCLE_STAGES], admin: { width: '25%' } },
            { name: 'mood', type: 'select', options: [...MON_MOODS], admin: { width: '25%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'variants', type: 'text', maxLength: 400, admin: { width: '40%', description: 'Pipe-delimited: other spellings (pronunciation) or keywords (stage-direction).' } },
            { name: 'spokenPlural', type: 'text', maxLength: 120, admin: { width: '20%' } },
            { name: 'sortOrder', type: 'number', defaultValue: 0, admin: { width: '20%', description: 'Lower first.' } },
            { name: 'locale', type: 'text', defaultValue: 'en-US', required: true, index: true, maxLength: 16, admin: { width: '20%' } },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Editorial provenance',
      fields: [
        { name: 'sourceBasis', type: 'text' },
        { name: 'sourceUrl', type: 'text' },
        { name: 'editorNotes', type: 'textarea' },
      ],
    },
    { name: 'active', type: 'checkbox', required: true, defaultValue: true, index: true },
  ],
};
