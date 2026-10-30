import { sql } from '@payloadcms/db-postgres';
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres';

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_site_pages_blocks_iframe_aspect" AS ENUM('16:9', '4:3', '1:1', '9:16');
  CREATE TYPE "payload"."enum_site_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__site_pages_v_blocks_iframe_aspect" AS ENUM('16:9', '4:3', '1:1', '9:16');
  CREATE TYPE "payload"."enum__site_pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "payload"."site_pages_sections_copy" (
    "_order" integer NOT NULL,
    "_parent_id" varchar NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "label" varchar,
    "key" varchar,
    "value" varchar
  );

  CREATE TABLE "payload"."site_pages_blocks_text" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "heading" varchar,
    "body" varchar,
    "link_label" varchar,
    "link" varchar,
    "block_name" varchar
  );

  CREATE TABLE "payload"."site_pages_blocks_image" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "slot" varchar DEFAULT 'inline',
    "image_id" integer,
    "alt" varchar,
    "decorative" boolean DEFAULT false,
    "caption" varchar,
    "focal_x" numeric DEFAULT 0.5,
    "focal_y" numeric DEFAULT 0.5,
    "block_name" varchar
  );

  CREATE TABLE "payload"."site_pages_blocks_gallery_images" (
    "_order" integer NOT NULL,
    "_parent_id" varchar NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "image_id" integer,
    "alt" varchar,
    "caption" varchar
  );

  CREATE TABLE "payload"."site_pages_blocks_gallery" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "block_name" varchar
  );

  CREATE TABLE "payload"."site_pages_blocks_youtube" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "title" varchar,
    "url" varchar,
    "caption" varchar,
    "block_name" varchar
  );

  CREATE TABLE "payload"."site_pages_blocks_iframe" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "title" varchar,
    "url" varchar,
    "aspect" "payload"."enum_site_pages_blocks_iframe_aspect" DEFAULT '16:9',
    "caption" varchar,
    "block_name" varchar
  );

  CREATE TABLE "payload"."site_pages_sections" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "label" varchar,
    "section_key" varchar,
    "hidden" boolean DEFAULT false
  );

  CREATE TABLE "payload"."site_pages" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar,
    "route" varchar,
    "seo_title" varchar,
    "seo_description" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "payload"."enum_site_pages_status" DEFAULT 'draft'
  );

  CREATE TABLE "payload"."site_pages_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer
  );

  CREATE TABLE "payload"."_site_pages_v_version_sections_copy" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "label" varchar,
    "key" varchar,
    "value" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "payload"."_site_pages_v_blocks_text" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "heading" varchar,
    "body" varchar,
    "link_label" varchar,
    "link" varchar,
    "_uuid" varchar,
    "block_name" varchar
  );

  CREATE TABLE "payload"."_site_pages_v_blocks_image" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "slot" varchar DEFAULT 'inline',
    "image_id" integer,
    "alt" varchar,
    "decorative" boolean DEFAULT false,
    "caption" varchar,
    "focal_x" numeric DEFAULT 0.5,
    "focal_y" numeric DEFAULT 0.5,
    "_uuid" varchar,
    "block_name" varchar
  );

  CREATE TABLE "payload"."_site_pages_v_blocks_gallery_images" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "image_id" integer,
    "alt" varchar,
    "caption" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "payload"."_site_pages_v_blocks_gallery" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "_uuid" varchar,
    "block_name" varchar
  );

  CREATE TABLE "payload"."_site_pages_v_blocks_youtube" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar,
    "url" varchar,
    "caption" varchar,
    "_uuid" varchar,
    "block_name" varchar
  );

  CREATE TABLE "payload"."_site_pages_v_blocks_iframe" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar,
    "url" varchar,
    "aspect" "payload"."enum__site_pages_v_blocks_iframe_aspect" DEFAULT '16:9',
    "caption" varchar,
    "_uuid" varchar,
    "block_name" varchar
  );

  CREATE TABLE "payload"."_site_pages_v_version_sections" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "label" varchar,
    "section_key" varchar,
    "hidden" boolean DEFAULT false,
    "_uuid" varchar
  );

  CREATE TABLE "payload"."_site_pages_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "parent_id" integer,
    "version_title" varchar,
    "version_route" varchar,
    "version_seo_title" varchar,
    "version_seo_description" varchar,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "payload"."enum__site_pages_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean,
    "autosave" boolean
  );

  CREATE TABLE "payload"."_site_pages_v_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer
  );

  ALTER TABLE "payload"."media" ADD COLUMN "site_source_hash" varchar;
  ALTER TABLE "payload"."_media_v" ADD COLUMN "version_site_source_hash" varchar;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "site_pages_id" integer;
  ALTER TABLE "payload"."site_pages_sections_copy" ADD CONSTRAINT "site_pages_sections_copy_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."site_pages_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."site_pages_blocks_text" ADD CONSTRAINT "site_pages_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."site_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."site_pages_blocks_image" ADD CONSTRAINT "site_pages_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."site_pages_blocks_image" ADD CONSTRAINT "site_pages_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."site_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."site_pages_blocks_gallery_images" ADD CONSTRAINT "site_pages_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."site_pages_blocks_gallery_images" ADD CONSTRAINT "site_pages_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."site_pages_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."site_pages_blocks_gallery" ADD CONSTRAINT "site_pages_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."site_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."site_pages_blocks_youtube" ADD CONSTRAINT "site_pages_blocks_youtube_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."site_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."site_pages_blocks_iframe" ADD CONSTRAINT "site_pages_blocks_iframe_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."site_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."site_pages_sections" ADD CONSTRAINT "site_pages_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."site_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."site_pages_rels" ADD CONSTRAINT "site_pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."site_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."site_pages_rels" ADD CONSTRAINT "site_pages_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_version_sections_copy" ADD CONSTRAINT "_site_pages_v_version_sections_copy_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_site_pages_v_version_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_blocks_text" ADD CONSTRAINT "_site_pages_v_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_site_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_blocks_image" ADD CONSTRAINT "_site_pages_v_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_blocks_image" ADD CONSTRAINT "_site_pages_v_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_site_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_blocks_gallery_images" ADD CONSTRAINT "_site_pages_v_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_blocks_gallery_images" ADD CONSTRAINT "_site_pages_v_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_site_pages_v_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_blocks_gallery" ADD CONSTRAINT "_site_pages_v_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_site_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_blocks_youtube" ADD CONSTRAINT "_site_pages_v_blocks_youtube_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_site_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_blocks_iframe" ADD CONSTRAINT "_site_pages_v_blocks_iframe_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_site_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_version_sections" ADD CONSTRAINT "_site_pages_v_version_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_site_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v" ADD CONSTRAINT "_site_pages_v_parent_id_site_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."site_pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_rels" ADD CONSTRAINT "_site_pages_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_site_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_site_pages_v_rels" ADD CONSTRAINT "_site_pages_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_pages_sections_copy_order_idx" ON "payload"."site_pages_sections_copy" USING btree ("_order");
  CREATE INDEX "site_pages_sections_copy_parent_id_idx" ON "payload"."site_pages_sections_copy" USING btree ("_parent_id");
  CREATE INDEX "site_pages_blocks_text_order_idx" ON "payload"."site_pages_blocks_text" USING btree ("_order");
  CREATE INDEX "site_pages_blocks_text_parent_id_idx" ON "payload"."site_pages_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "site_pages_blocks_text_path_idx" ON "payload"."site_pages_blocks_text" USING btree ("_path");
  CREATE INDEX "site_pages_blocks_image_order_idx" ON "payload"."site_pages_blocks_image" USING btree ("_order");
  CREATE INDEX "site_pages_blocks_image_parent_id_idx" ON "payload"."site_pages_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "site_pages_blocks_image_path_idx" ON "payload"."site_pages_blocks_image" USING btree ("_path");
  CREATE INDEX "site_pages_blocks_image_image_idx" ON "payload"."site_pages_blocks_image" USING btree ("image_id");
  CREATE INDEX "site_pages_blocks_gallery_images_order_idx" ON "payload"."site_pages_blocks_gallery_images" USING btree ("_order");
  CREATE INDEX "site_pages_blocks_gallery_images_parent_id_idx" ON "payload"."site_pages_blocks_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "site_pages_blocks_gallery_images_image_idx" ON "payload"."site_pages_blocks_gallery_images" USING btree ("image_id");
  CREATE INDEX "site_pages_blocks_gallery_order_idx" ON "payload"."site_pages_blocks_gallery" USING btree ("_order");
  CREATE INDEX "site_pages_blocks_gallery_parent_id_idx" ON "payload"."site_pages_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "site_pages_blocks_gallery_path_idx" ON "payload"."site_pages_blocks_gallery" USING btree ("_path");
  CREATE INDEX "site_pages_blocks_youtube_order_idx" ON "payload"."site_pages_blocks_youtube" USING btree ("_order");
  CREATE INDEX "site_pages_blocks_youtube_parent_id_idx" ON "payload"."site_pages_blocks_youtube" USING btree ("_parent_id");
  CREATE INDEX "site_pages_blocks_youtube_path_idx" ON "payload"."site_pages_blocks_youtube" USING btree ("_path");
  CREATE INDEX "site_pages_blocks_iframe_order_idx" ON "payload"."site_pages_blocks_iframe" USING btree ("_order");
  CREATE INDEX "site_pages_blocks_iframe_parent_id_idx" ON "payload"."site_pages_blocks_iframe" USING btree ("_parent_id");
  CREATE INDEX "site_pages_blocks_iframe_path_idx" ON "payload"."site_pages_blocks_iframe" USING btree ("_path");
  CREATE INDEX "site_pages_sections_order_idx" ON "payload"."site_pages_sections" USING btree ("_order");
  CREATE INDEX "site_pages_sections_parent_id_idx" ON "payload"."site_pages_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_pages_route_idx" ON "payload"."site_pages" USING btree ("route");
  CREATE INDEX "site_pages_updated_at_idx" ON "payload"."site_pages" USING btree ("updated_at");
  CREATE INDEX "site_pages_created_at_idx" ON "payload"."site_pages" USING btree ("created_at");
  CREATE INDEX "site_pages__status_idx" ON "payload"."site_pages" USING btree ("_status");
  CREATE INDEX "site_pages_rels_order_idx" ON "payload"."site_pages_rels" USING btree ("order");
  CREATE INDEX "site_pages_rels_parent_idx" ON "payload"."site_pages_rels" USING btree ("parent_id");
  CREATE INDEX "site_pages_rels_path_idx" ON "payload"."site_pages_rels" USING btree ("path");
  CREATE INDEX "site_pages_rels_users_id_idx" ON "payload"."site_pages_rels" USING btree ("users_id");
  CREATE INDEX "_site_pages_v_version_sections_copy_order_idx" ON "payload"."_site_pages_v_version_sections_copy" USING btree ("_order");
  CREATE INDEX "_site_pages_v_version_sections_copy_parent_id_idx" ON "payload"."_site_pages_v_version_sections_copy" USING btree ("_parent_id");
  CREATE INDEX "_site_pages_v_blocks_text_order_idx" ON "payload"."_site_pages_v_blocks_text" USING btree ("_order");
  CREATE INDEX "_site_pages_v_blocks_text_parent_id_idx" ON "payload"."_site_pages_v_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "_site_pages_v_blocks_text_path_idx" ON "payload"."_site_pages_v_blocks_text" USING btree ("_path");
  CREATE INDEX "_site_pages_v_blocks_image_order_idx" ON "payload"."_site_pages_v_blocks_image" USING btree ("_order");
  CREATE INDEX "_site_pages_v_blocks_image_parent_id_idx" ON "payload"."_site_pages_v_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "_site_pages_v_blocks_image_path_idx" ON "payload"."_site_pages_v_blocks_image" USING btree ("_path");
  CREATE INDEX "_site_pages_v_blocks_image_image_idx" ON "payload"."_site_pages_v_blocks_image" USING btree ("image_id");
  CREATE INDEX "_site_pages_v_blocks_gallery_images_order_idx" ON "payload"."_site_pages_v_blocks_gallery_images" USING btree ("_order");
  CREATE INDEX "_site_pages_v_blocks_gallery_images_parent_id_idx" ON "payload"."_site_pages_v_blocks_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "_site_pages_v_blocks_gallery_images_image_idx" ON "payload"."_site_pages_v_blocks_gallery_images" USING btree ("image_id");
  CREATE INDEX "_site_pages_v_blocks_gallery_order_idx" ON "payload"."_site_pages_v_blocks_gallery" USING btree ("_order");
  CREATE INDEX "_site_pages_v_blocks_gallery_parent_id_idx" ON "payload"."_site_pages_v_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "_site_pages_v_blocks_gallery_path_idx" ON "payload"."_site_pages_v_blocks_gallery" USING btree ("_path");
  CREATE INDEX "_site_pages_v_blocks_youtube_order_idx" ON "payload"."_site_pages_v_blocks_youtube" USING btree ("_order");
  CREATE INDEX "_site_pages_v_blocks_youtube_parent_id_idx" ON "payload"."_site_pages_v_blocks_youtube" USING btree ("_parent_id");
  CREATE INDEX "_site_pages_v_blocks_youtube_path_idx" ON "payload"."_site_pages_v_blocks_youtube" USING btree ("_path");
  CREATE INDEX "_site_pages_v_blocks_iframe_order_idx" ON "payload"."_site_pages_v_blocks_iframe" USING btree ("_order");
  CREATE INDEX "_site_pages_v_blocks_iframe_parent_id_idx" ON "payload"."_site_pages_v_blocks_iframe" USING btree ("_parent_id");
  CREATE INDEX "_site_pages_v_blocks_iframe_path_idx" ON "payload"."_site_pages_v_blocks_iframe" USING btree ("_path");
  CREATE INDEX "_site_pages_v_version_sections_order_idx" ON "payload"."_site_pages_v_version_sections" USING btree ("_order");
  CREATE INDEX "_site_pages_v_version_sections_parent_id_idx" ON "payload"."_site_pages_v_version_sections" USING btree ("_parent_id");
  CREATE INDEX "_site_pages_v_parent_idx" ON "payload"."_site_pages_v" USING btree ("parent_id");
  CREATE INDEX "_site_pages_v_version_version_route_idx" ON "payload"."_site_pages_v" USING btree ("version_route");
  CREATE INDEX "_site_pages_v_version_version_updated_at_idx" ON "payload"."_site_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_site_pages_v_version_version_created_at_idx" ON "payload"."_site_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_site_pages_v_version_version__status_idx" ON "payload"."_site_pages_v" USING btree ("version__status");
  CREATE INDEX "_site_pages_v_created_at_idx" ON "payload"."_site_pages_v" USING btree ("created_at");
  CREATE INDEX "_site_pages_v_updated_at_idx" ON "payload"."_site_pages_v" USING btree ("updated_at");
  CREATE INDEX "_site_pages_v_latest_idx" ON "payload"."_site_pages_v" USING btree ("latest");
  CREATE INDEX "_site_pages_v_autosave_idx" ON "payload"."_site_pages_v" USING btree ("autosave");
  CREATE INDEX "_site_pages_v_rels_order_idx" ON "payload"."_site_pages_v_rels" USING btree ("order");
  CREATE INDEX "_site_pages_v_rels_parent_idx" ON "payload"."_site_pages_v_rels" USING btree ("parent_id");
  CREATE INDEX "_site_pages_v_rels_path_idx" ON "payload"."_site_pages_v_rels" USING btree ("path");
  CREATE INDEX "_site_pages_v_rels_users_id_idx" ON "payload"."_site_pages_v_rels" USING btree ("users_id");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_pages_fk" FOREIGN KEY ("site_pages_id") REFERENCES "payload"."site_pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_site_source_hash_idx" ON "payload"."media" USING btree ("site_source_hash");
  CREATE INDEX "_media_v_version_version_site_source_hash_idx" ON "payload"."_media_v" USING btree ("version_site_source_hash");
  CREATE INDEX "payload_locked_documents_rels_site_pages_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("site_pages_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."site_pages_sections_copy" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."site_pages_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."site_pages_blocks_image" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."site_pages_blocks_gallery_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."site_pages_blocks_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."site_pages_blocks_youtube" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."site_pages_blocks_iframe" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."site_pages_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."site_pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."site_pages_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_site_pages_v_version_sections_copy" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_site_pages_v_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_site_pages_v_blocks_image" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_site_pages_v_blocks_gallery_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_site_pages_v_blocks_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_site_pages_v_blocks_youtube" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_site_pages_v_blocks_iframe" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_site_pages_v_version_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_site_pages_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_site_pages_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."site_pages_sections_copy" CASCADE;
  DROP TABLE "payload"."site_pages_blocks_text" CASCADE;
  DROP TABLE "payload"."site_pages_blocks_image" CASCADE;
  DROP TABLE "payload"."site_pages_blocks_gallery_images" CASCADE;
  DROP TABLE "payload"."site_pages_blocks_gallery" CASCADE;
  DROP TABLE "payload"."site_pages_blocks_youtube" CASCADE;
  DROP TABLE "payload"."site_pages_blocks_iframe" CASCADE;
  DROP TABLE "payload"."site_pages_sections" CASCADE;
  DROP TABLE "payload"."site_pages" CASCADE;
  DROP TABLE "payload"."site_pages_rels" CASCADE;
  DROP TABLE "payload"."_site_pages_v_version_sections_copy" CASCADE;
  DROP TABLE "payload"."_site_pages_v_blocks_text" CASCADE;
  DROP TABLE "payload"."_site_pages_v_blocks_image" CASCADE;
  DROP TABLE "payload"."_site_pages_v_blocks_gallery_images" CASCADE;
  DROP TABLE "payload"."_site_pages_v_blocks_gallery" CASCADE;
  DROP TABLE "payload"."_site_pages_v_blocks_youtube" CASCADE;
  DROP TABLE "payload"."_site_pages_v_blocks_iframe" CASCADE;
  DROP TABLE "payload"."_site_pages_v_version_sections" CASCADE;
  DROP TABLE "payload"."_site_pages_v" CASCADE;
  DROP TABLE "payload"."_site_pages_v_rels" CASCADE;


  DROP INDEX "payload"."media_site_source_hash_idx";
  DROP INDEX "payload"."_media_v_version_version_site_source_hash_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_site_pages_id_idx";
  ALTER TABLE "payload"."media" DROP COLUMN "site_source_hash";
  ALTER TABLE "payload"."_media_v" DROP COLUMN "version_site_source_hash";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "site_pages_id";
  DROP TYPE "payload"."enum_site_pages_blocks_iframe_aspect";
  DROP TYPE "payload"."enum_site_pages_status";
  DROP TYPE "payload"."enum__site_pages_v_blocks_iframe_aspect";
  DROP TYPE "payload"."enum__site_pages_v_version_status";`)
}
