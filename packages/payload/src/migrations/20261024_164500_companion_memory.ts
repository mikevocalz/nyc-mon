import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres';
import { sql } from '@payloadcms/db-postgres';
import { COMPANION_MEMORY_DOWN_SQL, COMPANION_MEMORY_UP_SQL } from '../admin/console/v1/companion-memory-schema.ts';

/** Same database, separate manually managed schema. Not applied by this PR. */
export async function up({ db }: MigrateUpArgs): Promise<void> { await db.execute(sql.raw(COMPANION_MEMORY_UP_SQL)); }
export async function down({ db }: MigrateDownArgs): Promise<void> { await db.execute(sql.raw(COMPANION_MEMORY_DOWN_SQL)); }
