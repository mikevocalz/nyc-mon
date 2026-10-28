import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_language_lexicon_stage" AS ENUM('Egg', 'Baby', 'Small', 'Mid', 'Max');
  CREATE TYPE "payload"."enum_language_lexicon_mood" AS ENUM('content', 'asleep', 'sluggish', 'needs-fullness', 'needs-energy', 'needs-social');
  CREATE TYPE "payload"."enum_language_lexicon_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__language_lexicon_v_version_stage" AS ENUM('Egg', 'Baby', 'Small', 'Mid', 'Max');
  CREATE TYPE "payload"."enum__language_lexicon_v_version_mood" AS ENUM('content', 'asleep', 'sluggish', 'needs-fullness', 'needs-energy', 'needs-social');
  CREATE TYPE "payload"."enum__language_lexicon_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_mon_voices_moods_mood" AS ENUM('content', 'asleep', 'sluggish', 'needs-fullness', 'needs-energy', 'needs-social');
  CREATE TYPE "payload"."enum_mon_voices_low_energy_moods" AS ENUM('content', 'asleep', 'sluggish', 'needs-fullness', 'needs-energy', 'needs-social');
  CREATE TYPE "payload"."enum_mon_voices_provider" AS ENUM('elevenlabs');
  CREATE TYPE "payload"."enum__mon_voices_v_version_moods_mood" AS ENUM('content', 'asleep', 'sluggish', 'needs-fullness', 'needs-energy', 'needs-social');
  CREATE TYPE "payload"."enum__mon_voices_v_version_low_energy_moods" AS ENUM('content', 'asleep', 'sluggish', 'needs-fullness', 'needs-energy', 'needs-social');
  CREATE TYPE "payload"."enum__mon_voices_v_version_provider" AS ENUM('elevenlabs');
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-015';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-016';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-017';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-018';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-019';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-020';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-021';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-022';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-023';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-024';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-025';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-026';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-027';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-028';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-029';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-030';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-031';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-032';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-033';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-034';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-035';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-036';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-037';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-038';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-039';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-040';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-041';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-042';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-043';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-044';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-045';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-046';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-047';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-048';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-049';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-050';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-051';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-052';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-053';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-054';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-055';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-056';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-057';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-058';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-059';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-060';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-068';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-069';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-070';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-071';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-072';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-073';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-074';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-075';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-076';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-077';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-078';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-079';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-080';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-081';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-082';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-083';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-084';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-085';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-086';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-087';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-088';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-089';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-090';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-091';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-092';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-093';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-094';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-095';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-096';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-097';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-098';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-099';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-100';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-101';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-102';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-103';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-104';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-105';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-106';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-107';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-108';
  ALTER TYPE "payload"."enum_mon_models_species_id" ADD VALUE 'dex-109';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-015';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-016';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-017';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-018';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-019';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-020';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-021';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-022';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-023';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-024';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-025';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-026';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-027';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-028';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-029';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-030';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-031';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-032';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-033';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-034';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-035';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-036';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-037';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-038';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-039';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-040';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-041';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-042';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-043';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-044';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-045';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-046';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-047';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-048';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-049';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-050';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-051';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-052';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-053';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-054';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-055';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-056';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-057';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-058';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-059';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-060';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-068';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-069';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-070';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-071';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-072';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-073';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-074';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-075';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-076';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-077';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-078';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-079';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-080';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-081';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-082';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-083';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-084';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-085';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-086';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-087';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-088';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-089';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-090';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-091';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-092';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-093';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-094';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-095';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-096';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-097';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-098';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-099';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-100';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-101';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-102';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-103';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-104';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-105';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-106';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-107';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-108';
  ALTER TYPE "payload"."enum__mon_models_v_version_species_id" ADD VALUE 'dex-109';
  CREATE TABLE "payload"."mon_voices_lineages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"lineage_id" varchar NOT NULL,
  	"voice_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"style" numeric NOT NULL,
  	"speed" numeric DEFAULT 1 NOT NULL
  );
  
  CREATE TABLE "payload"."mon_voices_moods" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"mood" "payload"."enum_mon_voices_moods_mood" NOT NULL,
  	"tag" varchar,
  	"stability" numeric NOT NULL,
  	"similarity_boost" numeric NOT NULL
  );
  
  CREATE TABLE "payload"."mon_voices_low_energy_moods" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum_mon_voices_low_energy_moods",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."mon_voices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider" "payload"."enum_mon_voices_provider" DEFAULT 'elevenlabs' NOT NULL,
  	"model" varchar DEFAULT 'eleven_v4_turbo' NOT NULL,
  	"stage_pitch_egg" numeric,
  	"stage_pitch_baby" numeric,
  	"stage_pitch_small" numeric,
  	"stage_pitch_mid" numeric,
  	"stage_pitch_max" numeric,
  	"default_delivery_tag" varchar,
  	"default_delivery_stability" numeric DEFAULT 0.45 NOT NULL,
  	"default_delivery_similarity_boost" numeric DEFAULT 0.8 NOT NULL,
  	"low_energy_style_factor" numeric DEFAULT 0.5 NOT NULL,
  	"low_energy_max_speed" numeric DEFAULT 0.95 NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."_mon_voices_v_version_lineages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"lineage_id" varchar NOT NULL,
  	"voice_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"style" numeric NOT NULL,
  	"speed" numeric DEFAULT 1 NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_mon_voices_v_version_moods" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"mood" "payload"."enum__mon_voices_v_version_moods_mood" NOT NULL,
  	"tag" varchar,
  	"stability" numeric NOT NULL,
  	"similarity_boost" numeric NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_mon_voices_v_version_low_energy_moods" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum__mon_voices_v_version_low_energy_moods",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."_mon_voices_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_provider" "payload"."enum__mon_voices_v_version_provider" DEFAULT 'elevenlabs' NOT NULL,
  	"version_model" varchar DEFAULT 'eleven_v4_turbo' NOT NULL,
  	"version_stage_pitch_egg" numeric,
  	"version_stage_pitch_baby" numeric,
  	"version_stage_pitch_small" numeric,
  	"version_stage_pitch_mid" numeric,
  	"version_stage_pitch_max" numeric,
  	"version_default_delivery_tag" varchar,
  	"version_default_delivery_stability" numeric DEFAULT 0.45 NOT NULL,
  	"version_default_delivery_similarity_boost" numeric DEFAULT 0.8 NOT NULL,
  	"version_low_energy_style_factor" numeric DEFAULT 0.5 NOT NULL,
  	"version_low_energy_max_speed" numeric DEFAULT 0.95 NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "key" DROP NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "entry_type" DROP NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "canonical_text" DROP NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "meaning" DROP NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "category" DROP NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "activation_policy" DROP NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "identity_inference" DROP NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "profanity" DROP NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "active" DROP NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_key" DROP NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_entry_type" DROP NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_canonical_text" DROP NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_meaning" DROP NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_category" DROP NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_activation_policy" DROP NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_identity_inference" DROP NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_profanity" DROP NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_active" DROP NOT NULL;
  ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1793215292609;
  ALTER TABLE "payload"."_rate_limits_v" ALTER COLUMN "version_last_request" SET DEFAULT 1793215292609;
  ALTER TABLE "payload"."language_lexicon" ADD COLUMN "species_id" varchar;
  ALTER TABLE "payload"."language_lexicon" ADD COLUMN "bloodline_id" varchar;
  ALTER TABLE "payload"."language_lexicon" ADD COLUMN "stage" "payload"."enum_language_lexicon_stage";
  ALTER TABLE "payload"."language_lexicon" ADD COLUMN "mood" "payload"."enum_language_lexicon_mood";
  ALTER TABLE "payload"."language_lexicon" ADD COLUMN "variants" varchar;
  ALTER TABLE "payload"."language_lexicon" ADD COLUMN "spoken_plural" varchar;
  ALTER TABLE "payload"."language_lexicon" ADD COLUMN "sort_order" numeric DEFAULT 0;
  ALTER TABLE "payload"."language_lexicon" ADD COLUMN "locale" varchar DEFAULT 'en-US';
  ALTER TABLE "payload"."language_lexicon" ADD COLUMN "_status" "payload"."enum_language_lexicon_status" DEFAULT 'draft';
  -- Rows written before drafts existed were already live (read: anyone), so they stay published.
  UPDATE "payload"."language_lexicon" SET "_status" = 'published';
  ALTER TABLE "payload"."_language_lexicon_v" ADD COLUMN "version_species_id" varchar;
  ALTER TABLE "payload"."_language_lexicon_v" ADD COLUMN "version_bloodline_id" varchar;
  ALTER TABLE "payload"."_language_lexicon_v" ADD COLUMN "version_stage" "payload"."enum__language_lexicon_v_version_stage";
  ALTER TABLE "payload"."_language_lexicon_v" ADD COLUMN "version_mood" "payload"."enum__language_lexicon_v_version_mood";
  ALTER TABLE "payload"."_language_lexicon_v" ADD COLUMN "version_variants" varchar;
  ALTER TABLE "payload"."_language_lexicon_v" ADD COLUMN "version_spoken_plural" varchar;
  ALTER TABLE "payload"."_language_lexicon_v" ADD COLUMN "version_sort_order" numeric DEFAULT 0;
  ALTER TABLE "payload"."_language_lexicon_v" ADD COLUMN "version_locale" varchar DEFAULT 'en-US';
  ALTER TABLE "payload"."_language_lexicon_v" ADD COLUMN "version__status" "payload"."enum__language_lexicon_v_version_status" DEFAULT 'draft';
  ALTER TABLE "payload"."_language_lexicon_v" ADD COLUMN "latest" boolean;
  ALTER TABLE "payload"."mon_voices_lineages" ADD CONSTRAINT "mon_voices_lineages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."mon_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."mon_voices_moods" ADD CONSTRAINT "mon_voices_moods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."mon_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."mon_voices_low_energy_moods" ADD CONSTRAINT "mon_voices_low_energy_moods_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."mon_voices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_voices_v_version_lineages" ADD CONSTRAINT "_mon_voices_v_version_lineages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_mon_voices_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_voices_v_version_moods" ADD CONSTRAINT "_mon_voices_v_version_moods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_mon_voices_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_mon_voices_v_version_low_energy_moods" ADD CONSTRAINT "_mon_voices_v_version_low_energy_moods_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_mon_voices_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "mon_voices_lineages_order_idx" ON "payload"."mon_voices_lineages" USING btree ("_order");
  CREATE INDEX "mon_voices_lineages_parent_id_idx" ON "payload"."mon_voices_lineages" USING btree ("_parent_id");
  CREATE INDEX "mon_voices_moods_order_idx" ON "payload"."mon_voices_moods" USING btree ("_order");
  CREATE INDEX "mon_voices_moods_parent_id_idx" ON "payload"."mon_voices_moods" USING btree ("_parent_id");
  CREATE INDEX "mon_voices_low_energy_moods_order_idx" ON "payload"."mon_voices_low_energy_moods" USING btree ("order");
  CREATE INDEX "mon_voices_low_energy_moods_parent_idx" ON "payload"."mon_voices_low_energy_moods" USING btree ("parent_id");
  CREATE INDEX "_mon_voices_v_version_lineages_order_idx" ON "payload"."_mon_voices_v_version_lineages" USING btree ("_order");
  CREATE INDEX "_mon_voices_v_version_lineages_parent_id_idx" ON "payload"."_mon_voices_v_version_lineages" USING btree ("_parent_id");
  CREATE INDEX "_mon_voices_v_version_moods_order_idx" ON "payload"."_mon_voices_v_version_moods" USING btree ("_order");
  CREATE INDEX "_mon_voices_v_version_moods_parent_id_idx" ON "payload"."_mon_voices_v_version_moods" USING btree ("_parent_id");
  CREATE INDEX "_mon_voices_v_version_low_energy_moods_order_idx" ON "payload"."_mon_voices_v_version_low_energy_moods" USING btree ("order");
  CREATE INDEX "_mon_voices_v_version_low_energy_moods_parent_idx" ON "payload"."_mon_voices_v_version_low_energy_moods" USING btree ("parent_id");
  CREATE INDEX "_mon_voices_v_created_at_idx" ON "payload"."_mon_voices_v" USING btree ("created_at");
  CREATE INDEX "_mon_voices_v_updated_at_idx" ON "payload"."_mon_voices_v" USING btree ("updated_at");
  CREATE INDEX "language_lexicon_species_id_idx" ON "payload"."language_lexicon" USING btree ("species_id");
  CREATE INDEX "language_lexicon_locale_idx" ON "payload"."language_lexicon" USING btree ("locale");
  CREATE INDEX "language_lexicon__status_idx" ON "payload"."language_lexicon" USING btree ("_status");
  CREATE INDEX "_language_lexicon_v_version_version_species_id_idx" ON "payload"."_language_lexicon_v" USING btree ("version_species_id");
  CREATE INDEX "_language_lexicon_v_version_version_locale_idx" ON "payload"."_language_lexicon_v" USING btree ("version_locale");
  CREATE INDEX "_language_lexicon_v_version_version__status_idx" ON "payload"."_language_lexicon_v" USING btree ("version__status");
  CREATE INDEX "_language_lexicon_v_latest_idx" ON "payload"."_language_lexicon_v" USING btree ("latest");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."mon_voices_lineages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."mon_voices_moods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."mon_voices_low_energy_moods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."mon_voices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_mon_voices_v_version_lineages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_mon_voices_v_version_moods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_mon_voices_v_version_low_energy_moods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_mon_voices_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."mon_voices_lineages" CASCADE;
  DROP TABLE "payload"."mon_voices_moods" CASCADE;
  DROP TABLE "payload"."mon_voices_low_energy_moods" CASCADE;
  DROP TABLE "payload"."mon_voices" CASCADE;
  DROP TABLE "payload"."_mon_voices_v_version_lineages" CASCADE;
  DROP TABLE "payload"."_mon_voices_v_version_moods" CASCADE;
  DROP TABLE "payload"."_mon_voices_v_version_low_energy_moods" CASCADE;
  DROP TABLE "payload"."_mon_voices_v" CASCADE;
  ALTER TABLE "payload"."mon_models" ALTER COLUMN "species_id" SET DATA TYPE text;
  DROP TYPE "payload"."enum_mon_models_species_id";
  CREATE TYPE "payload"."enum_mon_models_species_id" AS ENUM('dex-001', 'dex-002', 'dex-003', 'dex-004', 'dex-005', 'dex-006', 'dex-007', 'dex-008', 'dex-009', 'dex-010', 'dex-011', 'dex-012', 'dex-013', 'dex-014', 'dex-061', 'dex-062', 'dex-063', 'dex-064', 'dex-065', 'dex-066', 'dex-067');
  ALTER TABLE "payload"."mon_models" ALTER COLUMN "species_id" SET DATA TYPE "payload"."enum_mon_models_species_id" USING "species_id"::"payload"."enum_mon_models_species_id";
  ALTER TABLE "payload"."_mon_models_v" ALTER COLUMN "version_species_id" SET DATA TYPE text;
  DROP TYPE "payload"."enum__mon_models_v_version_species_id";
  CREATE TYPE "payload"."enum__mon_models_v_version_species_id" AS ENUM('dex-001', 'dex-002', 'dex-003', 'dex-004', 'dex-005', 'dex-006', 'dex-007', 'dex-008', 'dex-009', 'dex-010', 'dex-011', 'dex-012', 'dex-013', 'dex-014', 'dex-061', 'dex-062', 'dex-063', 'dex-064', 'dex-065', 'dex-066', 'dex-067');
  ALTER TABLE "payload"."_mon_models_v" ALTER COLUMN "version_species_id" SET DATA TYPE "payload"."enum__mon_models_v_version_species_id" USING "version_species_id"::"payload"."enum__mon_models_v_version_species_id";
  DROP INDEX "payload"."language_lexicon_species_id_idx";
  DROP INDEX "payload"."language_lexicon_locale_idx";
  DROP INDEX "payload"."language_lexicon__status_idx";
  DROP INDEX "payload"."_language_lexicon_v_version_version_species_id_idx";
  DROP INDEX "payload"."_language_lexicon_v_version_version_locale_idx";
  DROP INDEX "payload"."_language_lexicon_v_version_version__status_idx";
  DROP INDEX "payload"."_language_lexicon_v_latest_idx";
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "key" SET NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "entry_type" SET NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "canonical_text" SET NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "meaning" SET NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "category" SET NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "activation_policy" SET NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "identity_inference" SET NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "profanity" SET NOT NULL;
  ALTER TABLE "payload"."language_lexicon" ALTER COLUMN "active" SET NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_key" SET NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_entry_type" SET NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_canonical_text" SET NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_meaning" SET NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_category" SET NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_activation_policy" SET NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_identity_inference" SET NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_profanity" SET NOT NULL;
  ALTER TABLE "payload"."_language_lexicon_v" ALTER COLUMN "version_active" SET NOT NULL;
  ALTER TABLE "payload"."rate_limits" ALTER COLUMN "last_request" SET DEFAULT 1792799889583;
  ALTER TABLE "payload"."_rate_limits_v" ALTER COLUMN "version_last_request" SET DEFAULT 1792799889583;
  ALTER TABLE "payload"."language_lexicon" DROP COLUMN "species_id";
  ALTER TABLE "payload"."language_lexicon" DROP COLUMN "bloodline_id";
  ALTER TABLE "payload"."language_lexicon" DROP COLUMN "stage";
  ALTER TABLE "payload"."language_lexicon" DROP COLUMN "mood";
  ALTER TABLE "payload"."language_lexicon" DROP COLUMN "variants";
  ALTER TABLE "payload"."language_lexicon" DROP COLUMN "spoken_plural";
  ALTER TABLE "payload"."language_lexicon" DROP COLUMN "sort_order";
  ALTER TABLE "payload"."language_lexicon" DROP COLUMN "locale";
  ALTER TABLE "payload"."language_lexicon" DROP COLUMN "_status";
  ALTER TABLE "payload"."_language_lexicon_v" DROP COLUMN "version_species_id";
  ALTER TABLE "payload"."_language_lexicon_v" DROP COLUMN "version_bloodline_id";
  ALTER TABLE "payload"."_language_lexicon_v" DROP COLUMN "version_stage";
  ALTER TABLE "payload"."_language_lexicon_v" DROP COLUMN "version_mood";
  ALTER TABLE "payload"."_language_lexicon_v" DROP COLUMN "version_variants";
  ALTER TABLE "payload"."_language_lexicon_v" DROP COLUMN "version_spoken_plural";
  ALTER TABLE "payload"."_language_lexicon_v" DROP COLUMN "version_sort_order";
  ALTER TABLE "payload"."_language_lexicon_v" DROP COLUMN "version_locale";
  ALTER TABLE "payload"."_language_lexicon_v" DROP COLUMN "version__status";
  ALTER TABLE "payload"."_language_lexicon_v" DROP COLUMN "latest";
  DROP TYPE "payload"."enum_language_lexicon_stage";
  DROP TYPE "payload"."enum_language_lexicon_mood";
  DROP TYPE "payload"."enum_language_lexicon_status";
  DROP TYPE "payload"."enum__language_lexicon_v_version_stage";
  DROP TYPE "payload"."enum__language_lexicon_v_version_mood";
  DROP TYPE "payload"."enum__language_lexicon_v_version_status";
  DROP TYPE "payload"."enum_mon_voices_moods_mood";
  DROP TYPE "payload"."enum_mon_voices_low_energy_moods";
  DROP TYPE "payload"."enum_mon_voices_provider";
  DROP TYPE "payload"."enum__mon_voices_v_version_moods_mood";
  DROP TYPE "payload"."enum__mon_voices_v_version_low_energy_moods";
  DROP TYPE "payload"."enum__mon_voices_v_version_provider";`)
}
