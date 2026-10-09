import type { CollectionConfig } from 'payload';
import { staffRoles } from './access/roles.ts';

export const LANGUAGE_LEXICON_SLUG = 'language-lexicon';

const CONTENT_EDITORS = ['ops', 'content'] as const;

export const LanguageLexicon: CollectionConfig = {
  slug: LANGUAGE_LEXICON_SLUG,
  admin: {
    group: 'Content',
    useAsTitle: 'canonicalText',
    defaultColumns: ['canonicalText', 'entryType', 'category', 'communityTags', 'active'],
    description:
      'NYC-Mon voice/dialect lexicon. Identity-linked language is opt-in/persona-driven only; never infer identity from a Caller.',
  },
  access: {
    read: () => true,
    create: staffRoles(CONTENT_EDITORS),
    update: staffRoles(CONTENT_EDITORS),
    delete: staffRoles(CONTENT_EDITORS),
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
    { name: 'category', type: 'text', required: true, index: true, maxLength: 120 },
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
