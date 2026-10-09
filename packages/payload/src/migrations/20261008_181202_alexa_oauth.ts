import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."jwks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"public_key" varchar NOT NULL,
  	"private_key" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone,
  	"alg" varchar,
  	"crv" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."oauth_clients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_id" varchar NOT NULL,
  	"client_secret" varchar,
  	"client_discovery_id" varchar,
  	"disabled" boolean DEFAULT false,
  	"skip_consent" boolean,
  	"enable_end_session" boolean,
  	"subject_type" varchar,
  	"scopes" jsonb,
  	"client_credentials_scopes" jsonb DEFAULT '[]'::jsonb,
  	"user_id" integer,
  	"name" varchar,
  	"uri" varchar,
  	"icon" varchar,
  	"contacts" jsonb,
  	"tos" varchar,
  	"policy" varchar,
  	"software_id" varchar,
  	"software_version" varchar,
  	"software_statement" varchar,
  	"redirect_uris" jsonb NOT NULL,
  	"post_logout_redirect_uris" jsonb,
  	"backchannel_logout_uri" varchar,
  	"backchannel_logout_session_required" boolean,
  	"token_endpoint_auth_method" varchar,
  	"application_type" varchar,
  	"jwks" varchar,
  	"jwks_uri" varchar,
  	"grant_types" jsonb,
  	"response_types" jsonb,
  	"require_p_k_c_e" boolean,
  	"dpop_bound_access_tokens" boolean DEFAULT false,
  	"reference_id" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."oauth_resources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"identifier" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"access_token_ttl" numeric,
  	"refresh_token_ttl" numeric,
  	"signing_algorithm" varchar,
  	"signing_key_id" varchar,
  	"allowed_scopes" jsonb,
  	"custom_claims" jsonb,
  	"dpop_bound_access_tokens_required" boolean DEFAULT false,
  	"disabled" boolean DEFAULT false,
  	"policy_version" numeric DEFAULT 1,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."oauth_client_resources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_id" varchar NOT NULL,
  	"resource_id" varchar NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."oauth_refresh_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token" varchar NOT NULL,
  	"client_id" varchar NOT NULL,
  	"session_id" integer,
  	"user_id" integer NOT NULL,
  	"reference_id" varchar,
  	"authorization_code_id" varchar,
  	"resources" jsonb,
  	"requested_user_info_claims" jsonb,
  	"expires_at" timestamp(3) with time zone,
  	"revoked" timestamp(3) with time zone,
  	"rotated_at" timestamp(3) with time zone,
  	"rotation_replay_response" varchar,
  	"rotation_replay_expires_at" timestamp(3) with time zone,
  	"auth_time" timestamp(3) with time zone,
  	"confirmation" jsonb,
  	"scopes" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."oauth_access_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token" varchar,
  	"client_id" varchar NOT NULL,
  	"session_id" integer,
  	"user_id" integer,
  	"reference_id" varchar,
  	"authorization_code_id" varchar,
  	"resources" jsonb,
  	"requested_user_info_claims" jsonb,
  	"refresh_id" integer,
  	"expires_at" timestamp(3) with time zone,
  	"revoked" timestamp(3) with time zone,
  	"confirmation" jsonb,
  	"scopes" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."oauth_consents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_id" varchar NOT NULL,
  	"user_id" integer,
  	"reference_id" varchar,
  	"resources" jsonb,
  	"requested_user_info_claims" jsonb,
  	"scopes" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  CREATE TABLE "payload"."oauth_client_assertions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  
  ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1791483122322;
  ALTER TABLE "payload"."_rate_limits_v" ALTER COLUMN "version_last_request" SET DEFAULT 1791483122322;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "jwks_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "oauth_clients_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "oauth_resources_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "oauth_client_resources_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "oauth_refresh_tokens_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "oauth_access_tokens_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "oauth_consents_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "oauth_client_assertions_id" integer;
  ALTER TABLE "payload"."_jwks_v" ADD CONSTRAINT "_jwks_v_parent_id_jwks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."jwks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."oauth_clients" ADD CONSTRAINT "oauth_clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_clients_v" ADD CONSTRAINT "_oauth_clients_v_parent_id_oauth_clients_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_clients_v" ADD CONSTRAINT "_oauth_clients_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_resources_v" ADD CONSTRAINT "_oauth_resources_v_parent_id_oauth_resources_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_resources"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_client_resources_v" ADD CONSTRAINT "_oauth_client_resources_v_parent_id_oauth_client_resources_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_client_resources"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "payload"."sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_refresh_tokens_v" ADD CONSTRAINT "_oauth_refresh_tokens_v_parent_id_oauth_refresh_tokens_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_refresh_tokens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_refresh_tokens_v" ADD CONSTRAINT "_oauth_refresh_tokens_v_version_session_id_sessions_id_fk" FOREIGN KEY ("version_session_id") REFERENCES "payload"."sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_refresh_tokens_v" ADD CONSTRAINT "_oauth_refresh_tokens_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "payload"."sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_refresh_id_oauth_refresh_tokens_id_fk" FOREIGN KEY ("refresh_id") REFERENCES "payload"."oauth_refresh_tokens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_access_tokens_v" ADD CONSTRAINT "_oauth_access_tokens_v_parent_id_oauth_access_tokens_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_access_tokens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_access_tokens_v" ADD CONSTRAINT "_oauth_access_tokens_v_version_session_id_sessions_id_fk" FOREIGN KEY ("version_session_id") REFERENCES "payload"."sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_access_tokens_v" ADD CONSTRAINT "_oauth_access_tokens_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_access_tokens_v" ADD CONSTRAINT "_oauth_access_tokens_v_version_refresh_id_oauth_refresh_tokens_id_fk" FOREIGN KEY ("version_refresh_id") REFERENCES "payload"."oauth_refresh_tokens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."oauth_consents" ADD CONSTRAINT "oauth_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_consents_v" ADD CONSTRAINT "_oauth_consents_v_parent_id_oauth_consents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_consents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_consents_v" ADD CONSTRAINT "_oauth_consents_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "payload"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_oauth_client_assertions_v" ADD CONSTRAINT "_oauth_client_assertions_v_parent_id_oauth_client_assertions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."oauth_client_assertions"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "jwks_updated_at_idx" ON "payload"."jwks" USING btree ("updated_at");
  CREATE INDEX "jwks_created_at_idx" ON "payload"."jwks" USING btree ("created_at");
  CREATE INDEX "_jwks_v_parent_idx" ON "payload"."_jwks_v" USING btree ("parent_id");
  CREATE INDEX "_jwks_v_version_version_updated_at_idx" ON "payload"."_jwks_v" USING btree ("version_updated_at");
  CREATE INDEX "_jwks_v_version_version_created_at_idx" ON "payload"."_jwks_v" USING btree ("version_created_at");
  CREATE INDEX "_jwks_v_created_at_idx" ON "payload"."_jwks_v" USING btree ("created_at");
  CREATE INDEX "_jwks_v_updated_at_idx" ON "payload"."_jwks_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "oauth_clients_client_id_idx" ON "payload"."oauth_clients" USING btree ("client_id");
  CREATE INDEX "oauth_clients_user_idx" ON "payload"."oauth_clients" USING btree ("user_id");
  CREATE INDEX "oauth_clients_updated_at_idx" ON "payload"."oauth_clients" USING btree ("updated_at");
  CREATE INDEX "oauth_clients_created_at_idx" ON "payload"."oauth_clients" USING btree ("created_at");
  CREATE INDEX "_oauth_clients_v_parent_idx" ON "payload"."_oauth_clients_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_clients_v_version_version_client_id_idx" ON "payload"."_oauth_clients_v" USING btree ("version_client_id");
  CREATE INDEX "_oauth_clients_v_version_version_user_idx" ON "payload"."_oauth_clients_v" USING btree ("version_user_id");
  CREATE INDEX "_oauth_clients_v_version_version_updated_at_idx" ON "payload"."_oauth_clients_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_clients_v_version_version_created_at_idx" ON "payload"."_oauth_clients_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_clients_v_created_at_idx" ON "payload"."_oauth_clients_v" USING btree ("created_at");
  CREATE INDEX "_oauth_clients_v_updated_at_idx" ON "payload"."_oauth_clients_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "oauth_resources_identifier_idx" ON "payload"."oauth_resources" USING btree ("identifier");
  CREATE INDEX "oauth_resources_updated_at_idx" ON "payload"."oauth_resources" USING btree ("updated_at");
  CREATE INDEX "oauth_resources_created_at_idx" ON "payload"."oauth_resources" USING btree ("created_at");
  CREATE INDEX "_oauth_resources_v_parent_idx" ON "payload"."_oauth_resources_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_resources_v_version_version_identifier_idx" ON "payload"."_oauth_resources_v" USING btree ("version_identifier");
  CREATE INDEX "_oauth_resources_v_version_version_updated_at_idx" ON "payload"."_oauth_resources_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_resources_v_version_version_created_at_idx" ON "payload"."_oauth_resources_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_resources_v_created_at_idx" ON "payload"."_oauth_resources_v" USING btree ("created_at");
  CREATE INDEX "_oauth_resources_v_updated_at_idx" ON "payload"."_oauth_resources_v" USING btree ("updated_at");
  CREATE INDEX "oauth_client_resources_updated_at_idx" ON "payload"."oauth_client_resources" USING btree ("updated_at");
  CREATE INDEX "oauth_client_resources_created_at_idx" ON "payload"."oauth_client_resources" USING btree ("created_at");
  CREATE UNIQUE INDEX "clientId_resourceId_idx" ON "payload"."oauth_client_resources" USING btree ("client_id","resource_id");
  CREATE INDEX "_oauth_client_resources_v_parent_idx" ON "payload"."_oauth_client_resources_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_client_resources_v_version_version_updated_at_idx" ON "payload"."_oauth_client_resources_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_client_resources_v_version_version_created_at_idx" ON "payload"."_oauth_client_resources_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_client_resources_v_created_at_idx" ON "payload"."_oauth_client_resources_v" USING btree ("created_at");
  CREATE INDEX "_oauth_client_resources_v_updated_at_idx" ON "payload"."_oauth_client_resources_v" USING btree ("updated_at");
  CREATE INDEX "version_clientId_version_resourceId_idx" ON "payload"."_oauth_client_resources_v" USING btree ("version_client_id","version_resource_id");
  CREATE UNIQUE INDEX "oauth_refresh_tokens_token_idx" ON "payload"."oauth_refresh_tokens" USING btree ("token");
  CREATE INDEX "oauth_refresh_tokens_session_idx" ON "payload"."oauth_refresh_tokens" USING btree ("session_id");
  CREATE INDEX "oauth_refresh_tokens_user_idx" ON "payload"."oauth_refresh_tokens" USING btree ("user_id");
  CREATE INDEX "oauth_refresh_tokens_updated_at_idx" ON "payload"."oauth_refresh_tokens" USING btree ("updated_at");
  CREATE INDEX "oauth_refresh_tokens_created_at_idx" ON "payload"."oauth_refresh_tokens" USING btree ("created_at");
  CREATE INDEX "_oauth_refresh_tokens_v_parent_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_refresh_tokens_v_version_version_token_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("version_token");
  CREATE INDEX "_oauth_refresh_tokens_v_version_version_session_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("version_session_id");
  CREATE INDEX "_oauth_refresh_tokens_v_version_version_user_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("version_user_id");
  CREATE INDEX "_oauth_refresh_tokens_v_version_version_updated_at_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_refresh_tokens_v_version_version_created_at_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_refresh_tokens_v_created_at_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("created_at");
  CREATE INDEX "_oauth_refresh_tokens_v_updated_at_idx" ON "payload"."_oauth_refresh_tokens_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "oauth_access_tokens_token_idx" ON "payload"."oauth_access_tokens" USING btree ("token");
  CREATE INDEX "oauth_access_tokens_session_idx" ON "payload"."oauth_access_tokens" USING btree ("session_id");
  CREATE INDEX "oauth_access_tokens_user_idx" ON "payload"."oauth_access_tokens" USING btree ("user_id");
  CREATE INDEX "oauth_access_tokens_refresh_idx" ON "payload"."oauth_access_tokens" USING btree ("refresh_id");
  CREATE INDEX "oauth_access_tokens_updated_at_idx" ON "payload"."oauth_access_tokens" USING btree ("updated_at");
  CREATE INDEX "oauth_access_tokens_created_at_idx" ON "payload"."oauth_access_tokens" USING btree ("created_at");
  CREATE INDEX "_oauth_access_tokens_v_parent_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_access_tokens_v_version_version_token_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_token");
  CREATE INDEX "_oauth_access_tokens_v_version_version_session_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_session_id");
  CREATE INDEX "_oauth_access_tokens_v_version_version_user_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_user_id");
  CREATE INDEX "_oauth_access_tokens_v_version_version_refresh_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_refresh_id");
  CREATE INDEX "_oauth_access_tokens_v_version_version_updated_at_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_access_tokens_v_version_version_created_at_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_access_tokens_v_created_at_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("created_at");
  CREATE INDEX "_oauth_access_tokens_v_updated_at_idx" ON "payload"."_oauth_access_tokens_v" USING btree ("updated_at");
  CREATE INDEX "oauth_consents_user_idx" ON "payload"."oauth_consents" USING btree ("user_id");
  CREATE INDEX "oauth_consents_updated_at_idx" ON "payload"."oauth_consents" USING btree ("updated_at");
  CREATE INDEX "oauth_consents_created_at_idx" ON "payload"."oauth_consents" USING btree ("created_at");
  CREATE INDEX "_oauth_consents_v_parent_idx" ON "payload"."_oauth_consents_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_consents_v_version_version_user_idx" ON "payload"."_oauth_consents_v" USING btree ("version_user_id");
  CREATE INDEX "_oauth_consents_v_version_version_updated_at_idx" ON "payload"."_oauth_consents_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_consents_v_version_version_created_at_idx" ON "payload"."_oauth_consents_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_consents_v_created_at_idx" ON "payload"."_oauth_consents_v" USING btree ("created_at");
  CREATE INDEX "_oauth_consents_v_updated_at_idx" ON "payload"."_oauth_consents_v" USING btree ("updated_at");
  CREATE INDEX "oauth_client_assertions_updated_at_idx" ON "payload"."oauth_client_assertions" USING btree ("updated_at");
  CREATE INDEX "oauth_client_assertions_created_at_idx" ON "payload"."oauth_client_assertions" USING btree ("created_at");
  CREATE INDEX "_oauth_client_assertions_v_parent_idx" ON "payload"."_oauth_client_assertions_v" USING btree ("parent_id");
  CREATE INDEX "_oauth_client_assertions_v_version_version_updated_at_idx" ON "payload"."_oauth_client_assertions_v" USING btree ("version_updated_at");
  CREATE INDEX "_oauth_client_assertions_v_version_version_created_at_idx" ON "payload"."_oauth_client_assertions_v" USING btree ("version_created_at");
  CREATE INDEX "_oauth_client_assertions_v_created_at_idx" ON "payload"."_oauth_client_assertions_v" USING btree ("created_at");
  CREATE INDEX "_oauth_client_assertions_v_updated_at_idx" ON "payload"."_oauth_client_assertions_v" USING btree ("updated_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_jwks_fk" FOREIGN KEY ("jwks_id") REFERENCES "payload"."jwks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_clients_fk" FOREIGN KEY ("oauth_clients_id") REFERENCES "payload"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_resources_fk" FOREIGN KEY ("oauth_resources_id") REFERENCES "payload"."oauth_resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_client_resources_fk" FOREIGN KEY ("oauth_client_resources_id") REFERENCES "payload"."oauth_client_resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_refresh_tokens_fk" FOREIGN KEY ("oauth_refresh_tokens_id") REFERENCES "payload"."oauth_refresh_tokens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_access_tokens_fk" FOREIGN KEY ("oauth_access_tokens_id") REFERENCES "payload"."oauth_access_tokens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_consents_fk" FOREIGN KEY ("oauth_consents_id") REFERENCES "payload"."oauth_consents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_client_assertions_fk" FOREIGN KEY ("oauth_client_assertions_id") REFERENCES "payload"."oauth_client_assertions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_jwks_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("jwks_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_clients_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("oauth_clients_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_resources_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("oauth_resources_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_client_resources_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("oauth_client_resources_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_refresh_tokens_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("oauth_refresh_tokens_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_access_tokens_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("oauth_access_tokens_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_consents_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("oauth_consents_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_client_assertions_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("oauth_client_assertions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."jwks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_jwks_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_clients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_clients_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_resources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_resources_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_client_resources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_client_resources_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_refresh_tokens" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_refresh_tokens_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_access_tokens" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_access_tokens_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_consents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_consents_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."oauth_client_assertions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_oauth_client_assertions_v" DISABLE ROW LEVEL SECURITY;
  -- Drop dependent foreign keys before CASCADE removes their targets.
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_jwks_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_clients_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_resources_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_client_resources_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_refresh_tokens_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_access_tokens_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_consents_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_oauth_client_assertions_fk";
  
  DROP TABLE "payload"."jwks" CASCADE;
  DROP TABLE "payload"."_jwks_v" CASCADE;
  DROP TABLE "payload"."oauth_clients" CASCADE;
  DROP TABLE "payload"."_oauth_clients_v" CASCADE;
  DROP TABLE "payload"."oauth_resources" CASCADE;
  DROP TABLE "payload"."_oauth_resources_v" CASCADE;
  DROP TABLE "payload"."oauth_client_resources" CASCADE;
  DROP TABLE "payload"."_oauth_client_resources_v" CASCADE;
  DROP TABLE "payload"."oauth_refresh_tokens" CASCADE;
  DROP TABLE "payload"."_oauth_refresh_tokens_v" CASCADE;
  DROP TABLE "payload"."oauth_access_tokens" CASCADE;
  DROP TABLE "payload"."_oauth_access_tokens_v" CASCADE;
  DROP TABLE "payload"."oauth_consents" CASCADE;
  DROP TABLE "payload"."_oauth_consents_v" CASCADE;
  DROP TABLE "payload"."oauth_client_assertions" CASCADE;
  DROP TABLE "payload"."_oauth_client_assertions_v" CASCADE;
  DROP INDEX "payload"."payload_locked_documents_rels_jwks_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_oauth_clients_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_oauth_resources_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_oauth_client_resources_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_oauth_refresh_tokens_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_oauth_access_tokens_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_oauth_consents_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_oauth_client_assertions_id_idx";
  ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1791404476421;
  ALTER TABLE "payload"."_rate_limits_v" ALTER COLUMN "version_last_request" SET DEFAULT 1791404476421;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "jwks_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "oauth_clients_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "oauth_resources_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "oauth_client_resources_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "oauth_refresh_tokens_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "oauth_access_tokens_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "oauth_consents_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "oauth_client_assertions_id";`)
}
