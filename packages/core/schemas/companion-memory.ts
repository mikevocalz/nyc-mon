import { z } from 'zod';

/** Preferences are explicit user choices, not inferred identity, credentials or a transcript. */
export const CompanionPreferencesSchema = z.object({
  language: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/).max(24).optional(),
  responseStyle: z.enum(['brief', 'balanced', 'detailed']).optional(),
  interests: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
  approvedNote: z.string().trim().max(500).default(''),
}).strict();
export type CompanionPreferences = z.infer<typeof CompanionPreferencesSchema>;
export const MemoryWriteSchema = z.object({
  expectedRevision: z.number().int().min(0).max(2147483646),
  consent: z.literal(true),
  preferences: CompanionPreferencesSchema,
}).strict();
export const MemoryDeleteSchema = z.object({ expectedRevision: z.number().int().min(0).max(2147483646) }).strict();
const Timestamp = z.preprocess((value) => value instanceof Date ? value.toISOString() : value, z.string().datetime().nullable());
export const MemorySnapshotSchema = z.object({
  revision: z.number().int().nonnegative(),
  preferences: CompanionPreferencesSchema.nullable(),
  consentedAt: Timestamp,
  updatedAt: Timestamp,
});
export type MemorySnapshot = z.infer<typeof MemorySnapshotSchema>;
