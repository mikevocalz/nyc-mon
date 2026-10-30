import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { record, safeRoute, sectionKeysAreUnique } from '../../../content/site-content/core.ts';

// Run with the repository's Payload CLI. Dry-run by default; no automatic publish or overwrite.
const maxBytes = 12 * 1024 * 1024;
function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ['image/png', 'png'];
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ['image/jpeg', 'jpg'];
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())) return ['image/gif', 'gif'];
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return ['image/webp', 'webp'];
  if (bytes.subarray(4, 8).toString() === 'ftyp' && ['avif', 'avis'].includes(bytes.subarray(8, 12).toString())) return ['image/avif', 'avif'];
  throw new Error('Source is not a supported raster image');
}
async function boundedImage(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok || !response.body) throw new Error(`Asset fetch failed: ${response.status}`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Source image exceeds 12 MB');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('Source image exceeds 12 MB'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
}

export function validateSiteManifest(manifest, sourceOrigin) {
  const origin = new URL(sourceOrigin);
  const localTest = process.env.NODE_ENV !== 'production' && process.env.SITE_IMPORT_LOCAL_TEST === '1' && origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname);
  if ((!localTest && origin.protocol !== 'https:') || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Set one explicit HTTPS source origin.');
  if (!record(manifest) || manifest.schemaVersion !== 2 || !Array.isArray(manifest.pages) || manifest.pages.length < 1 || manifest.pages.length > 50) throw new Error('Invalid site seed manifest');
  const routes = new Set();
  for (const document of manifest.pages) {
    if (!record(document) || !record(document.page) || !safeRoute(document.page.route) || document.page._status !== 'draft' || !sectionKeysAreUnique(document.page.sections) || !Array.isArray(document.assets) || document.assets.length > 100) throw new Error('Invalid page seed');
    if (routes.has(document.page.route)) throw new Error('Duplicate page route'); routes.add(document.page.route);
    if (!document.page.sections.every(section => Array.isArray(section.copy) && section.copy.length <= 100 && Array.isArray(section.content) && section.content.length === 0)) throw new Error('Seeds must contain copy and empty image relationships only');
    const positions = new Set();
    for (const asset of document.assets) {
      if (!record(asset) || typeof asset.source !== 'string' || typeof asset.slot !== 'string' || !/^[a-z][a-z0-9.-]{0,99}$/.test(asset.slot) || typeof asset.sectionKey !== 'string') throw new Error('Invalid image placement');
      const url = new URL(asset.source);
      if (url.origin !== origin.origin || url.username || url.password || !/^\/(?:_next\/static\/(?:immutable\/)?media\/|home\/)/.test(url.pathname) || url.hash || url.search) throw new Error('Images must come from the approved site static media directories');
      if (!document.page.sections.some(section => section.sectionKey === asset.sectionKey)) throw new Error('Unknown image section');
      const key = `${asset.sectionKey}:${asset.slot}`; if (positions.has(key)) throw new Error('Duplicate image position'); positions.add(key);
    }
  }
  return manifest;
}

/** Explicit operator import; repeat runs skip existing documents, never overwrite or publish them. */
export async function importSite() {
  const file = process.env.SITE_SEED_MANIFEST, source = process.env.SITE_IMPORT_SOURCE_ORIGIN;
  if (!file || !source) throw new Error('Set SITE_SEED_MANIFEST and SITE_IMPORT_SOURCE_ORIGIN.');
  const manifest = validateSiteManifest(JSON.parse(await readFile(file, 'utf8')), source);
  const total = manifest.pages.reduce((sum, document) => sum + document.assets.length, 0);
  if (process.env.SITE_IMPORT_APPLY !== '1') {
    console.log(`DRY RUN: ${manifest.pages.length} pages and ${total} image placements. No writes or uploads.`);
    return;
  }
  if (process.env.NYCMON_SITE_EDITOR !== '1' || process.env.PAYLOAD_PUSH === 'true') throw new Error('Apply the reviewed migration first; PAYLOAD_PUSH must be off.');
  if (process.env.NODE_ENV === 'production' && !(process.env.BUNNY_STORAGE_ZONE && process.env.BUNNY_STORAGE_PASSWORD && process.env.BUNNY_CDN_URL)) throw new Error('Bunny must be configured.');
  const {getPayload} = await import('payload'); const {default: config} = await import('../payload.config.ts');
  const payload = await getPayload({config}); const mediaByDigest = new Map();
  try {
    for (const document of manifest.pages) {
      const {page, assets} = structuredClone(document);
      const existing = await payload.find({collection: 'site-pages', where: {route: {equals: page.route}}, draft: true, limit: 1, depth: 0, overrideAccess: true});
      if (existing.docs.length) { console.log(`SKIPPED existing ${page.route}`); continue; }
      for (const asset of assets) {
        const bytes = await boundedImage(asset.source); const [mimetype, extension] = imageType(bytes);
        const digest = createHash('sha256').update(bytes).digest('hex'); let media = mediaByDigest.get(digest);
        if (!media) {
          media = await payload.create({collection: 'media', data: {alt: asset.alt || `Decorative image: ${asset.slot}`, width: asset.width, height: asset.height}, file: {data: bytes, mimetype, name: `website-${digest.slice(0,16)}-${randomUUID()}.${extension}`, size: bytes.length}, overrideAccess: true});
          if (process.env.BUNNY_CDN_URL && (!media.url || !media.url.startsWith(process.env.BUNNY_CDN_URL.replace(/\/$/, '') + '/'))) throw new Error('Uploaded image did not resolve to the configured CDN');
          mediaByDigest.set(digest, media);
        }
        const section = page.sections.find(row => row.sectionKey === asset.sectionKey);
        section.content.push({blockType: 'image', blockName: asset.slot, slot: asset.slot, image: media.id, alt: asset.alt, decorative: Boolean(asset.decorative), caption: asset.caption, focalX: asset.focalX, focalY: asset.focalY});
      }
      const created = await payload.create({collection: 'site-pages', data: {...page, _status: 'draft'}, draft: true, overrideAccess: true});
      console.log(`DRAFT ${page.route} (${created.id}), ${assets.length} image placements`);
    }
    console.log('Import complete. Existing pages were not overwritten. All new pages remain drafts.');
  } finally { await payload.destroy(); }
}
if (process.argv[1]?.endsWith('import-site.mjs') || process.env.SITE_IMPORT_RUN === '1') await importSite().catch(error => { console.error(error instanceof Error ? error.message : 'Site import failed'); process.exitCode = 1; });
