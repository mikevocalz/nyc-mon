import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_users_role" AS ENUM('user', 'ops', 'support', 'consent', 'content');
  CREATE TYPE "payload"."enum_users_consent_status" AS ENUM('not-required', 'pending', 'approved', 'denied');
  CREATE TYPE "payload"."enum_users_two_factor_otp_channel" AS ENUM('email', 'sms');
  CREATE TYPE "payload"."enum_users_deletion_reason" AS ENUM('support_request', 'parent_request', 'deletion_check', 'legal', 'caller_request', 'parent_withdrew', 'sent_in_error');
  CREATE TYPE "payload"."enum__users_v_version_role" AS ENUM('user', 'ops', 'support', 'consent', 'content');
  CREATE TYPE "payload"."enum__users_v_version_consent_status" AS ENUM('not-required', 'pending', 'approved', 'denied');
  CREATE TYPE "payload"."enum__users_v_version_two_factor_otp_channel" AS ENUM('email', 'sms');
  CREATE TYPE "payload"."enum__users_v_version_deletion_reason" AS ENUM('support_request', 'parent_request', 'deletion_check', 'legal', 'caller_request', 'parent_withdrew', 'sent_in_error');
  CREATE TYPE "payload"."enum_guardian_consents_status" AS ENUM('pending', 'approved', 'denied', 'expired');
  CREATE TYPE "payload"."enum_guardian_consents_parent_request" AS ENUM('none', 'review', 'delete');
  CREATE TYPE "payload"."enum__guardian_consents_v_version_status" AS ENUM('pending', 'approved', 'denied', 'expired');
  CREATE TYPE "payload"."enum__guardian_consents_v_version_parent_request" AS ENUM('none', 'review', 'delete');
  CREATE TYPE "payload"."enum_mon_instances_stage" AS ENUM('Baby', 'Small', 'Mid', 'Max');
  CREATE TYPE "payload"."enum__mon_instances_v_version_stage" AS ENUM('Baby', 'Small', 'Mid', 'Max');
  CREATE TYPE "payload"."enum_audit_events_action" AS ENUM('caller.value_shown', 'caller.deletion_scheduled', 'caller.deletion_cancelled', 'caller.deleted', 'caller.signed_out_everywhere', 'consent.email_sent', 'consent.approved', 'consent.denied', 'consent.expired', 'consent.deleted', 'integrity.check_run', 'staff.added', 'staff.role_changed', 'staff.removed', 'audit.exported', 'consent.requested', 'consent.value_shown', 'egg.value_shown', 'egg.caller_changed', 'mon.value_shown', 'mon.caller_changed');
  CREATE TYPE "payload"."enum_audit_events_target_type" AS ENUM('caller', 'consent', 'mon', 'egg', 'staff', 'audit', 'integrity');
  CREATE TYPE "payload"."enum_audit_events_reason_code" AS ENUM('support_request', 'parent_request', 'deletion_check', 'legal', 'caller_request', 'parent_withdrew', 'sent_in_error');
  CREATE TYPE "payload"."enum__audit_events_v_version_action" AS ENUM('caller.value_shown', 'caller.deletion_scheduled', 'caller.deletion_cancelled', 'caller.deleted', 'caller.signed_out_everywhere', 'consent.email_sent', 'consent.approved', 'consent.denied', 'consent.expired', 'consent.deleted', 'integrity.check_run', 'staff.added', 'staff.role_changed', 'staff.removed', 'audit.exported', 'consent.requested', 'consent.value_shown', 'egg.value_shown', 'egg.caller_changed', 'mon.value_shown', 'mon.caller_changed');
  CREATE TYPE "payload"."enum__audit_events_v_version_target_type" AS ENUM('caller', 'consent', 'mon', 'egg', 'staff', 'audit', 'integrity');
  CREATE TYPE "payload"."enum__audit_events_v_version_reason_code" AS ENUM('support_request', 'parent_request', 'deletion_check', 'legal', 'caller_request', 'parent_withdrew', 'sent_in_error');
  CREATE TYPE "payload"."enum_integrity_runs_trigger" AS ENUM('manual', 'scheduled');
  CREATE TYPE "payload"."enum__integrity_runs_v_version_trigger" AS ENUM('manual', 'scheduled');
  CREATE TYPE "payload"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'delete-due-callers');
  CREATE TYPE "payload"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "payload"."enum_payload_jobs_log_parent_task_slug" AS ENUM('inline', 'delete-due-callers');
  CREATE TYPE "payload"."enum_payload_jobs_task_slug" AS ENUM('inline', 'delete-due-callers');
  CREATE TABLE "payload"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"email_verified" boolean DEFAULT false,
  	"name" varchar,
  	"image" varchar,
  	"role" "payload"."enum_users_role" DEFAULT 'user',
  	"birth_year" numeric,
  	"consent_status" "payload"."enum_users_consent_status" DEFAULT 'not-required',
  	"phone_consent_at" timestamp(3) with time zone,
  	"two_factor_enabled" boolean DEFAULT false,
  	"two_factor_otp_channel" "payload"."enum_users_two_factor_otp_channel" DEFAULT 'email',
  	"phone_number" varchar,
  	"phone_number_verified" boolean DEFAULT false,
  	"username" varchar,
  	"display_username" varchar,
  	"active_mon_instance_id" varchar,
  	"deletion_scheduled_for" timestamp(3) with time zone,
  	"deletion_scheduled_by_id" integer,
  	"deletion_reason" "payload"."enum_users_deletion_reason",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_users_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_email" varchar NOT NULL,
  	"version_email_verified" boolean DEFAULT false,
  	"version_name" varchar,
  	"version_image" varchar,
  	"version_role" "payload"."enum__users_v_version_role" DEFAULT 'user',
  	"version_birth_year" numeric,
  	"version_consent_status" "payload"."enum__users_v_version_consent_status" DEFAULT 'not-required',
  	"version_phone_consent_at" timestamp(3) with time zone,
  	"version_two_factor_enabled" boolean DEFAULT false,
  	"version_two_factor_otp_channel" "payload"."enum__users_v_version_two_factor_otp_channel" DEFAULT 'email',
  	"version_phone_number" varchar,
  	"version_phone_number_verified" boolean DEFAULT false,
  	"version_username" varchar,
  	"version_display_username" varchar,
  	"version_active_mon_instance_id" varchar,
  	"version_deletion_scheduled_for" timestamp(3) with time zone,
  	"version_deletion_scheduled_by_id" integer,
  	"version_deletion_reason" "payload"."enum__users_v_version_deletion_reason",
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "payload"."_media_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_alt" varchar NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_url" varchar,
  	"version_thumbnail_u_r_l" varchar,
  	"version_filename" varchar,
  	"version_mime_type" varchar,
  	"version_filesize" numeric,
  	"version_width" numeric,
  	"version_height" numeric,
  	"version_focal_x" numeric,
  	"version_focal_y" numeric,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."guardian_consents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_email" varchar NOT NULL,
  	"birth_year" numeric NOT NULL,
  	"status" "payload"."enum_guardian_consents_status" DEFAULT 'pending' NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"emails_sent" numeric DEFAULT 0 NOT NULL,
  	"last_email_sent_at" timestamp(3) with time zone,
  	"parent_request" "payload"."enum_guardian_consents_parent_request" DEFAULT 'none' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_guardian_consents_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_parent_email" varchar NOT NULL,
  	"version_birth_year" numeric NOT NULL,
  	"version_status" "payload"."enum__guardian_consents_v_version_status" DEFAULT 'pending' NOT NULL,
  	"version_expires_at" timestamp(3) with time zone NOT NULL,
  	"version_emails_sent" numeric DEFAULT 0 NOT NULL,
  	"version_last_email_sent_at" timestamp(3) with time zone,
  	"version_parent_request" "payload"."enum__guardian_consents_v_version_parent_request" DEFAULT 'none' NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."eggs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"egg_id" varchar NOT NULL,
  	"mon_instance_id" varchar NOT NULL,
  	"species_id" varchar NOT NULL,
  	"hatches_into_species_id" varchar NOT NULL,
  	"caller_id" varchar NOT NULL,
  	"nickname" varchar,
  	"incubation_minutes" numeric NOT NULL,
  	"created_at_ms" numeric NOT NULL,
  	"incubation_ends_at" numeric NOT NULL,
  	"hatched" boolean DEFAULT false NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_eggs_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_egg_id" varchar NOT NULL,
  	"version_mon_instance_id" varchar NOT NULL,
  	"version_species_id" varchar NOT NULL,
  	"version_hatches_into_species_id" varchar NOT NULL,
  	"version_caller_id" varchar NOT NULL,
  	"version_nickname" varchar,
  	"version_incubation_minutes" numeric NOT NULL,
  	"version_created_at_ms" numeric NOT NULL,
  	"version_incubation_ends_at" numeric NOT NULL,
  	"version_hatched" boolean DEFAULT false NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."mon_instances" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"mon_instance_id" varchar NOT NULL,
  	"egg_id" varchar NOT NULL,
  	"species_id" varchar NOT NULL,
  	"nickname" varchar,
  	"caller_id" varchar NOT NULL,
  	"hatched_at" numeric NOT NULL,
  	"bond" numeric NOT NULL,
  	"stage" "payload"."enum_mon_instances_stage" NOT NULL,
  	"voice_lineage_id" varchar,
  	"server_confirmed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_mon_instances_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_mon_instance_id" varchar NOT NULL,
  	"version_egg_id" varchar NOT NULL,
  	"version_species_id" varchar NOT NULL,
  	"version_nickname" varchar,
  	"version_caller_id" varchar NOT NULL,
  	"version_hatched_at" numeric NOT NULL,
  	"version_bond" numeric NOT NULL,
  	"version_stage" "payload"."enum__mon_instances_v_version_stage" NOT NULL,
  	"version_voice_lineage_id" varchar,
  	"version_server_confirmed_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."care_states" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"mon_instance_id" varchar NOT NULL,
  	"energy" numeric NOT NULL,
  	"fullness" numeric NOT NULL,
  	"social" numeric NOT NULL,
  	"updated_at_ms" numeric NOT NULL,
  	"last_fed_at" numeric,
  	"last_rested_at" numeric,
  	"last_social_at" numeric,
  	"activity" jsonb NOT NULL,
  	"sluggish_until" numeric,
  	"pending_request" jsonb,
  	"last_seq_by_device" jsonb DEFAULT '{}'::jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_care_states_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_mon_instance_id" varchar NOT NULL,
  	"version_energy" numeric NOT NULL,
  	"version_fullness" numeric NOT NULL,
  	"version_social" numeric NOT NULL,
  	"version_updated_at_ms" numeric NOT NULL,
  	"version_last_fed_at" numeric,
  	"version_last_rested_at" numeric,
  	"version_last_social_at" numeric,
  	"version_activity" jsonb NOT NULL,
  	"version_sluggish_until" numeric,
  	"version_pending_request" jsonb,
  	"version_last_seq_by_device" jsonb DEFAULT '{}'::jsonb NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."audit_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"actor_id" integer,
  	"actor_role" varchar NOT NULL,
  	"action" "payload"."enum_audit_events_action" NOT NULL,
  	"target_type" "payload"."enum_audit_events_target_type" NOT NULL,
  	"target_id" varchar NOT NULL,
  	"reason_code" "payload"."enum_audit_events_reason_code",
  	"request_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_audit_events_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_at" timestamp(3) with time zone NOT NULL,
  	"version_actor_id" integer,
  	"version_actor_role" varchar NOT NULL,
  	"version_action" "payload"."enum__audit_events_v_version_action" NOT NULL,
  	"version_target_type" "payload"."enum__audit_events_v_version_target_type" NOT NULL,
  	"version_target_id" varchar NOT NULL,
  	"version_reason_code" "payload"."enum__audit_events_v_version_reason_code",
  	"version_request_id" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."integrity_runs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"trigger" "payload"."enum_integrity_runs_trigger" NOT NULL,
  	"actor_id" integer,
  	"shared_egg" numeric NOT NULL,
  	"id_mismatch" numeric NOT NULL,
  	"orphans" numeric NOT NULL,
  	"stale_ready" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_integrity_runs_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_at" timestamp(3) with time zone NOT NULL,
  	"version_trigger" "payload"."enum__integrity_runs_v_version_trigger" NOT NULL,
  	"version_actor_id" integer,
  	"version_shared_egg" numeric NOT NULL,
  	"version_id_mismatch" numeric NOT NULL,
  	"version_orphans" numeric NOT NULL,
  	"version_stale_ready" numeric NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"token" varchar NOT NULL,
  	"ip_address" varchar,
  	"user_agent" varchar,
  	"user_id" integer NOT NULL,
  	"surface" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
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
  
  CREATE TABLE "payload"."accounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" varchar NOT NULL,
  	"provider_id" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"access_token" varchar,
  	"refresh_token" varchar,
  	"id_token" varchar,
  	"access_token_expires_at" timestamp(3) with time zone,
  	"refresh_token_expires_at" timestamp(3) with time zone,
  	"scope" varchar,
  	"password" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."verifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"identifier" varchar NOT NULL,
  	"value" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."passkeys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"public_key" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"credential_i_d" varchar NOT NULL,
  	"counter" numeric NOT NULL,
  	"device_type" varchar NOT NULL,
  	"backed_up" boolean DEFAULT false NOT NULL,
  	"transports" varchar,
  	"aaguid" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."two_factors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"secret" varchar NOT NULL,
  	"backup_codes" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"verified" boolean DEFAULT true,
  	"failed_verification_count" numeric DEFAULT 0,
  	"locked_until" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."device_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"device_code" varchar NOT NULL,
  	"user_code" varchar NOT NULL,
  	"user_id" varchar,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"status" varchar NOT NULL,
  	"last_polled_at" timestamp(3) with time zone,
  	"polling_interval" numeric,
  	"client_id" varchar,
  	"scope" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."rate_limits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"count" numeric NOT NULL,
  	"last_request" numeric DEFAULT 1791149819909 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_rate_limits_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" varchar NOT NULL,
  	"version_count" numeric NOT NULL,
  	"version_last_request" numeric DEFAULT 1791149819909 NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload"."payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "payload"."enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb NOT NULL,
  	"output" jsonb,
  	"state" "payload"."enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb,
  	"parent_task_slug" "payload"."enum_payload_jobs_log_parent_task_slug",
  	"parent_task_i_d" varchar
  );
  
  CREATE TABLE "payload"."payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"meta" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "payload"."enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing_until" timestamp(3) with time zone,
  	"processing_token" varchar,
  	"concurrency_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"guardian_consents_id" integer,
  	"eggs_id" integer,
  	"mon_instances_id" integer,
  	"care_states_id" integer,
  	"audit_events_id" integer,
  	"integrity_runs_id" integer,
  	"sessions_id" integer,
  	"accounts_id" integer,
  	"verifications_id" integer,
  	"passkeys_id" integer,
  	"two_factors_id" integer,
  	"device_codes_id" integer,
  	"rate_limits_id" integer
  );
  
  CREATE TABLE "payload"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_jobs_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload"."users" ADD CONSTRAINT "users_deletion_scheduled_by_id_users_id_fk" FOREIGN KEY ("deletion_scheduled_by_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_users_v" ADD CONSTRAINT "_users_v_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_users_v" ADD CONSTRAINT "_users_v_version_deletion_scheduled_by_id_users_id_fk" FOREIGN KEY ("version_deletion_scheduled_by_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_media_v" ADD CONSTRAINT "_media_v_parent_id_media_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_guardian_consents_v" ADD CONSTRAINT "_guardian_consents_v_parent_id_guardian_consents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."guardian_consents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_eggs_v" ADD CONSTRAINT "_eggs_v_parent_id_eggs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."eggs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_mon_instances_v" ADD CONSTRAINT "_mon_instances_v_parent_id_mon_instances_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."mon_instances"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_care_states_v" ADD CONSTRAINT "_care_states_v_parent_id_care_states_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."care_states"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_audit_events_v" ADD CONSTRAINT "_audit_events_v_parent_id_audit_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."audit_events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_audit_events_v" ADD CONSTRAINT "_audit_events_v_version_actor_id_users_id_fk" FOREIGN KEY ("version_actor_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."integrity_runs" ADD CONSTRAINT "integrity_runs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_integrity_runs_v" ADD CONSTRAINT "_integrity_runs_v_parent_id_integrity_runs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."integrity_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_integrity_runs_v" ADD CONSTRAINT "_integrity_runs_v_version_actor_id_users_id_fk" FOREIGN KEY ("version_actor_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_sessions_v" ADD CONSTRAINT "_sessions_v_parent_id_sessions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_sessions_v" ADD CONSTRAINT "_sessions_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_accounts_v" ADD CONSTRAINT "_accounts_v_parent_id_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_accounts_v" ADD CONSTRAINT "_accounts_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_verifications_v" ADD CONSTRAINT "_verifications_v_parent_id_verifications_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."verifications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_passkeys_v" ADD CONSTRAINT "_passkeys_v_parent_id_passkeys_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."passkeys"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_passkeys_v" ADD CONSTRAINT "_passkeys_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_two_factors_v" ADD CONSTRAINT "_two_factors_v_parent_id_two_factors_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."two_factors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_two_factors_v" ADD CONSTRAINT "_two_factors_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_device_codes_v" ADD CONSTRAINT "_device_codes_v_parent_id_device_codes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."device_codes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_rate_limits_v" ADD CONSTRAINT "_rate_limits_v_parent_id_rate_limits_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."rate_limits"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_guardian_consents_fk" FOREIGN KEY ("guardian_consents_id") REFERENCES "payload"."guardian_consents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_eggs_fk" FOREIGN KEY ("eggs_id") REFERENCES "payload"."eggs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mon_instances_fk" FOREIGN KEY ("mon_instances_id") REFERENCES "payload"."mon_instances"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_care_states_fk" FOREIGN KEY ("care_states_id") REFERENCES "payload"."care_states"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_events_fk" FOREIGN KEY ("audit_events_id") REFERENCES "payload"."audit_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_integrity_runs_fk" FOREIGN KEY ("integrity_runs_id") REFERENCES "payload"."integrity_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk" FOREIGN KEY ("sessions_id") REFERENCES "payload"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_accounts_fk" FOREIGN KEY ("accounts_id") REFERENCES "payload"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_verifications_fk" FOREIGN KEY ("verifications_id") REFERENCES "payload"."verifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_passkeys_fk" FOREIGN KEY ("passkeys_id") REFERENCES "payload"."passkeys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_two_factors_fk" FOREIGN KEY ("two_factors_id") REFERENCES "payload"."two_factors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_device_codes_fk" FOREIGN KEY ("device_codes_id") REFERENCES "payload"."device_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rate_limits_fk" FOREIGN KEY ("rate_limits_id") REFERENCES "payload"."rate_limits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "users_email_idx" ON "payload"."users" USING btree ("email");
  CREATE UNIQUE INDEX "users_phone_number_idx" ON "payload"."users" USING btree ("phone_number");
  CREATE UNIQUE INDEX "users_username_idx" ON "payload"."users" USING btree ("username");
  CREATE INDEX "users_deletion_scheduled_for_idx" ON "payload"."users" USING btree ("deletion_scheduled_for");
  CREATE INDEX "users_deletion_scheduled_by_idx" ON "payload"."users" USING btree ("deletion_scheduled_by_id");
  CREATE INDEX "users_updated_at_idx" ON "payload"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "payload"."users" USING btree ("created_at");
  CREATE INDEX "_users_v_parent_idx" ON "payload"."_users_v" USING btree ("parent_id");
  CREATE INDEX "_users_v_version_version_email_idx" ON "payload"."_users_v" USING btree ("version_email");
  CREATE INDEX "_users_v_version_version_phone_number_idx" ON "payload"."_users_v" USING btree ("version_phone_number");
  CREATE INDEX "_users_v_version_version_username_idx" ON "payload"."_users_v" USING btree ("version_username");
  CREATE INDEX "_users_v_version_version_deletion_scheduled_for_idx" ON "payload"."_users_v" USING btree ("version_deletion_scheduled_for");
  CREATE INDEX "_users_v_version_version_deletion_scheduled_by_idx" ON "payload"."_users_v" USING btree ("version_deletion_scheduled_by_id");
  CREATE INDEX "_users_v_version_version_updated_at_idx" ON "payload"."_users_v" USING btree ("version_updated_at");
  CREATE INDEX "_users_v_version_version_created_at_idx" ON "payload"."_users_v" USING btree ("version_created_at");
  CREATE INDEX "_users_v_created_at_idx" ON "payload"."_users_v" USING btree ("created_at");
  CREATE INDEX "_users_v_updated_at_idx" ON "payload"."_users_v" USING btree ("updated_at");
  CREATE INDEX "media_updated_at_idx" ON "payload"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "payload"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "payload"."media" USING btree ("filename");
  CREATE INDEX "_media_v_parent_idx" ON "payload"."_media_v" USING btree ("parent_id");
  CREATE INDEX "_media_v_version_version_updated_at_idx" ON "payload"."_media_v" USING btree ("version_updated_at");
  CREATE INDEX "_media_v_version_version_created_at_idx" ON "payload"."_media_v" USING btree ("version_created_at");
  CREATE INDEX "_media_v_version_version_filename_idx" ON "payload"."_media_v" USING btree ("version_filename");
  CREATE INDEX "_media_v_created_at_idx" ON "payload"."_media_v" USING btree ("created_at");
  CREATE INDEX "_media_v_updated_at_idx" ON "payload"."_media_v" USING btree ("updated_at");
  CREATE INDEX "guardian_consents_updated_at_idx" ON "payload"."guardian_consents" USING btree ("updated_at");
  CREATE INDEX "guardian_consents_created_at_idx" ON "payload"."guardian_consents" USING btree ("created_at");
  CREATE INDEX "status_expiresAt_idx" ON "payload"."guardian_consents" USING btree ("status","expires_at");
  CREATE INDEX "_guardian_consents_v_parent_idx" ON "payload"."_guardian_consents_v" USING btree ("parent_id");
  CREATE INDEX "_guardian_consents_v_version_version_updated_at_idx" ON "payload"."_guardian_consents_v" USING btree ("version_updated_at");
  CREATE INDEX "_guardian_consents_v_version_version_created_at_idx" ON "payload"."_guardian_consents_v" USING btree ("version_created_at");
  CREATE INDEX "_guardian_consents_v_created_at_idx" ON "payload"."_guardian_consents_v" USING btree ("created_at");
  CREATE INDEX "_guardian_consents_v_updated_at_idx" ON "payload"."_guardian_consents_v" USING btree ("updated_at");
  CREATE INDEX "version_status_version_expiresAt_idx" ON "payload"."_guardian_consents_v" USING btree ("version_status","version_expires_at");
  CREATE UNIQUE INDEX "eggs_egg_id_idx" ON "payload"."eggs" USING btree ("egg_id");
  CREATE UNIQUE INDEX "eggs_mon_instance_id_idx" ON "payload"."eggs" USING btree ("mon_instance_id");
  CREATE INDEX "eggs_caller_id_idx" ON "payload"."eggs" USING btree ("caller_id");
  CREATE INDEX "eggs_incubation_ends_at_idx" ON "payload"."eggs" USING btree ("incubation_ends_at");
  CREATE INDEX "eggs_hatched_idx" ON "payload"."eggs" USING btree ("hatched");
  CREATE INDEX "eggs_updated_at_idx" ON "payload"."eggs" USING btree ("updated_at");
  CREATE INDEX "eggs_created_at_idx" ON "payload"."eggs" USING btree ("created_at");
  CREATE INDEX "_eggs_v_parent_idx" ON "payload"."_eggs_v" USING btree ("parent_id");
  CREATE INDEX "_eggs_v_version_version_egg_id_idx" ON "payload"."_eggs_v" USING btree ("version_egg_id");
  CREATE INDEX "_eggs_v_version_version_mon_instance_id_idx" ON "payload"."_eggs_v" USING btree ("version_mon_instance_id");
  CREATE INDEX "_eggs_v_version_version_caller_id_idx" ON "payload"."_eggs_v" USING btree ("version_caller_id");
  CREATE INDEX "_eggs_v_version_version_incubation_ends_at_idx" ON "payload"."_eggs_v" USING btree ("version_incubation_ends_at");
  CREATE INDEX "_eggs_v_version_version_hatched_idx" ON "payload"."_eggs_v" USING btree ("version_hatched");
  CREATE INDEX "_eggs_v_version_version_updated_at_idx" ON "payload"."_eggs_v" USING btree ("version_updated_at");
  CREATE INDEX "_eggs_v_version_version_created_at_idx" ON "payload"."_eggs_v" USING btree ("version_created_at");
  CREATE INDEX "_eggs_v_created_at_idx" ON "payload"."_eggs_v" USING btree ("created_at");
  CREATE INDEX "_eggs_v_updated_at_idx" ON "payload"."_eggs_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "mon_instances_mon_instance_id_idx" ON "payload"."mon_instances" USING btree ("mon_instance_id");
  CREATE UNIQUE INDEX "mon_instances_egg_id_idx" ON "payload"."mon_instances" USING btree ("egg_id");
  CREATE INDEX "mon_instances_caller_id_idx" ON "payload"."mon_instances" USING btree ("caller_id");
  CREATE INDEX "mon_instances_updated_at_idx" ON "payload"."mon_instances" USING btree ("updated_at");
  CREATE INDEX "mon_instances_created_at_idx" ON "payload"."mon_instances" USING btree ("created_at");
  CREATE UNIQUE INDEX "monInstanceId_eggId_idx" ON "payload"."mon_instances" USING btree ("mon_instance_id","egg_id");
  CREATE INDEX "_mon_instances_v_parent_idx" ON "payload"."_mon_instances_v" USING btree ("parent_id");
  CREATE INDEX "_mon_instances_v_version_version_mon_instance_id_idx" ON "payload"."_mon_instances_v" USING btree ("version_mon_instance_id");
  CREATE INDEX "_mon_instances_v_version_version_egg_id_idx" ON "payload"."_mon_instances_v" USING btree ("version_egg_id");
  CREATE INDEX "_mon_instances_v_version_version_caller_id_idx" ON "payload"."_mon_instances_v" USING btree ("version_caller_id");
  CREATE INDEX "_mon_instances_v_version_version_updated_at_idx" ON "payload"."_mon_instances_v" USING btree ("version_updated_at");
  CREATE INDEX "_mon_instances_v_version_version_created_at_idx" ON "payload"."_mon_instances_v" USING btree ("version_created_at");
  CREATE INDEX "_mon_instances_v_created_at_idx" ON "payload"."_mon_instances_v" USING btree ("created_at");
  CREATE INDEX "_mon_instances_v_updated_at_idx" ON "payload"."_mon_instances_v" USING btree ("updated_at");
  CREATE INDEX "version_monInstanceId_version_eggId_idx" ON "payload"."_mon_instances_v" USING btree ("version_mon_instance_id","version_egg_id");
  CREATE UNIQUE INDEX "care_states_mon_instance_id_idx" ON "payload"."care_states" USING btree ("mon_instance_id");
  CREATE INDEX "care_states_updated_at_idx" ON "payload"."care_states" USING btree ("updated_at");
  CREATE INDEX "care_states_created_at_idx" ON "payload"."care_states" USING btree ("created_at");
  CREATE INDEX "_care_states_v_parent_idx" ON "payload"."_care_states_v" USING btree ("parent_id");
  CREATE INDEX "_care_states_v_version_version_mon_instance_id_idx" ON "payload"."_care_states_v" USING btree ("version_mon_instance_id");
  CREATE INDEX "_care_states_v_version_version_updated_at_idx" ON "payload"."_care_states_v" USING btree ("version_updated_at");
  CREATE INDEX "_care_states_v_version_version_created_at_idx" ON "payload"."_care_states_v" USING btree ("version_created_at");
  CREATE INDEX "_care_states_v_created_at_idx" ON "payload"."_care_states_v" USING btree ("created_at");
  CREATE INDEX "_care_states_v_updated_at_idx" ON "payload"."_care_states_v" USING btree ("updated_at");
  CREATE INDEX "audit_events_at_idx" ON "payload"."audit_events" USING btree ("at");
  CREATE INDEX "audit_events_actor_idx" ON "payload"."audit_events" USING btree ("actor_id");
  CREATE INDEX "audit_events_action_idx" ON "payload"."audit_events" USING btree ("action");
  CREATE INDEX "audit_events_target_id_idx" ON "payload"."audit_events" USING btree ("target_id");
  CREATE INDEX "audit_events_updated_at_idx" ON "payload"."audit_events" USING btree ("updated_at");
  CREATE INDEX "audit_events_created_at_idx" ON "payload"."audit_events" USING btree ("created_at");
  CREATE INDEX "_audit_events_v_parent_idx" ON "payload"."_audit_events_v" USING btree ("parent_id");
  CREATE INDEX "_audit_events_v_version_version_at_idx" ON "payload"."_audit_events_v" USING btree ("version_at");
  CREATE INDEX "_audit_events_v_version_version_actor_idx" ON "payload"."_audit_events_v" USING btree ("version_actor_id");
  CREATE INDEX "_audit_events_v_version_version_action_idx" ON "payload"."_audit_events_v" USING btree ("version_action");
  CREATE INDEX "_audit_events_v_version_version_target_id_idx" ON "payload"."_audit_events_v" USING btree ("version_target_id");
  CREATE INDEX "_audit_events_v_version_version_updated_at_idx" ON "payload"."_audit_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_audit_events_v_version_version_created_at_idx" ON "payload"."_audit_events_v" USING btree ("version_created_at");
  CREATE INDEX "_audit_events_v_created_at_idx" ON "payload"."_audit_events_v" USING btree ("created_at");
  CREATE INDEX "_audit_events_v_updated_at_idx" ON "payload"."_audit_events_v" USING btree ("updated_at");
  CREATE INDEX "integrity_runs_at_idx" ON "payload"."integrity_runs" USING btree ("at");
  CREATE INDEX "integrity_runs_actor_idx" ON "payload"."integrity_runs" USING btree ("actor_id");
  CREATE INDEX "integrity_runs_updated_at_idx" ON "payload"."integrity_runs" USING btree ("updated_at");
  CREATE INDEX "integrity_runs_created_at_idx" ON "payload"."integrity_runs" USING btree ("created_at");
  CREATE INDEX "_integrity_runs_v_parent_idx" ON "payload"."_integrity_runs_v" USING btree ("parent_id");
  CREATE INDEX "_integrity_runs_v_version_version_at_idx" ON "payload"."_integrity_runs_v" USING btree ("version_at");
  CREATE INDEX "_integrity_runs_v_version_version_actor_idx" ON "payload"."_integrity_runs_v" USING btree ("version_actor_id");
  CREATE INDEX "_integrity_runs_v_version_version_updated_at_idx" ON "payload"."_integrity_runs_v" USING btree ("version_updated_at");
  CREATE INDEX "_integrity_runs_v_version_version_created_at_idx" ON "payload"."_integrity_runs_v" USING btree ("version_created_at");
  CREATE INDEX "_integrity_runs_v_created_at_idx" ON "payload"."_integrity_runs_v" USING btree ("created_at");
  CREATE INDEX "_integrity_runs_v_updated_at_idx" ON "payload"."_integrity_runs_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "sessions_token_idx" ON "payload"."sessions" USING btree ("token");
  CREATE INDEX "sessions_user_idx" ON "payload"."sessions" USING btree ("user_id");
  CREATE INDEX "sessions_updated_at_idx" ON "payload"."sessions" USING btree ("updated_at");
  CREATE INDEX "sessions_created_at_idx" ON "payload"."sessions" USING btree ("created_at");
  CREATE INDEX "_sessions_v_parent_idx" ON "payload"."_sessions_v" USING btree ("parent_id");
  CREATE INDEX "_sessions_v_version_version_token_idx" ON "payload"."_sessions_v" USING btree ("version_token");
  CREATE INDEX "_sessions_v_version_version_user_idx" ON "payload"."_sessions_v" USING btree ("version_user_id");
  CREATE INDEX "_sessions_v_version_version_updated_at_idx" ON "payload"."_sessions_v" USING btree ("version_updated_at");
  CREATE INDEX "_sessions_v_version_version_created_at_idx" ON "payload"."_sessions_v" USING btree ("version_created_at");
  CREATE INDEX "_sessions_v_created_at_idx" ON "payload"."_sessions_v" USING btree ("created_at");
  CREATE INDEX "_sessions_v_updated_at_idx" ON "payload"."_sessions_v" USING btree ("updated_at");
  CREATE INDEX "accounts_user_idx" ON "payload"."accounts" USING btree ("user_id");
  CREATE INDEX "accounts_updated_at_idx" ON "payload"."accounts" USING btree ("updated_at");
  CREATE INDEX "accounts_created_at_idx" ON "payload"."accounts" USING btree ("created_at");
  CREATE INDEX "_accounts_v_parent_idx" ON "payload"."_accounts_v" USING btree ("parent_id");
  CREATE INDEX "_accounts_v_version_version_user_idx" ON "payload"."_accounts_v" USING btree ("version_user_id");
  CREATE INDEX "_accounts_v_version_version_updated_at_idx" ON "payload"."_accounts_v" USING btree ("version_updated_at");
  CREATE INDEX "_accounts_v_version_version_created_at_idx" ON "payload"."_accounts_v" USING btree ("version_created_at");
  CREATE INDEX "_accounts_v_created_at_idx" ON "payload"."_accounts_v" USING btree ("created_at");
  CREATE INDEX "_accounts_v_updated_at_idx" ON "payload"."_accounts_v" USING btree ("updated_at");
  CREATE INDEX "verifications_updated_at_idx" ON "payload"."verifications" USING btree ("updated_at");
  CREATE INDEX "verifications_created_at_idx" ON "payload"."verifications" USING btree ("created_at");
  CREATE INDEX "_verifications_v_parent_idx" ON "payload"."_verifications_v" USING btree ("parent_id");
  CREATE INDEX "_verifications_v_version_version_updated_at_idx" ON "payload"."_verifications_v" USING btree ("version_updated_at");
  CREATE INDEX "_verifications_v_version_version_created_at_idx" ON "payload"."_verifications_v" USING btree ("version_created_at");
  CREATE INDEX "_verifications_v_created_at_idx" ON "payload"."_verifications_v" USING btree ("created_at");
  CREATE INDEX "_verifications_v_updated_at_idx" ON "payload"."_verifications_v" USING btree ("updated_at");
  CREATE INDEX "passkeys_user_idx" ON "payload"."passkeys" USING btree ("user_id");
  CREATE INDEX "passkeys_updated_at_idx" ON "payload"."passkeys" USING btree ("updated_at");
  CREATE INDEX "passkeys_created_at_idx" ON "payload"."passkeys" USING btree ("created_at");
  CREATE INDEX "_passkeys_v_parent_idx" ON "payload"."_passkeys_v" USING btree ("parent_id");
  CREATE INDEX "_passkeys_v_version_version_user_idx" ON "payload"."_passkeys_v" USING btree ("version_user_id");
  CREATE INDEX "_passkeys_v_version_version_updated_at_idx" ON "payload"."_passkeys_v" USING btree ("version_updated_at");
  CREATE INDEX "_passkeys_v_version_version_created_at_idx" ON "payload"."_passkeys_v" USING btree ("version_created_at");
  CREATE INDEX "_passkeys_v_created_at_idx" ON "payload"."_passkeys_v" USING btree ("created_at");
  CREATE INDEX "_passkeys_v_updated_at_idx" ON "payload"."_passkeys_v" USING btree ("updated_at");
  CREATE INDEX "two_factors_user_idx" ON "payload"."two_factors" USING btree ("user_id");
  CREATE INDEX "two_factors_updated_at_idx" ON "payload"."two_factors" USING btree ("updated_at");
  CREATE INDEX "two_factors_created_at_idx" ON "payload"."two_factors" USING btree ("created_at");
  CREATE INDEX "_two_factors_v_parent_idx" ON "payload"."_two_factors_v" USING btree ("parent_id");
  CREATE INDEX "_two_factors_v_version_version_user_idx" ON "payload"."_two_factors_v" USING btree ("version_user_id");
  CREATE INDEX "_two_factors_v_version_version_updated_at_idx" ON "payload"."_two_factors_v" USING btree ("version_updated_at");
  CREATE INDEX "_two_factors_v_version_version_created_at_idx" ON "payload"."_two_factors_v" USING btree ("version_created_at");
  CREATE INDEX "_two_factors_v_created_at_idx" ON "payload"."_two_factors_v" USING btree ("created_at");
  CREATE INDEX "_two_factors_v_updated_at_idx" ON "payload"."_two_factors_v" USING btree ("updated_at");
  CREATE INDEX "device_codes_updated_at_idx" ON "payload"."device_codes" USING btree ("updated_at");
  CREATE INDEX "device_codes_created_at_idx" ON "payload"."device_codes" USING btree ("created_at");
  CREATE UNIQUE INDEX "deviceCode_idx" ON "payload"."device_codes" USING btree ("device_code");
  CREATE UNIQUE INDEX "userCode_idx" ON "payload"."device_codes" USING btree ("user_code");
  CREATE INDEX "_device_codes_v_parent_idx" ON "payload"."_device_codes_v" USING btree ("parent_id");
  CREATE INDEX "_device_codes_v_version_version_updated_at_idx" ON "payload"."_device_codes_v" USING btree ("version_updated_at");
  CREATE INDEX "_device_codes_v_version_version_created_at_idx" ON "payload"."_device_codes_v" USING btree ("version_created_at");
  CREATE INDEX "_device_codes_v_created_at_idx" ON "payload"."_device_codes_v" USING btree ("created_at");
  CREATE INDEX "_device_codes_v_updated_at_idx" ON "payload"."_device_codes_v" USING btree ("updated_at");
  CREATE INDEX "version_deviceCode_idx" ON "payload"."_device_codes_v" USING btree ("version_device_code");
  CREATE INDEX "version_userCode_idx" ON "payload"."_device_codes_v" USING btree ("version_user_code");
  CREATE UNIQUE INDEX "rate_limits_key_idx" ON "payload"."rate_limits" USING btree ("key");
  CREATE INDEX "rate_limits_updated_at_idx" ON "payload"."rate_limits" USING btree ("updated_at");
  CREATE INDEX "rate_limits_created_at_idx" ON "payload"."rate_limits" USING btree ("created_at");
  CREATE INDEX "_rate_limits_v_parent_idx" ON "payload"."_rate_limits_v" USING btree ("parent_id");
  CREATE INDEX "_rate_limits_v_version_version_key_idx" ON "payload"."_rate_limits_v" USING btree ("version_key");
  CREATE INDEX "_rate_limits_v_version_version_updated_at_idx" ON "payload"."_rate_limits_v" USING btree ("version_updated_at");
  CREATE INDEX "_rate_limits_v_version_version_created_at_idx" ON "payload"."_rate_limits_v" USING btree ("version_created_at");
  CREATE INDEX "_rate_limits_v_created_at_idx" ON "payload"."_rate_limits_v" USING btree ("created_at");
  CREATE INDEX "_rate_limits_v_updated_at_idx" ON "payload"."_rate_limits_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload"."payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload"."payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload"."payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload"."payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload"."payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload"."payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload"."payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload"."payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_until_idx" ON "payload"."payload_jobs" USING btree ("processing_until");
  CREATE INDEX "payload_jobs_concurrency_key_idx" ON "payload"."payload_jobs" USING btree ("concurrency_key");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload"."payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload"."payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_guardian_consents_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("guardian_consents_id");
  CREATE INDEX "payload_locked_documents_rels_eggs_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("eggs_id");
  CREATE INDEX "payload_locked_documents_rels_mon_instances_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("mon_instances_id");
  CREATE INDEX "payload_locked_documents_rels_care_states_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("care_states_id");
  CREATE INDEX "payload_locked_documents_rels_audit_events_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("audit_events_id");
  CREATE INDEX "payload_locked_documents_rels_integrity_runs_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("integrity_runs_id");
  CREATE INDEX "payload_locked_documents_rels_sessions_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("sessions_id");
  CREATE INDEX "payload_locked_documents_rels_accounts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("accounts_id");
  CREATE INDEX "payload_locked_documents_rels_verifications_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("verifications_id");
  CREATE INDEX "payload_locked_documents_rels_passkeys_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("passkeys_id");
  CREATE INDEX "payload_locked_documents_rels_two_factors_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("two_factors_id");
  CREATE INDEX "payload_locked_documents_rels_device_codes_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("device_codes_id");
  CREATE INDEX "payload_locked_documents_rels_rate_limits_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("rate_limits_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload"."payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."users" CASCADE;
  DROP TABLE "payload"."_users_v" CASCADE;
  DROP TABLE "payload"."media" CASCADE;
  DROP TABLE "payload"."_media_v" CASCADE;
  DROP TABLE "payload"."guardian_consents" CASCADE;
  DROP TABLE "payload"."_guardian_consents_v" CASCADE;
  DROP TABLE "payload"."eggs" CASCADE;
  DROP TABLE "payload"."_eggs_v" CASCADE;
  DROP TABLE "payload"."mon_instances" CASCADE;
  DROP TABLE "payload"."_mon_instances_v" CASCADE;
  DROP TABLE "payload"."care_states" CASCADE;
  DROP TABLE "payload"."_care_states_v" CASCADE;
  DROP TABLE "payload"."audit_events" CASCADE;
  DROP TABLE "payload"."_audit_events_v" CASCADE;
  DROP TABLE "payload"."integrity_runs" CASCADE;
  DROP TABLE "payload"."_integrity_runs_v" CASCADE;
  DROP TABLE "payload"."sessions" CASCADE;
  DROP TABLE "payload"."_sessions_v" CASCADE;
  DROP TABLE "payload"."accounts" CASCADE;
  DROP TABLE "payload"."_accounts_v" CASCADE;
  DROP TABLE "payload"."verifications" CASCADE;
  DROP TABLE "payload"."_verifications_v" CASCADE;
  DROP TABLE "payload"."passkeys" CASCADE;
  DROP TABLE "payload"."_passkeys_v" CASCADE;
  DROP TABLE "payload"."two_factors" CASCADE;
  DROP TABLE "payload"."_two_factors_v" CASCADE;
  DROP TABLE "payload"."device_codes" CASCADE;
  DROP TABLE "payload"."_device_codes_v" CASCADE;
  DROP TABLE "payload"."rate_limits" CASCADE;
  DROP TABLE "payload"."_rate_limits_v" CASCADE;
  DROP TABLE "payload"."payload_kv" CASCADE;
  DROP TABLE "payload"."payload_jobs_log" CASCADE;
  DROP TABLE "payload"."payload_jobs" CASCADE;
  DROP TABLE "payload"."payload_locked_documents" CASCADE;
  DROP TABLE "payload"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload"."payload_preferences" CASCADE;
  DROP TABLE "payload"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload"."payload_migrations" CASCADE;
  DROP TABLE "payload"."payload_jobs_stats" CASCADE;
  DROP TYPE "payload"."enum_users_role";
  DROP TYPE "payload"."enum_users_consent_status";
  DROP TYPE "payload"."enum_users_two_factor_otp_channel";
  DROP TYPE "payload"."enum_users_deletion_reason";
  DROP TYPE "payload"."enum__users_v_version_role";
  DROP TYPE "payload"."enum__users_v_version_consent_status";
  DROP TYPE "payload"."enum__users_v_version_two_factor_otp_channel";
  DROP TYPE "payload"."enum__users_v_version_deletion_reason";
  DROP TYPE "payload"."enum_guardian_consents_status";
  DROP TYPE "payload"."enum_guardian_consents_parent_request";
  DROP TYPE "payload"."enum__guardian_consents_v_version_status";
  DROP TYPE "payload"."enum__guardian_consents_v_version_parent_request";
  DROP TYPE "payload"."enum_mon_instances_stage";
  DROP TYPE "payload"."enum__mon_instances_v_version_stage";
  DROP TYPE "payload"."enum_audit_events_action";
  DROP TYPE "payload"."enum_audit_events_target_type";
  DROP TYPE "payload"."enum_audit_events_reason_code";
  DROP TYPE "payload"."enum__audit_events_v_version_action";
  DROP TYPE "payload"."enum__audit_events_v_version_target_type";
  DROP TYPE "payload"."enum__audit_events_v_version_reason_code";
  DROP TYPE "payload"."enum_integrity_runs_trigger";
  DROP TYPE "payload"."enum__integrity_runs_v_version_trigger";
  DROP TYPE "payload"."enum_payload_jobs_log_task_slug";
  DROP TYPE "payload"."enum_payload_jobs_log_state";
  DROP TYPE "payload"."enum_payload_jobs_log_parent_task_slug";
  DROP TYPE "payload"."enum_payload_jobs_task_slug";`)
}
