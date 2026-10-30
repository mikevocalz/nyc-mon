// Auth version tables (_accounts_v, _sessions_v, _oauth_*_v, ...) are deliberately not dropped here:
// the better-auth adapter writes versioned rows to them even though the Payload snapshot omits them.
// migrate:create proposed dropping them; dropping them makes sign-in 500. Answer rename/none for them.
import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

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
