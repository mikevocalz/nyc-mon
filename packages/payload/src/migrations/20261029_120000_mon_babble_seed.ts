import { createHash } from 'node:crypto'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { MON_BABBLE_SEED_ROWS, MON_EGG_STAGE_PITCH } from '@acme/content/lingo'

/**
 * Loads the babble an Egg and a first-day Baby make (Decision 32, Mike,
 * 2026-10-29) into Payload: the rows in packages/content/lingo/babble-seed.ts
 * go into `language-lexicon` as published rows in category `babble`, and the
 * `mon-voices` global gets an Egg pitch (it was empty, so an Egg was silent).
 *
 * A row whose key already exists is left alone (an editor may have changed
 * it), and the Egg pitch is only written while it is empty, so a value an
 * editor set wins and running this twice changes nothing.
 *
 * The seed is pinned by hash. If babble-seed.ts changes after this migration,
 * `up` refuses to run and src/__tests__/mon-babble-seed.test.ts fails: put the
 * new rows in a new migration (or edit them in the admin) instead.
 */
export const MON_BABBLE_SEED_SHA256 = '202c8a3ebeb2b554cff12ee50527919e9bbe5f27002426bb499e3b82efaf9a4a'

export function monBabbleSeedHash(): string {
  return createHash('sha256').update(JSON.stringify({ rows: MON_BABBLE_SEED_ROWS, eggPitch: MON_EGG_STAGE_PITCH })).digest('hex')
}

type StagePitch = Record<string, number | null | undefined>

async function stagePitchOf({ payload, req }: Pick<MigrateUpArgs, 'payload' | 'req'>): Promise<StagePitch> {
  const voices = await payload.findGlobal({ slug: 'mon-voices', depth: 0, overrideAccess: true, req })
  return { ...((voices as { stagePitch?: StagePitch | null }).stagePitch ?? {}) }
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const hash = monBabbleSeedHash()
  if (hash !== MON_BABBLE_SEED_SHA256) {
    throw new Error(`mon babble seed changed after migration 20261029_120000_mon_babble_seed (sha256 ${hash}); add a new migration for the new rows`)
  }

  const keys = MON_BABBLE_SEED_ROWS.map((row) => row.key)
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

  for (const row of MON_BABBLE_SEED_ROWS) {
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

  const stagePitch = await stagePitchOf({ payload, req })
  if (stagePitch.egg === null || stagePitch.egg === undefined) {
    await payload.updateGlobal({
      slug: 'mon-voices',
      data: { stagePitch: { ...stagePitch, egg: MON_EGG_STAGE_PITCH } } as never,
      overrideAccess: true,
      req,
    })
  }
}

/**
 * Removes only the rows this seed wrote (by key), and empties the Egg pitch
 * only while it still holds the seeded value: a pitch an editor changed stays.
 */
export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({
    collection: 'language-lexicon',
    where: { key: { in: MON_BABBLE_SEED_ROWS.map((row) => row.key) } },
    overrideAccess: true,
    req,
  })
  const stagePitch = await stagePitchOf({ payload, req })
  if (stagePitch.egg !== null && stagePitch.egg !== undefined && Number(stagePitch.egg) === MON_EGG_STAGE_PITCH) {
    await payload.updateGlobal({
      slug: 'mon-voices',
      data: { stagePitch: { ...stagePitch, egg: null } } as never,
      overrideAccess: true,
      req,
    })
  }
}
