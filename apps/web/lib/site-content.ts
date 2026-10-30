import 'server-only';
import { cache } from 'react';
import { activePreview, previewDocument } from './site-preview';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { readSitePage } from '@acme/content/site-content';

export const siteEditorEnabled = () => process.env.NYCMON_SITE_EDITOR === '1';
export const bootstrapContent = () => process.env.SITE_CONTENT_MODE === 'bootstrap';
export const getSitePage = cache(async (route: string) => {
  if (!siteEditorEnabled()) return null;
  if (!process.env.PAYLOAD_SITE_API_URL) throw new Error('PAYLOAD_SITE_API_URL is required when the website editor is enabled.');
  const preview = await activePreview();
  if (preview?.grant.route === route) return (await previewDocument(preview)).page;
  return readSitePage(process.env.PAYLOAD_SITE_API_URL, route);
});
export async function getPublishedSitePage(route: string) {
  const page = await getSitePage(route);
  if (!page && siteEditorEnabled() && !bootstrapContent()) notFound();
  return page;
}
export async function siteMetadata(route: string, fallback: Metadata): Promise<Metadata> {
  const page = await getPublishedSitePage(route);
  const preview = await activePreview();
  return {...fallback, ...(preview ? {robots: {index: false, follow: false}} : {}), ...(page?.seo.title ? {title: {absolute: page.seo.title}} : {}),
    ...(page?.seo.description ? {description: page.seo.description} : {})};
}
export const siteEmbedOrigins = () => (process.env.SITE_EMBED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean);
export const siteOrigin = () => process.env.NEXT_PUBLIC_SITE_URL ?? '';
