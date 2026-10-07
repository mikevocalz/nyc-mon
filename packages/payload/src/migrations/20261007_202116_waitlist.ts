import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_waitlist_district" AS ENUM('downtown', 'midtown', 'harlem', 'megacity');
  CREATE TABLE "payload"."waitlist" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"district" "payload"."enum_waitlist_district",
  	"source" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1791404476421;
  ALTER TABLE "payload"."_rate_limits_v" ALTER COLUMN "version_last_request" SET DEFAULT 1791404476421;
  ALTER TABLE "payload"."media" ADD COLUMN "bunny_url" varchar;
  ALTER TABLE "payload"."_media_v" ADD COLUMN "version_bunny_url" varchar;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "waitlist_id" integer;
  CREATE UNIQUE INDEX "waitlist_email_idx" ON "payload"."waitlist" USING btree ("email");
  CREATE INDEX "waitlist_updated_at_idx" ON "payload"."waitlist" USING btree ("updated_at");
  CREATE INDEX "waitlist_created_at_idx" ON "payload"."waitlist" USING btree ("created_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_waitlist_fk" FOREIGN KEY ("waitlist_id") REFERENCES "payload"."waitlist"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_waitlist_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("waitlist_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."waitlist" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."waitlist" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_waitlist_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_waitlist_id_idx";
  ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1791149819909;
  ALTER TABLE "payload"."_rate_limits_v" ALTER COLUMN "version_last_request" SET DEFAULT 1791149819909;
  ALTER TABLE "payload"."media" DROP COLUMN "bunny_url";
  ALTER TABLE "payload"."_media_v" DROP COLUMN "version_bunny_url";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "waitlist_id";
  DROP TYPE "payload"."enum_waitlist_district";`)
}
