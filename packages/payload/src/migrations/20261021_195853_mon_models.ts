import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_language_lexicon_entry_type" AS ENUM('lexicon', 'pronunciation_rule', 'grammar_rule', 'call_response', 'ballroom_term', 'style_rule');
  CREATE TYPE "payload"."enum_language_lexicon_usage_frequency" AS ENUM('low', 'medium', 'high');
  CREATE TYPE "payload"."enum_language_lexicon_mirror_strength" AS ENUM('none', 'low', 'medium', 'high');
  CREATE TYPE "payload"."enum_language_lexicon_profanity" AS ENUM('none');
  CREATE TYPE "payload"."enum__language_lexicon_v_version_entry_type" AS ENUM('lexicon', 'pronunciation_rule', 'grammar_rule', 'call_response', 'ballroom_term', 'style_rule');
  CREATE TYPE "payload"."enum__language_lexicon_v_version_usage_frequency" AS ENUM('low', 'medium', 'high');
  CREATE TYPE "payload"."enum__language_lexicon_v_version_mirror_strength" AS ENUM('none', 'low', 'medium', 'high');
  CREATE TYPE "payload"."enum__language_lexicon_v_version_profanity" AS ENUM('none');
  CREATE TYPE "payload"."enum_mon_models_animations_role" AS ENUM('idle', 'asleep', 'feed', 'rest', 'wake', 'play', 'hatch', 'evolve');
  CREATE TYPE "payload"."enum_mon_models_species_id" AS ENUM('dex-001', 'dex-002', 'dex-003', 'dex-004', 'dex-005', 'dex-006', 'dex-007', 'dex-008', 'dex-009', 'dex-010', 'dex-011', 'dex-012', 'dex-013', 'dex-014', 'dex-061', 'dex-062', 'dex-063', 'dex-064', 'dex-065', 'dex-066', 'dex-067');
  CREATE TYPE "payload"."enum_mon_models_status" AS ENUM('in-review', 'approved');
  CREATE TYPE "payload"."enum_mon_models_credit_license" AS ENUM('owned', 'cc0', 'cc-by-4.0', 'other');
  CREATE TYPE "payload"."enum__mon_models_v_version_animations_role" AS ENUM('idle', 'asleep', 'feed', 'rest', 'wake', 'play', 'hatch', 'evolve');
  CREATE TYPE "payload"."enum__mon_models_v_version_species_id" AS ENUM('dex-001', 'dex-002', 'dex-003', 'dex-004', 'dex-005', 'dex-006', 'dex-007', 'dex-008', 'dex-009', 'dex-010', 'dex-011', 'dex-012', 'dex-013', 'dex-014', 'dex-061', 'dex-062', 'dex-063', 'dex-064', 'dex-065', 'dex-066', 'dex-067');
  CREATE TYPE "payload"."enum__mon_models_v_version_status" AS ENUM('in-review', 'approved');
  CREATE TYPE "payload"."enum__mon_models_v_version_credit_license" AS ENUM('owned', 'cc0', 'cc-by-4.0', 'other');
  CREATE TABLE "payload"."language_lexicon" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"entry_type" "payload"."enum_language_lexicon_entry_type" NOT NULL,
  	"canonical_text" varchar NOT NULL,
  	"spoken_form" varchar,
  	"meaning" varchar NOT NULL,
  	"category" varchar NOT NULL,
  	"subcategory" varchar,
  	"community_tags" varchar,
  	"borough_tags" varchar,
  	"register" varchar,
  	"tone" varchar,
  	"age_min" numeric DEFAULT 13,
  	"usage_frequency" "payload"."enum_language_lexicon_usage_frequency" DEFAULT 'medium',
  	"mirror_strength" "payload"."enum_language_lexicon_mirror_strength" DEFAULT 'low',
  	"tts_pronunciation" varchar,
  	"pronunciation_notes" varchar,
  	"grammar_notes" varchar,
  	"trigger_text" varchar,
  	"response_text" varchar,
  	"relationship_gate" varchar,
  	"activation_policy" varchar NOT NULL,
  	"avoid_when" varchar,
  	"identity_inference" varchar DEFAULT 'never infer identity; use explicit persona, user opt-in, or user-led mirroring' NOT NULL,
  	"profanity" "payload"."enum_language_lexicon_profanity" DEFAULT 'none' NOT NULL,
  	"source_basis" varchar,
  	"source_url" varchar,
  	"editor_notes" varchar,
  	"active" boolean DEFAULT true NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."_language_lexicon_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_key" varchar NOT NULL,
  	"version_entry_type" "payload"."enum__language_lexicon_v_version_entry_type" NOT NULL,
  	"version_canonical_text" varchar NOT NULL,
  	"version_spoken_form" varchar,
  	"version_meaning" varchar NOT NULL,
  	"version_category" varchar NOT NULL,
  	"version_subcategory" varchar,
  	"version_community_tags" varchar,
  	"version_borough_tags" varchar,
  	"version_register" varchar,
  	"version_tone" varchar,
  	"version_age_min" numeric DEFAULT 13,
  	"version_usage_frequency" "payload"."enum__language_lexicon_v_version_usage_frequency" DEFAULT 'medium',
  	"version_mirror_strength" "payload"."enum__language_lexicon_v_version_mirror_strength" DEFAULT 'low',
  	"version_tts_pronunciation" varchar,
  	"version_pronunciation_notes" varchar,
  	"version_grammar_notes" varchar,
  	"version_trigger_text" varchar,
  	"version_response_text" varchar,
  	"version_relationship_gate" varchar,
  	"version_activation_policy" varchar NOT NULL,
  	"version_avoid_when" varchar,
  	"version_identity_inference" varchar DEFAULT 'never infer identity; use explicit persona, user opt-in, or user-led mirroring' NOT NULL,
  	"version_profanity" "payload"."enum__language_lexicon_v_version_profanity" DEFAULT 'none' NOT NULL,
  	"version_source_basis" varchar,
  	"version_source_url" varchar,
  	"version_editor_notes" varchar,
  	"version_active" boolean DEFAULT true NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."mon_models_animations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"role" "payload"."enum_mon_models_animations_role" NOT NULL,
  	"clip" varchar NOT NULL,
  	"loop" boolean DEFAULT true
  );
  
  CREATE TABLE "payload"."mon_models_animation_clips" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "payload"."mon_models_morph_targets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "payload"."mon_models" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"species_id" "payload"."enum_mon_models_species_id" NOT NULL,
  	"stage" varchar,
  	"bloodline_id" varchar,
  	"status" "payload"."enum_mon_models_status" DEFAULT 'in-review' NOT NULL,
  	"bunny_url" varchar,
  	"scale" numeric DEFAULT 1 NOT NULL,
  	"position_x" numeric DEFAULT 0 NOT NULL,
  	"position_y" numeric DEFAULT 0 NOT NULL,
  	"position_z" numeric DEFAULT 0 NOT NULL,
  	"rotation_x" numeric DEFAULT 0 NOT NULL,
  	"rotation_y" numeric DEFAULT 0 NOT NULL,
  	"rotation_z" numeric DEFAULT 0 NOT NULL,
  	"height_meters" numeric,
  	"credit_author" varchar,
  	"credit_license" "payload"."enum_mon_models_credit_license" DEFAULT 'owned',
  	"credit_source_url" varchar,
  	"notes" varchar,
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
  
  CREATE TABLE "payload"."_mon_models_v_version_animations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "payload"."enum__mon_models_v_version_animations_role" NOT NULL,
  	"clip" varchar NOT NULL,
  	"loop" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_mon_models_v_version_animation_clips" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_mon_models_v_version_morph_targets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_mon_models_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_species_id" "payload"."enum__mon_models_v_version_species_id" NOT NULL,
  	"version_stage" varchar,
  	"version_bloodline_id" varchar,
  	"version_status" "payload"."enum__mon_models_v_version_status" DEFAULT 'in-review' NOT NULL,
  	"version_bunny_url" varchar,
  	"version_scale" numeric DEFAULT 1 NOT NULL,
  	"version_position_x" numeric DEFAULT 0 NOT NULL,
  	"version_position_y" numeric DEFAULT 0 NOT NULL,
  	"version_position_z" numeric DEFAULT 0 NOT NULL,
  	"version_rotation_x" numeric DEFAULT 0 NOT NULL,
  	"version_rotation_y" numeric DEFAULT 0 NOT NULL,
  	"version_rotation_z" numeric DEFAULT 0 NOT NULL,
  	"version_height_meters" numeric,
  	"version_credit_author" varchar,
  	"version_credit_license" "payload"."enum__mon_models_v_version_credit_license" DEFAULT 'owned',
  	"version_credit_source_url" varchar,
  	"version_notes" varchar,
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
  
  ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1792612733774;
  ALTER TABLE "payload"."_rate_limits_v" ALTER COLUMN "version_last_request" SET DEFAULT 1792612733774;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "language_lexicon_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "mon_models_id" integer;
  ALTER TABLE "payload"."_language_lexicon_v" ADD CONSTRAINT "_language_lexicon_v_parent_id_language_lexicon_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."language_lexicon"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."mon_models_animations" ADD CONSTRAINT "mon_models_animations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."mon_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."mon_models_animation_clips" ADD CONSTRAINT "mon_models_animation_clips_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."mon_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."mon_models_morph_targets" ADD CONSTRAINT "mon_models_morph_targets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."mon_models"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_models_v_version_animations" ADD CONSTRAINT "_mon_models_v_version_animations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_mon_models_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_models_v_version_animation_clips" ADD CONSTRAINT "_mon_models_v_version_animation_clips_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_mon_models_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_models_v_version_morph_targets" ADD CONSTRAINT "_mon_models_v_version_morph_targets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_mon_models_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_models_v" ADD CONSTRAINT "_mon_models_v_parent_id_mon_models_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."mon_models"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "language_lexicon_key_idx" ON "payload"."language_lexicon" USING btree ("key");
  CREATE INDEX "language_lexicon_entry_type_idx" ON "payload"."language_lexicon" USING btree ("entry_type");
  CREATE INDEX "language_lexicon_canonical_text_idx" ON "payload"."language_lexicon" USING btree ("canonical_text");
  CREATE INDEX "language_lexicon_category_idx" ON "payload"."language_lexicon" USING btree ("category");
  CREATE INDEX "language_lexicon_community_tags_idx" ON "payload"."language_lexicon" USING btree ("community_tags");
  CREATE INDEX "language_lexicon_active_idx" ON "payload"."language_lexicon" USING btree ("active");
  CREATE INDEX "language_lexicon_updated_at_idx" ON "payload"."language_lexicon" USING btree ("updated_at");
  CREATE INDEX "language_lexicon_created_at_idx" ON "payload"."language_lexicon" USING btree ("created_at");
  CREATE INDEX "_language_lexicon_v_parent_idx" ON "payload"."_language_lexicon_v" USING btree ("parent_id");
  CREATE INDEX "_language_lexicon_v_version_version_key_idx" ON "payload"."_language_lexicon_v" USING btree ("version_key");
  CREATE INDEX "_language_lexicon_v_version_version_entry_type_idx" ON "payload"."_language_lexicon_v" USING btree ("version_entry_type");
  CREATE INDEX "_language_lexicon_v_version_version_canonical_text_idx" ON "payload"."_language_lexicon_v" USING btree ("version_canonical_text");
  CREATE INDEX "_language_lexicon_v_version_version_category_idx" ON "payload"."_language_lexicon_v" USING btree ("version_category");
  CREATE INDEX "_language_lexicon_v_version_version_community_tags_idx" ON "payload"."_language_lexicon_v" USING btree ("version_community_tags");
  CREATE INDEX "_language_lexicon_v_version_version_active_idx" ON "payload"."_language_lexicon_v" USING btree ("version_active");
  CREATE INDEX "_language_lexicon_v_version_version_updated_at_idx" ON "payload"."_language_lexicon_v" USING btree ("version_updated_at");
  CREATE INDEX "_language_lexicon_v_version_version_created_at_idx" ON "payload"."_language_lexicon_v" USING btree ("version_created_at");
  CREATE INDEX "_language_lexicon_v_created_at_idx" ON "payload"."_language_lexicon_v" USING btree ("created_at");
  CREATE INDEX "_language_lexicon_v_updated_at_idx" ON "payload"."_language_lexicon_v" USING btree ("updated_at");
  CREATE INDEX "mon_models_animations_order_idx" ON "payload"."mon_models_animations" USING btree ("_order");
  CREATE INDEX "mon_models_animations_parent_id_idx" ON "payload"."mon_models_animations" USING btree ("_parent_id");
  CREATE INDEX "mon_models_animation_clips_order_idx" ON "payload"."mon_models_animation_clips" USING btree ("_order");
  CREATE INDEX "mon_models_animation_clips_parent_id_idx" ON "payload"."mon_models_animation_clips" USING btree ("_parent_id");
  CREATE INDEX "mon_models_morph_targets_order_idx" ON "payload"."mon_models_morph_targets" USING btree ("_order");
  CREATE INDEX "mon_models_morph_targets_parent_id_idx" ON "payload"."mon_models_morph_targets" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "mon_models_species_id_idx" ON "payload"."mon_models" USING btree ("species_id");
  CREATE INDEX "mon_models_updated_at_idx" ON "payload"."mon_models" USING btree ("updated_at");
  CREATE INDEX "mon_models_created_at_idx" ON "payload"."mon_models" USING btree ("created_at");
  CREATE UNIQUE INDEX "mon_models_filename_idx" ON "payload"."mon_models" USING btree ("filename");
  CREATE INDEX "_mon_models_v_version_animations_order_idx" ON "payload"."_mon_models_v_version_animations" USING btree ("_order");
  CREATE INDEX "_mon_models_v_version_animations_parent_id_idx" ON "payload"."_mon_models_v_version_animations" USING btree ("_parent_id");
  CREATE INDEX "_mon_models_v_version_animation_clips_order_idx" ON "payload"."_mon_models_v_version_animation_clips" USING btree ("_order");
  CREATE INDEX "_mon_models_v_version_animation_clips_parent_id_idx" ON "payload"."_mon_models_v_version_animation_clips" USING btree ("_parent_id");
  CREATE INDEX "_mon_models_v_version_morph_targets_order_idx" ON "payload"."_mon_models_v_version_morph_targets" USING btree ("_order");
  CREATE INDEX "_mon_models_v_version_morph_targets_parent_id_idx" ON "payload"."_mon_models_v_version_morph_targets" USING btree ("_parent_id");
  CREATE INDEX "_mon_models_v_parent_idx" ON "payload"."_mon_models_v" USING btree ("parent_id");
  CREATE INDEX "_mon_models_v_version_version_species_id_idx" ON "payload"."_mon_models_v" USING btree ("version_species_id");
  CREATE INDEX "_mon_models_v_version_version_updated_at_idx" ON "payload"."_mon_models_v" USING btree ("version_updated_at");
  CREATE INDEX "_mon_models_v_version_version_created_at_idx" ON "payload"."_mon_models_v" USING btree ("version_created_at");
  CREATE INDEX "_mon_models_v_version_version_filename_idx" ON "payload"."_mon_models_v" USING btree ("version_filename");
  CREATE INDEX "_mon_models_v_created_at_idx" ON "payload"."_mon_models_v" USING btree ("created_at");
  CREATE INDEX "_mon_models_v_updated_at_idx" ON "payload"."_mon_models_v" USING btree ("updated_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_language_lexicon_fk" FOREIGN KEY ("language_lexicon_id") REFERENCES "payload"."language_lexicon"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mon_models_fk" FOREIGN KEY ("mon_models_id") REFERENCES "payload"."mon_models"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_language_lexicon_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("language_lexicon_id");
  CREATE INDEX "payload_locked_documents_rels_mon_models_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("mon_models_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."language_lexicon" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_language_lexicon_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."mon_models_animations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."mon_models_animation_clips" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."mon_models_morph_targets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."mon_models" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_mon_models_v_version_animations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_mon_models_v_version_animation_clips" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_mon_models_v_version_morph_targets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_mon_models_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."language_lexicon" CASCADE;
  DROP TABLE "payload"."_language_lexicon_v" CASCADE;
  DROP TABLE "payload"."mon_models_animations" CASCADE;
  DROP TABLE "payload"."mon_models_animation_clips" CASCADE;
  DROP TABLE "payload"."mon_models_morph_targets" CASCADE;
  DROP TABLE "payload"."mon_models" CASCADE;
  DROP TABLE "payload"."_mon_models_v_version_animations" CASCADE;
  DROP TABLE "payload"."_mon_models_v_version_animation_clips" CASCADE;
  DROP TABLE "payload"."_mon_models_v_version_morph_targets" CASCADE;
  DROP TABLE "payload"."_mon_models_v" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_language_lexicon_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_mon_models_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_language_lexicon_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_mon_models_id_idx";
  ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1791483122322;
  ALTER TABLE "payload"."_rate_limits_v" ALTER COLUMN "version_last_request" SET DEFAULT 1791483122322;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "language_lexicon_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "mon_models_id";
  DROP TYPE "payload"."enum_language_lexicon_entry_type";
  DROP TYPE "payload"."enum_language_lexicon_usage_frequency";
  DROP TYPE "payload"."enum_language_lexicon_mirror_strength";
  DROP TYPE "payload"."enum_language_lexicon_profanity";
  DROP TYPE "payload"."enum__language_lexicon_v_version_entry_type";
  DROP TYPE "payload"."enum__language_lexicon_v_version_usage_frequency";
  DROP TYPE "payload"."enum__language_lexicon_v_version_mirror_strength";
  DROP TYPE "payload"."enum__language_lexicon_v_version_profanity";
  DROP TYPE "payload"."enum_mon_models_animations_role";
  DROP TYPE "payload"."enum_mon_models_species_id";
  DROP TYPE "payload"."enum_mon_models_status";
  DROP TYPE "payload"."enum_mon_models_credit_license";
  DROP TYPE "payload"."enum__mon_models_v_version_animations_role";
  DROP TYPE "payload"."enum__mon_models_v_version_species_id";
  DROP TYPE "payload"."enum__mon_models_v_version_status";
  DROP TYPE "payload"."enum__mon_models_v_version_credit_license";`)
}
