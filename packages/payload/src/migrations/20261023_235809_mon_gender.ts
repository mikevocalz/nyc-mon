import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_mon_instances_gender" AS ENUM('female', 'male');
  CREATE TYPE "payload"."enum__mon_instances_v_version_gender" AS ENUM('female', 'male');
  ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1792799889583;
  ALTER TABLE "payload"."_rate_limits_v" ALTER COLUMN "version_last_request" SET DEFAULT 1792799889583;
  ALTER TABLE "payload"."mon_instances" ADD COLUMN "gender" "payload"."enum_mon_instances_gender";
  ALTER TABLE "payload"."_mon_instances_v" ADD COLUMN "version_gender" "payload"."enum__mon_instances_v_version_gender";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1792612733774;
  ALTER TABLE "payload"."_rate_limits_v" ALTER COLUMN "version_last_request" SET DEFAULT 1792612733774;
  ALTER TABLE "payload"."mon_instances" DROP COLUMN "gender";
  ALTER TABLE "payload"."_mon_instances_v" DROP COLUMN "version_gender";
  DROP TYPE "payload"."enum_mon_instances_gender";
  DROP TYPE "payload"."enum__mon_instances_v_version_gender";`)
}
