import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_payload_llm_instructions_entity_type" AS ENUM('collection', 'global');
  CREATE TABLE "payload"."users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."_users_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."_media_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."guardian_consents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."_guardian_consents_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."eggs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."_eggs_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."mon_instances_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."_mon_instances_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."care_states_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."_care_states_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."audit_events_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."_audit_events_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."integrity_runs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."_integrity_runs_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."idempotency_records_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."waitlist_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."language_lexicon_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."_language_lexicon_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."mon_models_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."_mon_models_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."sessions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."accounts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."verifications_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."passkeys_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."two_factors_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."device_codes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."jwks_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."oauth_clients_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."oauth_resources_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."oauth_client_resources_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."oauth_refresh_tokens_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."oauth_access_tokens_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."oauth_consents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."oauth_client_assertions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."rate_limits_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."payload_llm_instructions" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"entity_slug" varchar NOT NULL,
  	"entity_type" "payload"."enum_payload_llm_instructions_entity_type" NOT NULL,
  	"additional_instructions" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_llm_instructions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."mon_voices_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."_mon_voices_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  ALTER TABLE "payload"."_sessions_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_accounts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_verifications_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_passkeys_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_two_factors_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_device_codes_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_jwks_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_clients_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_resources_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_client_resources_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_refresh_tokens_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_access_tokens_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_consents_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_client_assertions_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_rate_limits_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."_sessions_v" CASCADE;
  DROP TABLE "payload"."_accounts_v" CASCADE;
  DROP TABLE "payload"."_verifications_v" CASCADE;
  DROP TABLE "payload"."_passkeys_v" CASCADE;
  DROP TABLE "payload"."_two_factors_v" CASCADE;
  DROP TABLE "payload"."_device_codes_v" CASCADE;
  DROP TABLE "payload"."_jwks_v" CASCADE;
  DROP TABLE "payload"."_oauth_clients_v" CASCADE;
  DROP TABLE "payload"."_oauth_resources_v" CASCADE;
  DROP TABLE "payload"."_oauth_client_resources_v" CASCADE;
  DROP TABLE "payload"."_oauth_refresh_tokens_v" CASCADE;
  DROP TABLE "payload"."_oauth_access_tokens_v" CASCADE;
  DROP TABLE "payload"."_oauth_consents_v" CASCADE;
  DROP TABLE "payload"."_oauth_client_assertions_v" CASCADE;
  DROP TABLE "payload"."_rate_limits_v" CASCADE;
  ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1793317310006;
  ALTER TABLE "payload"."media" ADD COLUMN "original_filename" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "original_url" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "original_mime_type" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "original_filesize" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "original_width" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "original_height" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "original_prefix" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "original__objectkey" varchar;
  ALTER TABLE "payload"."_media_v" ADD COLUMN "version_original_filename" varchar;
  ALTER TABLE "payload"."_media_v" ADD COLUMN "version_original_url" varchar;
  ALTER TABLE "payload"."_media_v" ADD COLUMN "version_original_mime_type" varchar;
  ALTER TABLE "payload"."_media_v" ADD COLUMN "version_original_filesize" numeric;
  ALTER TABLE "payload"."_media_v" ADD COLUMN "version_original_width" numeric;
  ALTER TABLE "payload"."_media_v" ADD COLUMN "version_original_height" numeric;
  ALTER TABLE "payload"."_media_v" ADD COLUMN "version_original_prefix" varchar;
  ALTER TABLE "payload"."_media_v" ADD COLUMN "version_original__objectkey" varchar;
  ALTER TABLE "payload"."mon_models" ADD COLUMN "original_filename" varchar;
  ALTER TABLE "payload"."mon_models" ADD COLUMN "original_url" varchar;
  ALTER TABLE "payload"."mon_models" ADD COLUMN "original_mime_type" varchar;
  ALTER TABLE "payload"."mon_models" ADD COLUMN "original_filesize" numeric;
  ALTER TABLE "payload"."mon_models" ADD COLUMN "original_width" numeric;
  ALTER TABLE "payload"."mon_models" ADD COLUMN "original_height" numeric;
  ALTER TABLE "payload"."mon_models" ADD COLUMN "original_prefix" varchar;
  ALTER TABLE "payload"."mon_models" ADD COLUMN "original__objectkey" varchar;
  ALTER TABLE "payload"."_mon_models_v" ADD COLUMN "version_original_filename" varchar;
  ALTER TABLE "payload"."_mon_models_v" ADD COLUMN "version_original_url" varchar;
  ALTER TABLE "payload"."_mon_models_v" ADD COLUMN "version_original_mime_type" varchar;
  ALTER TABLE "payload"."_mon_models_v" ADD COLUMN "version_original_filesize" numeric;
  ALTER TABLE "payload"."_mon_models_v" ADD COLUMN "version_original_width" numeric;
  ALTER TABLE "payload"."_mon_models_v" ADD COLUMN "version_original_height" numeric;
  ALTER TABLE "payload"."_mon_models_v" ADD COLUMN "version_original_prefix" varchar;
  ALTER TABLE "payload"."_mon_models_v" ADD COLUMN "version_original__objectkey" varchar;
  ALTER TABLE "payload"."users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."users_rels" ADD CONSTRAINT "users_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_users_v_rels" ADD CONSTRAINT "_users_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_users_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_users_v_rels" ADD CONSTRAINT "_users_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."media_rels" ADD CONSTRAINT "media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."media_rels" ADD CONSTRAINT "media_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_media_v_rels" ADD CONSTRAINT "_media_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_media_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_media_v_rels" ADD CONSTRAINT "_media_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."guardian_consents_rels" ADD CONSTRAINT "guardian_consents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."guardian_consents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."guardian_consents_rels" ADD CONSTRAINT "guardian_consents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_guardian_consents_v_rels" ADD CONSTRAINT "_guardian_consents_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_guardian_consents_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_guardian_consents_v_rels" ADD CONSTRAINT "_guardian_consents_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."eggs_rels" ADD CONSTRAINT "eggs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."eggs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."eggs_rels" ADD CONSTRAINT "eggs_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_eggs_v_rels" ADD CONSTRAINT "_eggs_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_eggs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_eggs_v_rels" ADD CONSTRAINT "_eggs_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."mon_instances_rels" ADD CONSTRAINT "mon_instances_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."mon_instances"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."mon_instances_rels" ADD CONSTRAINT "mon_instances_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_instances_v_rels" ADD CONSTRAINT "_mon_instances_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_mon_instances_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_instances_v_rels" ADD CONSTRAINT "_mon_instances_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."care_states_rels" ADD CONSTRAINT "care_states_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."care_states"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."care_states_rels" ADD CONSTRAINT "care_states_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_care_states_v_rels" ADD CONSTRAINT "_care_states_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_care_states_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_care_states_v_rels" ADD CONSTRAINT "_care_states_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."audit_events_rels" ADD CONSTRAINT "audit_events_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."audit_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."audit_events_rels" ADD CONSTRAINT "audit_events_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_audit_events_v_rels" ADD CONSTRAINT "_audit_events_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_audit_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_audit_events_v_rels" ADD CONSTRAINT "_audit_events_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."integrity_runs_rels" ADD CONSTRAINT "integrity_runs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."integrity_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."integrity_runs_rels" ADD CONSTRAINT "integrity_runs_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_integrity_runs_v_rels" ADD CONSTRAINT "_integrity_runs_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_integrity_runs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_integrity_runs_v_rels" ADD CONSTRAINT "_integrity_runs_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."idempotency_records_rels" ADD CONSTRAINT "idempotency_records_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."idempotency_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."idempotency_records_rels" ADD CONSTRAINT "idempotency_records_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."waitlist_rels" ADD CONSTRAINT "waitlist_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."waitlist"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."waitlist_rels" ADD CONSTRAINT "waitlist_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."language_lexicon_rels" ADD CONSTRAINT "language_lexicon_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."language_lexicon"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."language_lexicon_rels" ADD CONSTRAINT "language_lexicon_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_language_lexicon_v_rels" ADD CONSTRAINT "_language_lexicon_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_language_lexicon_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_language_lexicon_v_rels" ADD CONSTRAINT "_language_lexicon_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."mon_models_rels" ADD CONSTRAINT "mon_models_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."mon_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."mon_models_rels" ADD CONSTRAINT "mon_models_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_models_v_rels" ADD CONSTRAINT "_mon_models_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_mon_models_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_models_v_rels" ADD CONSTRAINT "_mon_models_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."sessions_rels" ADD CONSTRAINT "sessions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."sessions_rels" ADD CONSTRAINT "sessions_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."accounts_rels" ADD CONSTRAINT "accounts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."accounts_rels" ADD CONSTRAINT "accounts_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."verifications_rels" ADD CONSTRAINT "verifications_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."verifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."verifications_rels" ADD CONSTRAINT "verifications_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."passkeys_rels" ADD CONSTRAINT "passkeys_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."passkeys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."passkeys_rels" ADD CONSTRAINT "passkeys_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."two_factors_rels" ADD CONSTRAINT "two_factors_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."two_factors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."two_factors_rels" ADD CONSTRAINT "two_factors_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."device_codes_rels" ADD CONSTRAINT "device_codes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."device_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."device_codes_rels" ADD CONSTRAINT "device_codes_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."jwks_rels" ADD CONSTRAINT "jwks_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."jwks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."jwks_rels" ADD CONSTRAINT "jwks_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_clients_rels" ADD CONSTRAINT "oauth_clients_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_clients_rels" ADD CONSTRAINT "oauth_clients_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_resources_rels" ADD CONSTRAINT "oauth_resources_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_resources_rels" ADD CONSTRAINT "oauth_resources_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_client_resources_rels" ADD CONSTRAINT "oauth_client_resources_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_client_resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_client_resources_rels" ADD CONSTRAINT "oauth_client_resources_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_refresh_tokens_rels" ADD CONSTRAINT "oauth_refresh_tokens_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_refresh_tokens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_refresh_tokens_rels" ADD CONSTRAINT "oauth_refresh_tokens_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_access_tokens_rels" ADD CONSTRAINT "oauth_access_tokens_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_access_tokens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_access_tokens_rels" ADD CONSTRAINT "oauth_access_tokens_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_consents_rels" ADD CONSTRAINT "oauth_consents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_consents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_consents_rels" ADD CONSTRAINT "oauth_consents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_client_assertions_rels" ADD CONSTRAINT "oauth_client_assertions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_client_assertions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."oauth_client_assertions_rels" ADD CONSTRAINT "oauth_client_assertions_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."rate_limits_rels" ADD CONSTRAINT "rate_limits_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."rate_limits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."rate_limits_rels" ADD CONSTRAINT "rate_limits_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_llm_instructions_rels" ADD CONSTRAINT "payload_llm_instructions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_llm_instructions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_llm_instructions_rels" ADD CONSTRAINT "payload_llm_instructions_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."mon_voices_rels" ADD CONSTRAINT "mon_voices_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."mon_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."mon_voices_rels" ADD CONSTRAINT "mon_voices_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_voices_v_rels" ADD CONSTRAINT "_mon_voices_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_mon_voices_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_voices_v_rels" ADD CONSTRAINT "_mon_voices_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_rels_order_idx" ON "payload"."users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "payload"."users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "payload"."users_rels" USING btree ("path");
  CREATE INDEX "users_rels_users_id_idx" ON "payload"."users_rels" USING btree ("users_id");
  CREATE INDEX "_users_v_rels_order_idx" ON "payload"."_users_v_rels" USING btree ("order");
  CREATE INDEX "_users_v_rels_parent_idx" ON "payload"."_users_v_rels" USING btree ("parent_id");
  CREATE INDEX "_users_v_rels_path_idx" ON "payload"."_users_v_rels" USING btree ("path");
  CREATE INDEX "_users_v_rels_users_id_idx" ON "payload"."_users_v_rels" USING btree ("users_id");
  CREATE INDEX "media_rels_order_idx" ON "payload"."media_rels" USING btree ("order");
  CREATE INDEX "media_rels_parent_idx" ON "payload"."media_rels" USING btree ("parent_id");
  CREATE INDEX "media_rels_path_idx" ON "payload"."media_rels" USING btree ("path");
  CREATE INDEX "media_rels_users_id_idx" ON "payload"."media_rels" USING btree ("users_id");
  CREATE INDEX "_media_v_rels_order_idx" ON "payload"."_media_v_rels" USING btree ("order");
  CREATE INDEX "_media_v_rels_parent_idx" ON "payload"."_media_v_rels" USING btree ("parent_id");
  CREATE INDEX "_media_v_rels_path_idx" ON "payload"."_media_v_rels" USING btree ("path");
  CREATE INDEX "_media_v_rels_users_id_idx" ON "payload"."_media_v_rels" USING btree ("users_id");
  CREATE INDEX "guardian_consents_rels_order_idx" ON "payload"."guardian_consents_rels" USING btree ("order");
  CREATE INDEX "guardian_consents_rels_parent_idx" ON "payload"."guardian_consents_rels" USING btree ("parent_id");
  CREATE INDEX "guardian_consents_rels_path_idx" ON "payload"."guardian_consents_rels" USING btree ("path");
  CREATE INDEX "guardian_consents_rels_users_id_idx" ON "payload"."guardian_consents_rels" USING btree ("users_id");
  CREATE INDEX "_guardian_consents_v_rels_order_idx" ON "payload"."_guardian_consents_v_rels" USING btree ("order");
  CREATE INDEX "_guardian_consents_v_rels_parent_idx" ON "payload"."_guardian_consents_v_rels" USING btree ("parent_id");
  CREATE INDEX "_guardian_consents_v_rels_path_idx" ON "payload"."_guardian_consents_v_rels" USING btree ("path");
  CREATE INDEX "_guardian_consents_v_rels_users_id_idx" ON "payload"."_guardian_consents_v_rels" USING btree ("users_id");
  CREATE INDEX "eggs_rels_order_idx" ON "payload"."eggs_rels" USING btree ("order");
  CREATE INDEX "eggs_rels_parent_idx" ON "payload"."eggs_rels" USING btree ("parent_id");
  CREATE INDEX "eggs_rels_path_idx" ON "payload"."eggs_rels" USING btree ("path");
  CREATE INDEX "eggs_rels_users_id_idx" ON "payload"."eggs_rels" USING btree ("users_id");
  CREATE INDEX "_eggs_v_rels_order_idx" ON "payload"."_eggs_v_rels" USING btree ("order");
  CREATE INDEX "_eggs_v_rels_parent_idx" ON "payload"."_eggs_v_rels" USING btree ("parent_id");
  CREATE INDEX "_eggs_v_rels_path_idx" ON "payload"."_eggs_v_rels" USING btree ("path");
  CREATE INDEX "_eggs_v_rels_users_id_idx" ON "payload"."_eggs_v_rels" USING btree ("users_id");
  CREATE INDEX "mon_instances_rels_order_idx" ON "payload"."mon_instances_rels" USING btree ("order");
  CREATE INDEX "mon_instances_rels_parent_idx" ON "payload"."mon_instances_rels" USING btree ("parent_id");
  CREATE INDEX "mon_instances_rels_path_idx" ON "payload"."mon_instances_rels" USING btree ("path");
  CREATE INDEX "mon_instances_rels_users_id_idx" ON "payload"."mon_instances_rels" USING btree ("users_id");
  CREATE INDEX "_mon_instances_v_rels_order_idx" ON "payload"."_mon_instances_v_rels" USING btree ("order");
  CREATE INDEX "_mon_instances_v_rels_parent_idx" ON "payload"."_mon_instances_v_rels" USING btree ("parent_id");
  CREATE INDEX "_mon_instances_v_rels_path_idx" ON "payload"."_mon_instances_v_rels" USING btree ("path");
  CREATE INDEX "_mon_instances_v_rels_users_id_idx" ON "payload"."_mon_instances_v_rels" USING btree ("users_id");
  CREATE INDEX "care_states_rels_order_idx" ON "payload"."care_states_rels" USING btree ("order");
  CREATE INDEX "care_states_rels_parent_idx" ON "payload"."care_states_rels" USING btree ("parent_id");
  CREATE INDEX "care_states_rels_path_idx" ON "payload"."care_states_rels" USING btree ("path");
  CREATE INDEX "care_states_rels_users_id_idx" ON "payload"."care_states_rels" USING btree ("users_id");
  CREATE INDEX "_care_states_v_rels_order_idx" ON "payload"."_care_states_v_rels" USING btree ("order");
  CREATE INDEX "_care_states_v_rels_parent_idx" ON "payload"."_care_states_v_rels" USING btree ("parent_id");
  CREATE INDEX "_care_states_v_rels_path_idx" ON "payload"."_care_states_v_rels" USING btree ("path");
  CREATE INDEX "_care_states_v_rels_users_id_idx" ON "payload"."_care_states_v_rels" USING btree ("users_id");
  CREATE INDEX "audit_events_rels_order_idx" ON "payload"."audit_events_rels" USING btree ("order");
  CREATE INDEX "audit_events_rels_parent_idx" ON "payload"."audit_events_rels" USING btree ("parent_id");
  CREATE INDEX "audit_events_rels_path_idx" ON "payload"."audit_events_rels" USING btree ("path");
  CREATE INDEX "audit_events_rels_users_id_idx" ON "payload"."audit_events_rels" USING btree ("users_id");
  CREATE INDEX "_audit_events_v_rels_order_idx" ON "payload"."_audit_events_v_rels" USING btree ("order");
  CREATE INDEX "_audit_events_v_rels_parent_idx" ON "payload"."_audit_events_v_rels" USING btree ("parent_id");
  CREATE INDEX "_audit_events_v_rels_path_idx" ON "payload"."_audit_events_v_rels" USING btree ("path");
  CREATE INDEX "_audit_events_v_rels_users_id_idx" ON "payload"."_audit_events_v_rels" USING btree ("users_id");
  CREATE INDEX "integrity_runs_rels_order_idx" ON "payload"."integrity_runs_rels" USING btree ("order");
  CREATE INDEX "integrity_runs_rels_parent_idx" ON "payload"."integrity_runs_rels" USING btree ("parent_id");
  CREATE INDEX "integrity_runs_rels_path_idx" ON "payload"."integrity_runs_rels" USING btree ("path");
  CREATE INDEX "integrity_runs_rels_users_id_idx" ON "payload"."integrity_runs_rels" USING btree ("users_id");
  CREATE INDEX "_integrity_runs_v_rels_order_idx" ON "payload"."_integrity_runs_v_rels" USING btree ("order");
  CREATE INDEX "_integrity_runs_v_rels_parent_idx" ON "payload"."_integrity_runs_v_rels" USING btree ("parent_id");
  CREATE INDEX "_integrity_runs_v_rels_path_idx" ON "payload"."_integrity_runs_v_rels" USING btree ("path");
  CREATE INDEX "_integrity_runs_v_rels_users_id_idx" ON "payload"."_integrity_runs_v_rels" USING btree ("users_id");
  CREATE INDEX "idempotency_records_rels_order_idx" ON "payload"."idempotency_records_rels" USING btree ("order");
  CREATE INDEX "idempotency_records_rels_parent_idx" ON "payload"."idempotency_records_rels" USING btree ("parent_id");
  CREATE INDEX "idempotency_records_rels_path_idx" ON "payload"."idempotency_records_rels" USING btree ("path");
  CREATE INDEX "idempotency_records_rels_users_id_idx" ON "payload"."idempotency_records_rels" USING btree ("users_id");
  CREATE INDEX "waitlist_rels_order_idx" ON "payload"."waitlist_rels" USING btree ("order");
  CREATE INDEX "waitlist_rels_parent_idx" ON "payload"."waitlist_rels" USING btree ("parent_id");
  CREATE INDEX "waitlist_rels_path_idx" ON "payload"."waitlist_rels" USING btree ("path");
  CREATE INDEX "waitlist_rels_users_id_idx" ON "payload"."waitlist_rels" USING btree ("users_id");
  CREATE INDEX "language_lexicon_rels_order_idx" ON "payload"."language_lexicon_rels" USING btree ("order");
  CREATE INDEX "language_lexicon_rels_parent_idx" ON "payload"."language_lexicon_rels" USING btree ("parent_id");
  CREATE INDEX "language_lexicon_rels_path_idx" ON "payload"."language_lexicon_rels" USING btree ("path");
  CREATE INDEX "language_lexicon_rels_users_id_idx" ON "payload"."language_lexicon_rels" USING btree ("users_id");
  CREATE INDEX "_language_lexicon_v_rels_order_idx" ON "payload"."_language_lexicon_v_rels" USING btree ("order");
  CREATE INDEX "_language_lexicon_v_rels_parent_idx" ON "payload"."_language_lexicon_v_rels" USING btree ("parent_id");
  CREATE INDEX "_language_lexicon_v_rels_path_idx" ON "payload"."_language_lexicon_v_rels" USING btree ("path");
  CREATE INDEX "_language_lexicon_v_rels_users_id_idx" ON "payload"."_language_lexicon_v_rels" USING btree ("users_id");
  CREATE INDEX "mon_models_rels_order_idx" ON "payload"."mon_models_rels" USING btree ("order");
  CREATE INDEX "mon_models_rels_parent_idx" ON "payload"."mon_models_rels" USING btree ("parent_id");
  CREATE INDEX "mon_models_rels_path_idx" ON "payload"."mon_models_rels" USING btree ("path");
  CREATE INDEX "mon_models_rels_users_id_idx" ON "payload"."mon_models_rels" USING btree ("users_id");
  CREATE INDEX "_mon_models_v_rels_order_idx" ON "payload"."_mon_models_v_rels" USING btree ("order");
  CREATE INDEX "_mon_models_v_rels_parent_idx" ON "payload"."_mon_models_v_rels" USING btree ("parent_id");
  CREATE INDEX "_mon_models_v_rels_path_idx" ON "payload"."_mon_models_v_rels" USING btree ("path");
  CREATE INDEX "_mon_models_v_rels_users_id_idx" ON "payload"."_mon_models_v_rels" USING btree ("users_id");
  CREATE INDEX "sessions_rels_order_idx" ON "payload"."sessions_rels" USING btree ("order");
  CREATE INDEX "sessions_rels_parent_idx" ON "payload"."sessions_rels" USING btree ("parent_id");
  CREATE INDEX "sessions_rels_path_idx" ON "payload"."sessions_rels" USING btree ("path");
  CREATE INDEX "sessions_rels_users_id_idx" ON "payload"."sessions_rels" USING btree ("users_id");
  CREATE INDEX "accounts_rels_order_idx" ON "payload"."accounts_rels" USING btree ("order");
  CREATE INDEX "accounts_rels_parent_idx" ON "payload"."accounts_rels" USING btree ("parent_id");
  CREATE INDEX "accounts_rels_path_idx" ON "payload"."accounts_rels" USING btree ("path");
  CREATE INDEX "accounts_rels_users_id_idx" ON "payload"."accounts_rels" USING btree ("users_id");
  CREATE INDEX "verifications_rels_order_idx" ON "payload"."verifications_rels" USING btree ("order");
  CREATE INDEX "verifications_rels_parent_idx" ON "payload"."verifications_rels" USING btree ("parent_id");
  CREATE INDEX "verifications_rels_path_idx" ON "payload"."verifications_rels" USING btree ("path");
  CREATE INDEX "verifications_rels_users_id_idx" ON "payload"."verifications_rels" USING btree ("users_id");
  CREATE INDEX "passkeys_rels_order_idx" ON "payload"."passkeys_rels" USING btree ("order");
  CREATE INDEX "passkeys_rels_parent_idx" ON "payload"."passkeys_rels" USING btree ("parent_id");
  CREATE INDEX "passkeys_rels_path_idx" ON "payload"."passkeys_rels" USING btree ("path");
  CREATE INDEX "passkeys_rels_users_id_idx" ON "payload"."passkeys_rels" USING btree ("users_id");
  CREATE INDEX "two_factors_rels_order_idx" ON "payload"."two_factors_rels" USING btree ("order");
  CREATE INDEX "two_factors_rels_parent_idx" ON "payload"."two_factors_rels" USING btree ("parent_id");
  CREATE INDEX "two_factors_rels_path_idx" ON "payload"."two_factors_rels" USING btree ("path");
  CREATE INDEX "two_factors_rels_users_id_idx" ON "payload"."two_factors_rels" USING btree ("users_id");
  CREATE INDEX "device_codes_rels_order_idx" ON "payload"."device_codes_rels" USING btree ("order");
  CREATE INDEX "device_codes_rels_parent_idx" ON "payload"."device_codes_rels" USING btree ("parent_id");
  CREATE INDEX "device_codes_rels_path_idx" ON "payload"."device_codes_rels" USING btree ("path");
  CREATE INDEX "device_codes_rels_users_id_idx" ON "payload"."device_codes_rels" USING btree ("users_id");
  CREATE INDEX "jwks_rels_order_idx" ON "payload"."jwks_rels" USING btree ("order");
  CREATE INDEX "jwks_rels_parent_idx" ON "payload"."jwks_rels" USING btree ("parent_id");
  CREATE INDEX "jwks_rels_path_idx" ON "payload"."jwks_rels" USING btree ("path");
  CREATE INDEX "jwks_rels_users_id_idx" ON "payload"."jwks_rels" USING btree ("users_id");
  CREATE INDEX "oauth_clients_rels_order_idx" ON "payload"."oauth_clients_rels" USING btree ("order");
  CREATE INDEX "oauth_clients_rels_parent_idx" ON "payload"."oauth_clients_rels" USING btree ("parent_id");
  CREATE INDEX "oauth_clients_rels_path_idx" ON "payload"."oauth_clients_rels" USING btree ("path");
  CREATE INDEX "oauth_clients_rels_users_id_idx" ON "payload"."oauth_clients_rels" USING btree ("users_id");
  CREATE INDEX "oauth_resources_rels_order_idx" ON "payload"."oauth_resources_rels" USING btree ("order");
  CREATE INDEX "oauth_resources_rels_parent_idx" ON "payload"."oauth_resources_rels" USING btree ("parent_id");
  CREATE INDEX "oauth_resources_rels_path_idx" ON "payload"."oauth_resources_rels" USING btree ("path");
  CREATE INDEX "oauth_resources_rels_users_id_idx" ON "payload"."oauth_resources_rels" USING btree ("users_id");
  CREATE INDEX "oauth_client_resources_rels_order_idx" ON "payload"."oauth_client_resources_rels" USING btree ("order");
  CREATE INDEX "oauth_client_resources_rels_parent_idx" ON "payload"."oauth_client_resources_rels" USING btree ("parent_id");
  CREATE INDEX "oauth_client_resources_rels_path_idx" ON "payload"."oauth_client_resources_rels" USING btree ("path");
  CREATE INDEX "oauth_client_resources_rels_users_id_idx" ON "payload"."oauth_client_resources_rels" USING btree ("users_id");
  CREATE INDEX "oauth_refresh_tokens_rels_order_idx" ON "payload"."oauth_refresh_tokens_rels" USING btree ("order");
  CREATE INDEX "oauth_refresh_tokens_rels_parent_idx" ON "payload"."oauth_refresh_tokens_rels" USING btree ("parent_id");
  CREATE INDEX "oauth_refresh_tokens_rels_path_idx" ON "payload"."oauth_refresh_tokens_rels" USING btree ("path");
  CREATE INDEX "oauth_refresh_tokens_rels_users_id_idx" ON "payload"."oauth_refresh_tokens_rels" USING btree ("users_id");
  CREATE INDEX "oauth_access_tokens_rels_order_idx" ON "payload"."oauth_access_tokens_rels" USING btree ("order");
  CREATE INDEX "oauth_access_tokens_rels_parent_idx" ON "payload"."oauth_access_tokens_rels" USING btree ("parent_id");
  CREATE INDEX "oauth_access_tokens_rels_path_idx" ON "payload"."oauth_access_tokens_rels" USING btree ("path");
  CREATE INDEX "oauth_access_tokens_rels_users_id_idx" ON "payload"."oauth_access_tokens_rels" USING btree ("users_id");
  CREATE INDEX "oauth_consents_rels_order_idx" ON "payload"."oauth_consents_rels" USING btree ("order");
  CREATE INDEX "oauth_consents_rels_parent_idx" ON "payload"."oauth_consents_rels" USING btree ("parent_id");
  CREATE INDEX "oauth_consents_rels_path_idx" ON "payload"."oauth_consents_rels" USING btree ("path");
  CREATE INDEX "oauth_consents_rels_users_id_idx" ON "payload"."oauth_consents_rels" USING btree ("users_id");
  CREATE INDEX "oauth_client_assertions_rels_order_idx" ON "payload"."oauth_client_assertions_rels" USING btree ("order");
  CREATE INDEX "oauth_client_assertions_rels_parent_idx" ON "payload"."oauth_client_assertions_rels" USING btree ("parent_id");
  CREATE INDEX "oauth_client_assertions_rels_path_idx" ON "payload"."oauth_client_assertions_rels" USING btree ("path");
  CREATE INDEX "oauth_client_assertions_rels_users_id_idx" ON "payload"."oauth_client_assertions_rels" USING btree ("users_id");
  CREATE INDEX "rate_limits_rels_order_idx" ON "payload"."rate_limits_rels" USING btree ("order");
  CREATE INDEX "rate_limits_rels_parent_idx" ON "payload"."rate_limits_rels" USING btree ("parent_id");
  CREATE INDEX "rate_limits_rels_path_idx" ON "payload"."rate_limits_rels" USING btree ("path");
  CREATE INDEX "rate_limits_rels_users_id_idx" ON "payload"."rate_limits_rels" USING btree ("users_id");
  CREATE INDEX "payload_llm_instructions_entity_slug_idx" ON "payload"."payload_llm_instructions" USING btree ("entity_slug");
  CREATE INDEX "payload_llm_instructions_updated_at_idx" ON "payload"."payload_llm_instructions" USING btree ("updated_at");
  CREATE INDEX "payload_llm_instructions_created_at_idx" ON "payload"."payload_llm_instructions" USING btree ("created_at");
  CREATE INDEX "payload_llm_instructions_rels_order_idx" ON "payload"."payload_llm_instructions_rels" USING btree ("order");
  CREATE INDEX "payload_llm_instructions_rels_parent_idx" ON "payload"."payload_llm_instructions_rels" USING btree ("parent_id");
  CREATE INDEX "payload_llm_instructions_rels_path_idx" ON "payload"."payload_llm_instructions_rels" USING btree ("path");
  CREATE INDEX "payload_llm_instructions_rels_users_id_idx" ON "payload"."payload_llm_instructions_rels" USING btree ("users_id");
  CREATE INDEX "mon_voices_rels_order_idx" ON "payload"."mon_voices_rels" USING btree ("order");
  CREATE INDEX "mon_voices_rels_parent_idx" ON "payload"."mon_voices_rels" USING btree ("parent_id");
  CREATE INDEX "mon_voices_rels_path_idx" ON "payload"."mon_voices_rels" USING btree ("path");
  CREATE INDEX "mon_voices_rels_users_id_idx" ON "payload"."mon_voices_rels" USING btree ("users_id");
  CREATE INDEX "_mon_voices_v_rels_order_idx" ON "payload"."_mon_voices_v_rels" USING btree ("order");
  CREATE INDEX "_mon_voices_v_rels_parent_idx" ON "payload"."_mon_voices_v_rels" USING btree ("parent_id");
  CREATE INDEX "_mon_voices_v_rels_path_idx" ON "payload"."_mon_voices_v_rels" USING btree ("path");
  CREATE INDEX "_mon_voices_v_rels_users_id_idx" ON "payload"."_mon_voices_v_rels" USING btree ("users_id");
  CREATE INDEX "media_original_original_filename_idx" ON "payload"."media" USING btree ("original_filename");
  CREATE INDEX "_media_v_version_original_version_original_filename_idx" ON "payload"."_media_v" USING btree ("version_original_filename");
  CREATE INDEX "mon_models_original_original_filename_idx" ON "payload"."mon_models" USING btree ("original_filename");
  CREATE INDEX "_mon_models_v_version_original_version_original_filename_idx" ON "payload"."_mon_models_v" USING btree ("version_original_filename");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."_sessions_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_expires_at" timestamp(3) with time zone NOT NULL,
  	"version_token" varchar NOT NULL,
  	"version_ip_address" varchar,
  	"version_user_agent" varchar,
  	"version_user_id" integer NOT NULL,
  	"version_surface" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_accounts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_account_id" varchar NOT NULL,
  	"version_provider_id" varchar NOT NULL,
  	"version_user_id" integer NOT NULL,
  	"version_access_token" varchar,
  	"version_refresh_token" varchar,
  	"version_id_token" varchar,
  	"version_access_token_expires_at" timestamp(3) with time zone,
  	"version_refresh_token_expires_at" timestamp(3) with time zone,
  	"version_scope" varchar,
  	"version_password" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_verifications_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_identifier" varchar NOT NULL,
  	"version_value" varchar NOT NULL,
  	"version_expires_at" timestamp(3) with time zone NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_passkeys_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_public_key" varchar NOT NULL,
  	"version_user_id" integer NOT NULL,
  	"version_credential_i_d" varchar NOT NULL,
  	"version_counter" numeric NOT NULL,
  	"version_device_type" varchar NOT NULL,
  	"version_backed_up" boolean DEFAULT false NOT NULL,
  	"version_transports" varchar,
  	"version_aaguid" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_two_factors_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_secret" varchar NOT NULL,
  	"version_backup_codes" varchar NOT NULL,
  	"version_user_id" integer NOT NULL,
  	"version_verified" boolean DEFAULT true,
  	"version_failed_verification_count" numeric DEFAULT 0,
  	"version_locked_until" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_device_codes_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_device_code" varchar NOT NULL,
  	"version_user_code" varchar NOT NULL,
  	"version_user_id" varchar,
  	"version_expires_at" timestamp(3) with time zone NOT NULL,
  	"version_status" varchar NOT NULL,
  	"version_last_polled_at" timestamp(3) with time zone,
  	"version_polling_interval" numeric,
  	"version_client_id" varchar,
  	"version_scope" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_jwks_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_public_key" varchar NOT NULL,
  	"version_private_key" varchar NOT NULL,
  	"version_expires_at" timestamp(3) with time zone,
  	"version_alg" varchar,
  	"version_crv" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_oauth_clients_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_client_id" varchar NOT NULL,
  	"version_client_secret" varchar,
  	"version_client_discovery_id" varchar,
  	"version_disabled" boolean DEFAULT false,
  	"version_skip_consent" boolean,
  	"version_enable_end_session" boolean,
  	"version_subject_type" varchar,
  	"version_scopes" jsonb,
  	"version_client_credentials_scopes" jsonb DEFAULT '[]'::jsonb,
  	"version_user_id" integer,
  	"version_name" varchar,
  	"version_uri" varchar,
  	"version_icon" varchar,
  	"version_contacts" jsonb,
  	"version_tos" varchar,
  	"version_policy" varchar,
  	"version_software_id" varchar,
  	"version_software_version" varchar,
  	"version_software_statement" varchar,
  	"version_redirect_uris" jsonb NOT NULL,
  	"version_post_logout_redirect_uris" jsonb,
  	"version_backchannel_logout_uri" varchar,
  	"version_backchannel_logout_session_required" boolean,
  	"version_token_endpoint_auth_method" varchar,
  	"version_application_type" varchar,
  	"version_jwks" varchar,
  	"version_jwks_uri" varchar,
  	"version_grant_types" jsonb,
  	"version_response_types" jsonb,
  	"version_require_p_k_c_e" boolean,
  	"version_dpop_bound_access_tokens" boolean DEFAULT false,
  	"version_reference_id" varchar,
  	"version_metadata" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_oauth_resources_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_identifier" varchar NOT NULL,
  	"version_name" varchar NOT NULL,
  	"version_access_token_ttl" numeric,
  	"version_refresh_token_ttl" numeric,
  	"version_signing_algorithm" varchar,
  	"version_signing_key_id" varchar,
  	"version_allowed_scopes" jsonb,
  	"version_custom_claims" jsonb,
  	"version_dpop_bound_access_tokens_required" boolean DEFAULT false,
  	"version_disabled" boolean DEFAULT false,
  	"version_policy_version" numeric DEFAULT 1,
  	"version_metadata" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_oauth_client_resources_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_client_id" varchar NOT NULL,
  	"version_resource_id" varchar NOT NULL,
  	"version_metadata" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_oauth_refresh_tokens_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_token" varchar NOT NULL,
  	"version_client_id" varchar NOT NULL,
  	"version_session_id" integer,
  	"version_user_id" integer NOT NULL,
  	"version_reference_id" varchar,
  	"version_authorization_code_id" varchar,
  	"version_resources" jsonb,
  	"version_requested_user_info_claims" jsonb,
  	"version_expires_at" timestamp(3) with time zone,
  	"version_revoked" timestamp(3) with time zone,
  	"version_rotated_at" timestamp(3) with time zone,
  	"version_rotation_replay_response" varchar,
  	"version_rotation_replay_expires_at" timestamp(3) with time zone,
  	"version_auth_time" timestamp(3) with time zone,
  	"version_confirmation" jsonb,
  	"version_scopes" jsonb NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_oauth_access_tokens_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_token" varchar,
  	"version_client_id" varchar NOT NULL,
  	"version_session_id" integer,
  	"version_user_id" integer,
  	"version_reference_id" varchar,
  	"version_authorization_code_id" varchar,
  	"version_resources" jsonb,
  	"version_requested_user_info_claims" jsonb,
  	"version_refresh_id" integer,
  	"version_expires_at" timestamp(3) with time zone,
  	"version_revoked" timestamp(3) with time zone,
  	"version_confirmation" jsonb,
  	"version_scopes" jsonb NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_oauth_consents_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_client_id" varchar NOT NULL,
  	"version_user_id" integer,
  	"version_reference_id" varchar,
  	"version_resources" jsonb,
  	"version_requested_user_info_claims" jsonb,
  	"version_scopes" jsonb NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_oauth_client_assertions_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_expires_at" timestamp(3) with time zone NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_rate_limits_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" varchar NOT NULL,
  	"version_count" numeric NOT NULL,
  	"version_last_request" numeric DEFAULT 1793215292609 NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."users_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_users_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."media_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_media_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."guardian_consents_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_guardian_consents_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."eggs_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_eggs_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."mon_instances_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_mon_instances_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."care_states_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_care_states_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."audit_events_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_audit_events_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."integrity_runs_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_integrity_runs_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."idempotency_records_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."waitlist_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."language_lexicon_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_language_lexicon_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."mon_models_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_mon_models_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."sessions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."accounts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."verifications_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."passkeys_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."two_factors_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."device_codes_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."jwks_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_clients_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_resources_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_client_resources_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_refresh_tokens_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_access_tokens_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_consents_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_client_assertions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."rate_limits_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."payload_llm_instructions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."payload_llm_instructions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."mon_voices_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_mon_voices_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."users_rels" CASCADE;
  DROP TABLE "payload"."_users_v_rels" CASCADE;
  DROP TABLE "payload"."media_rels" CASCADE;
  DROP TABLE "payload"."_media_v_rels" CASCADE;
  DROP TABLE "payload"."guardian_consents_rels" CASCADE;
  DROP TABLE "payload"."_guardian_consents_v_rels" CASCADE;
  DROP TABLE "payload"."eggs_rels" CASCADE;
  DROP TABLE "payload"."_eggs_v_rels" CASCADE;
  DROP TABLE "payload"."mon_instances_rels" CASCADE;
  DROP TABLE "payload"."_mon_instances_v_rels" CASCADE;
  DROP TABLE "payload"."care_states_rels" CASCADE;
  DROP TABLE "payload"."_care_states_v_rels" CASCADE;
  DROP TABLE "payload"."audit_events_rels" CASCADE;
  DROP TABLE "payload"."_audit_events_v_rels" CASCADE;
  DROP TABLE "payload"."integrity_runs_rels" CASCADE;
  DROP TABLE "payload"."_integrity_runs_v_rels" CASCADE;
  DROP TABLE "payload"."idempotency_records_rels" CASCADE;
  DROP TABLE "payload"."waitlist_rels" CASCADE;
  DROP TABLE "payload"."language_lexicon_rels" CASCADE;
  DROP TABLE "payload"."_language_lexicon_v_rels" CASCADE;
  DROP TABLE "payload"."mon_models_rels" CASCADE;
  DROP TABLE "payload"."_mon_models_v_rels" CASCADE;
  DROP TABLE "payload"."sessions_rels" CASCADE;
  DROP TABLE "payload"."accounts_rels" CASCADE;
  DROP TABLE "payload"."verifications_rels" CASCADE;
  DROP TABLE "payload"."passkeys_rels" CASCADE;
  DROP TABLE "payload"."two_factors_rels" CASCADE;
  DROP TABLE "payload"."device_codes_rels" CASCADE;
  DROP TABLE "payload"."jwks_rels" CASCADE;
  DROP TABLE "payload"."oauth_clients_rels" CASCADE;
  DROP TABLE "payload"."oauth_resources_rels" CASCADE;
  DROP TABLE "payload"."oauth_client_resources_rels" CASCADE;
  DROP TABLE "payload"."oauth_refresh_tokens_rels" CASCADE;
  DROP TABLE "payload"."oauth_access_tokens_rels" CASCADE;
  DROP TABLE "payload"."oauth_consents_rels" CASCADE;
  DROP TABLE "payload"."oauth_client_assertions_rels" CASCADE;
  DROP TABLE "payload"."rate_limits_rels" CASCADE;
  DROP TABLE "payload"."payload_llm_instructions" CASCADE;
  DROP TABLE "payload"."payload_llm_instructions_rels" CASCADE;
  DROP TABLE "payload"."mon_voices_rels" CASCADE;
  DROP TABLE "payload"."_mon_voices_v_rels" CASCADE;
  DROP INDEX "payload"."media_original_original_filename_idx";
  DROP INDEX "payload"."_media_v_version_original_version_original_filename_idx";
  DROP INDEX "payload"."mon_models_original_original_filename_idx";
  DROP INDEX "payload"."_mon_models_v_version_original_version_original_filename_idx";
  ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1793215292609;
  ALTER TABLE "payload"."_sessions_v" ADD CONSTRAINT "_sessions_v_parent_id_sessions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_sessions_v" ADD CONSTRAINT "_sessions_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_accounts_v" ADD CONSTRAINT "_accounts_v_parent_id_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_accounts_v" ADD CONSTRAINT "_accounts_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_verifications_v" ADD CONSTRAINT "_verifications_v_parent_id_verifications_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."verifications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_passkeys_v" ADD CONSTRAINT "_passkeys_v_parent_id_passkeys_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."passkeys"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_passkeys_v" ADD CONSTRAINT "_passkeys_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_two_factors_v" ADD CONSTRAINT "_two_factors_v_parent_id_two_factors_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."two_factors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_two_factors_v" ADD CONSTRAINT "_two_factors_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_device_codes_v" ADD CONSTRAINT "_device_codes_v_parent_id_device_codes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."device_codes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_jwks_v" ADD CONSTRAINT "_jwks_v_parent_id_jwks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."jwks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_clients_v" ADD CONSTRAINT "_oauth_clients_v_parent_id_oauth_clients_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_clients_v" ADD CONSTRAINT "_oauth_clients_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_resources_v" ADD CONSTRAINT "_oauth_resources_v_parent_id_oauth_resources_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_resources"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_client_resources_v" ADD CONSTRAINT "_oauth_client_resources_v_parent_id_oauth_client_resources_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_client_resources"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_refresh_tokens_v" ADD CONSTRAINT "_oauth_refresh_tokens_v_parent_id_oauth_refresh_tokens_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_refresh_tokens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_refresh_tokens_v" ADD CONSTRAINT "_oauth_refresh_tokens_v_version_session_id_sessions_id_fk" FOREIGN KEY ("version_session_id") REFERENCES "payload"."sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_refresh_tokens_v" ADD CONSTRAINT "_oauth_refresh_tokens_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_access_tokens_v" ADD CONSTRAINT "_oauth_access_tokens_v_parent_id_oauth_access_tokens_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_access_tokens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_access_tokens_v" ADD CONSTRAINT "_oauth_access_tokens_v_version_session_id_sessions_id_fk" FOREIGN KEY ("version_session_id") REFERENCES "payload"."sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_access_tokens_v" ADD CONSTRAINT "_oauth_access_tokens_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_access_tokens_v" ADD CONSTRAINT "_oauth_access_tokens_v_version_refresh_id_oauth_refresh_tokens_id_fk" FOREIGN KEY ("version_refresh_id") REFERENCES "payload"."oauth_refresh_tokens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_consents_v" ADD CONSTRAINT "_oauth_consents_v_parent_id_oauth_consents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_consents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_consents_v" ADD CONSTRAINT "_oauth_consents_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_client_assertions_v" ADD CONSTRAINT "_oauth_client_assertions_v_parent_id_oauth_client_assertions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_client_assertions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_rate_limits_v" ADD CONSTRAINT "_rate_limits_v_parent_id_rate_limits_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."rate_limits"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "_sessions_v_parent_idx" ON "payload"."_sessions_v" USING btree ("parent_id");
  CREATE INDEX "_sessions_v_version_version_token_idx" ON "payload"."_sessions_v" USING btree ("version_token");
  CREATE INDEX "_sessions_v_version_version_user_idx" ON "payload"."_sessions_v" USING btree ("version_user_id");
  CREATE INDEX "_sessions_v_version_version_updated_at_idx" ON "payload"."_sessions_v" USING btree ("version_updated_at");
  CREATE INDEX "_sessions_v_version_version_created_at_idx" ON "payload"."_sessions_v" USING btree ("version_created_at");
  CREATE INDEX "_sessions_v_created_at_idx" ON "payload"."_sessions_v" USING btree ("created_at");
  CREATE INDEX "_sessions_v_updated_at_idx" ON "payload"."_sessions_v" USING btree ("updated_at");
  CREATE INDEX "_accounts_v_parent_idx" ON "payload"."_accounts_v" USING btree ("parent_id");
  CREATE INDEX "_accounts_v_version_version_user_idx" ON "payload"."_accounts_v" USING btree ("version_user_id");
  CREATE INDEX "_accounts_v_version_version_updated_at_idx" ON "payload"."_accounts_v" USING btree ("version_updated_at");
  CREATE INDEX "_accounts_v_version_version_created_at_idx" ON "payload"."_accounts_v" USING btree ("version_created_at");
  CREATE INDEX "_accounts_v_created_at_idx" ON "payload"."_accounts_v" USING btree ("created_at");
  CREATE INDEX "_accounts_v_updated_at_idx" ON "payload"."_accounts_v" USING btree ("updated_at");
  CREATE INDEX "_verifications_v_parent_idx" ON "payload"."_verifications_v" USING btree ("parent_id");
  CREATE INDEX "_verifications_v_version_version_updated_at_idx" ON "payload"."_verifications_v" USING btree ("version_updated_at");
  CREATE INDEX "_verifications_v_version_version_created_at_idx" ON "payload"."_verifications_v" USING btree ("version_created_at");
  CREATE INDEX "_verifications_v_created_at_idx" ON "payload"."_verifications_v" USING btree ("created_at");
  CREATE INDEX "_verifications_v_updated_at_idx" ON "payload"."_verifications_v" USING btree ("updated_at");
  CREATE INDEX "_passkeys_v_parent_idx" ON "payload"."_passkeys_v" USING btree ("parent_id");
  CREATE INDEX "_passkeys_v_version_version_user_idx" ON "payload"."_passkeys_v" USING btree ("version_user_id");
  CREATE INDEX "_passkeys_v_version_version_updated_at_idx" ON "payload"."_passkeys_v" USING btree ("version_updated_at");
  CREATE INDEX "_passkeys_v_version_version_created_at_idx" ON "payload"."_passkeys_v" USING btree ("version_created_at");
  CREATE INDEX "_passkeys_v_created_at_idx" ON "payload"."_passkeys_v" USING btree ("created_at");
  CREATE INDEX "_passkeys_v_updated_at_idx" ON "payload"."_passkeys_v" USING btree ("updated_at");
  CREATE INDEX "_two_factors_v_parent_idx" ON "payload"."_two_factors_v" USING btree ("parent_id");
  CREATE INDEX "_two_factors_v_version_version_user_idx" ON "payload"."_two_factors_v" USING btree ("version_user_id");
  CREATE INDEX "_two_factors_v_version_version_updated_at_idx" ON "payload"."_two_factors_v" USING btree ("version_updated_at");
  CREATE INDEX "_two_factors_v_version_version_created_at_idx" ON "payload"."_two_factors_v" USING btree ("version_created_at");
  CREATE INDEX "_two_factors_v_created_at_idx" ON "payload"."_two_factors_v" USING btree ("created_at");
  CREATE INDEX "_two_factors_v_updated_at_idx" ON "payload"."_two_factors_v" USING btree ("updated_at");
  CREATE INDEX "_device_codes_v_parent_idx" ON "payload"."_device_codes_v" USING btree ("parent_id");
  CREATE INDEX "_device_codes_v_version_version_updated_at_idx" ON "payload"."_device_codes_v" USING btree ("version_updated_at");
  CREATE INDEX "_device_codes_v_version_version_created_at_idx" ON "payload"."_device_codes_v" USING btree ("version_created_at");
  CREATE INDEX "_device_codes_v_created_at_idx" ON "payload"."_device_codes_v" USING btree ("created_at");
  CREATE INDEX "_device_codes_v_updated_at_idx" ON "payload"."_device_codes_v" USING btree ("updated_at");
  CREATE INDEX "version_deviceCode_idx" ON "payload"."_device_codes_v" USING btree ("version_device_code");
  CREATE INDEX "version_userCode_idx" ON "payload"."_device_codes_v" USING btree ("version_user_code");
  CREATE INDEX "_jwks_v_parent_idx" ON "payload"."_jwks_v" USING btree ("parent_id");
  CREATE INDEX "_jwks_v_version_version_updated_at_idx" ON "payload"."_jwks_v" USING btree ("version_updated_at");
  CREATE INDEX "_jwks_v_version_version_created_at_idx" ON "payload"."_jwks_v" USING btree ("version_created_at");
  CREATE INDEX "_jwks_v_created_at_idx" ON "payload"."_jwks_v" USING btree ("created_at");
  CREATE INDEX "_jwks_v_updated_at_idx" ON "payload"."_jwks_v" USING btree ("updated_at");
  CREATE INDEX "_oauth_clients_v_parent_idx" ON "payload"."_oauth_clients_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_clients_v_version_version_client_id_idx" ON "payload"."_oauth_clients_v" USING btree ("version_client_id");
  CREATE INDEX "_oauth_clients_v_version_version_user_idx" ON "payload"."_oauth_clients_v" USING btree ("version_user_id");
  CREATE INDEX "_oauth_clients_v_version_version_updated_at_idx" ON "payload"."_oauth_clients_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_clients_v_version_version_created_at_idx" ON "payload"."_oauth_clients_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_clients_v_created_at_idx" ON "payload"."_oauth_clients_v" USING btree ("created_at");
  CREATE INDEX "_oauth_clients_v_updated_at_idx" ON "payload"."_oauth_clients_v" USING btree ("updated_at");
  CREATE INDEX "_oauth_resources_v_parent_idx" ON "payload"."_oauth_resources_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_resources_v_version_version_identifier_idx" ON "payload"."_oauth_resources_v" USING btree ("version_identifier");
  CREATE INDEX "_oauth_resources_v_version_version_updated_at_idx" ON "payload"."_oauth_resources_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_resources_v_version_version_created_at_idx" ON "payload"."_oauth_resources_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_resources_v_created_at_idx" ON "payload"."_oauth_resources_v" USING btree ("created_at");
  CREATE INDEX "_oauth_resources_v_updated_at_idx" ON "payload"."_oauth_resources_v" USING btree ("updated_at");
  CREATE INDEX "_oauth_client_resources_v_parent_idx" ON "payload"."_oauth_client_resources_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_client_resources_v_version_version_updated_at_idx" ON "payload"."_oauth_client_resources_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_client_resources_v_version_version_created_at_idx" ON "payload"."_oauth_client_resources_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_client_resources_v_created_at_idx" ON "payload"."_oauth_client_resources_v" USING btree ("created_at");
  CREATE INDEX "_oauth_client_resources_v_updated_at_idx" ON "payload"."_oauth_client_resources_v" USING btree ("updated_at");
  CREATE INDEX "version_clientId_version_resourceId_idx" ON "payload"."_oauth_client_resources_v" USING btree ("version_client_id","version_resource_id");
  CREATE INDEX "_oauth_refresh_tokens_v_parent_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_refresh_tokens_v_version_version_token_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("version_token");
  CREATE INDEX "_oauth_refresh_tokens_v_version_version_session_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("version_session_id");
  CREATE INDEX "_oauth_refresh_tokens_v_version_version_user_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("version_user_id");
  CREATE INDEX "_oauth_refresh_tokens_v_version_version_updated_at_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_refresh_tokens_v_version_version_created_at_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_refresh_tokens_v_created_at_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("created_at");
  CREATE INDEX "_oauth_refresh_tokens_v_updated_at_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("updated_at");
  CREATE INDEX "_oauth_access_tokens_v_parent_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_access_tokens_v_version_version_token_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_token");
  CREATE INDEX "_oauth_access_tokens_v_version_version_session_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_session_id");
  CREATE INDEX "_oauth_access_tokens_v_version_version_user_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_user_id");
  CREATE INDEX "_oauth_access_tokens_v_version_version_refresh_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_refresh_id");
  CREATE INDEX "_oauth_access_tokens_v_version_version_updated_at_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_access_tokens_v_version_version_created_at_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_access_tokens_v_created_at_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("created_at");
  CREATE INDEX "_oauth_access_tokens_v_updated_at_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("updated_at");
  CREATE INDEX "_oauth_consents_v_parent_idx" ON "payload"."_oauth_consents_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_consents_v_version_version_user_idx" ON "payload"."_oauth_consents_v" USING btree ("version_user_id");
  CREATE INDEX "_oauth_consents_v_version_version_updated_at_idx" ON "payload"."_oauth_consents_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_consents_v_version_version_created_at_idx" ON "payload"."_oauth_consents_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_consents_v_created_at_idx" ON "payload"."_oauth_consents_v" USING btree ("created_at");
  CREATE INDEX "_oauth_consents_v_updated_at_idx" ON "payload"."_oauth_consents_v" USING btree ("updated_at");
  CREATE INDEX "_oauth_client_assertions_v_parent_idx" ON "payload"."_oauth_client_assertions_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_client_assertions_v_version_version_updated_at_idx" ON "payload"."_oauth_client_assertions_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_client_assertions_v_version_version_created_at_idx" ON "payload"."_oauth_client_assertions_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_client_assertions_v_created_at_idx" ON "payload"."_oauth_client_assertions_v" USING btree ("created_at");
  CREATE INDEX "_oauth_client_assertions_v_updated_at_idx" ON "payload"."_oauth_client_assertions_v" USING btree ("updated_at");
  CREATE INDEX "_rate_limits_v_parent_idx" ON "payload"."_rate_limits_v" USING btree ("parent_id");
  CREATE INDEX "_rate_limits_v_version_version_key_idx" ON "payload"."_rate_limits_v" USING btree ("version_key");
  CREATE INDEX "_rate_limits_v_version_version_updated_at_idx" ON "payload"."_rate_limits_v" USING btree ("version_updated_at");
  CREATE INDEX "_rate_limits_v_version_version_created_at_idx" ON "payload"."_rate_limits_v" USING btree ("version_created_at");
  CREATE INDEX "_rate_limits_v_created_at_idx" ON "payload"."_rate_limits_v" USING btree ("created_at");
  CREATE INDEX "_rate_limits_v_updated_at_idx" ON "payload"."_rate_limits_v" USING btree ("updated_at");
  ALTER TABLE "payload"."media" DROP COLUMN "original_filename";
  ALTER TABLE "payload"."media" DROP COLUMN "original_url";
  ALTER TABLE "payload"."media" DROP COLUMN "original_mime_type";
  ALTER TABLE "payload"."media" DROP COLUMN "original_filesize";
  ALTER TABLE "payload"."media" DROP COLUMN "original_width";
  ALTER TABLE "payload"."media" DROP COLUMN "original_height";
  ALTER TABLE "payload"."media" DROP COLUMN "original_prefix";
  ALTER TABLE "payload"."media" DROP COLUMN "original__objectkey";
  ALTER TABLE "payload"."_media_v" DROP COLUMN "version_original_filename";
  ALTER TABLE "payload"."_media_v" DROP COLUMN "version_original_url";
  ALTER TABLE "payload"."_media_v" DROP COLUMN "version_original_mime_type";
  ALTER TABLE "payload"."_media_v" DROP COLUMN "version_original_filesize";
  ALTER TABLE "payload"."_media_v" DROP COLUMN "version_original_width";
  ALTER TABLE "payload"."_media_v" DROP COLUMN "version_original_height";
  ALTER TABLE "payload"."_media_v" DROP COLUMN "version_original_prefix";
  ALTER TABLE "payload"."_media_v" DROP COLUMN "version_original__objectkey";
  ALTER TABLE "payload"."mon_models" DROP COLUMN "original_filename";
  ALTER TABLE "payload"."mon_models" DROP COLUMN "original_url";
  ALTER TABLE "payload"."mon_models" DROP COLUMN "original_mime_type";
  ALTER TABLE "payload"."mon_models" DROP COLUMN "original_filesize";
  ALTER TABLE "payload"."mon_models" DROP COLUMN "original_width";
  ALTER TABLE "payload"."mon_models" DROP COLUMN "original_height";
  ALTER TABLE "payload"."mon_models" DROP COLUMN "original_prefix";
  ALTER TABLE "payload"."mon_models" DROP COLUMN "original__objectkey";
  ALTER TABLE "payload"."_mon_models_v" DROP COLUMN "version_original_filename";
  ALTER TABLE "payload"."_mon_models_v" DROP COLUMN "version_original_url";
  ALTER TABLE "payload"."_mon_models_v" DROP COLUMN "version_original_mime_type";
  ALTER TABLE "payload"."_mon_models_v" DROP COLUMN "version_original_filesize";
  ALTER TABLE "payload"."_mon_models_v" DROP COLUMN "version_original_width";
  ALTER TABLE "payload"."_mon_models_v" DROP COLUMN "version_original_height";
  ALTER TABLE "payload"."_mon_models_v" DROP COLUMN "version_original_prefix";
  ALTER TABLE "payload"."_mon_models_v" DROP COLUMN "version_original__objectkey";
  DROP TYPE "payload"."enum_payload_llm_instructions_entity_type";`)
}
