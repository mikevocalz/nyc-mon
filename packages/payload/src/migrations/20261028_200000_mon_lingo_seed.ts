import { createHash } from 'node:crypto'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { MON_LINGO_SEED_ROWS, MON_VOICES_SEED } from '@acme/content/lingo'

/**
 * Loads the Mon's lines and lingo into Payload, which is their source of truth
 * from here on: the rows in packages/content/lingo/seed.ts (quoted from
 * skills/nyc-mon-companion/SKILL.md and docs/alexa-plus-brief.md, each with
 * its `sourceBasis`) go into `language-lexicon` as published rows, and the
 * voice casting into the `mon-voices` global.
 *
 * A row whose key already exists is left alone (an editor may have changed
 * it), and the global is only written while it has no lineages, so running
 * this against a database that already has the lingo changes nothing.
 *
 * The seed is pinned by hash. If seed.ts changes after this migration, `up`
 * refuses to run and src/__tests__/mon-lingo-seed.test.ts fails: put the new
 * rows in a new migration (or edit them in the admin) instead.
 */
export const MON_LINGO_SEED_SHA256 = '6a7ac64fe8c86550a5415d0db146a7038c604bde003b13fea7c24db899d96759'

export function monLingoSeedHash(): string {
  return createHash('sha256').update(JSON.stringify({ rows: MON_LINGO_SEED_ROWS, voices: MON_VOICES_SEED })).digest('hex')
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const hash = monLingoSeedHash()
  if (hash !== MON_LINGO_SEED_SHA256) {
    throw new Error(`mon lingo seed changed after migration 20261028_200000_mon_lingo_seed (sha256 ${hash}); add a new migration for the new rows`)
  }

  const keys = MON_LINGO_SEED_ROWS.map((row) => row.key)
  const existing = await payload.find({
    collection: 'language-lexicon',
    where: { key: { in: keys } },
    limit: 0,
    pagination: false,
    depth: 0,
    draft: true,
    overrideAccess: true,
    req,
  })
  const have = new Set(existing.docs.map((doc) => doc.key))

  for (const row of MON_LINGO_SEED_ROWS) {
    if (have.has(row.key)) continue
    const data = Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined && value !== null))
    await payload.create({
      collection: 'language-lexicon',
      data: { ...data, _status: 'published' } as never,
      draft: false,
      overrideAccess: true,
      req,
    })
  }

  const voices = await payload.findGlobal({ slug: 'mon-voices', depth: 0, overrideAccess: true, req })
  if ((voices.lineages ?? []).length === 0) {
    await payload.updateGlobal({
      slug: 'mon-voices',
      data: {
        provider: MON_VOICES_SEED.provider,
        model: MON_VOICES_SEED.model,
        lineages: MON_VOICES_SEED.lineages.map((voice) => ({ ...voice })),
        stagePitch: { ...MON_VOICES_SEED.stagePitch },
        moods: MON_VOICES_SEED.moods.map((mood) => ({ ...mood })),
        defaultDelivery: { ...MON_VOICES_SEED.defaultDelivery },
        lowEnergy: { ...MON_VOICES_SEED.lowEnergy, moods: [...MON_VOICES_SEED.lowEnergy.moods] },
      } as never,
      overrideAccess: true,
      req,
    })
  }
}

/**
 * Removes only the rows this seed wrote (by key) and clears the global's
 * tables. Rows editors added under other keys stay. The schema migration's
 * own `down` then drops the voice columns and the `mon-voices` tables.
 */
export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({
    collection: 'language-lexicon',
    where: { key: { in: MON_LINGO_SEED_ROWS.map((row) => row.key) } },
    overrideAccess: true,
    req,
  })
  await payload.updateGlobal({
    slug: 'mon-voices',
    data: { lineages: [], moods: [], lowEnergy: { moods: [] } } as never,
    overrideAccess: true,
    req,
  })
}
