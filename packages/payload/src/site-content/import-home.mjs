import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { validateWebsiteSeed } from '../../../content/site-content/seed.ts';

// Retained command path for compatibility. Version 2 imports the complete website.
// Dry run is the default. The script never overwrites a page or publishes content.
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
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000), credentials: 'omit' });
  if (!response.ok || !response.body) throw new Error(`Asset fetch failed: ${response.status} ${url}`);
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
async function main() {
  const filename = process.env.SITE_SEED_MANIFEST, sourceOrigin = process.env.SITE_IMPORT_SOURCE_ORIGIN;
  if (!filename || !sourceOrigin) throw new Error('Set SITE_SEED_MANIFEST and SITE_IMPORT_SOURCE_ORIGIN');
  const manifest = JSON.parse(await readFile(filename, 'utf8'));
  const pages = validateWebsiteSeed(manifest, sourceOrigin, process.env.SITE_IMPORT_ALLOW_LOCAL_TEST === '1' && process.env.NODE_ENV !== 'production');
  const assets = new Map();
  // Verify every unique source before opening the database, even during dry run.
  for (const entry of pages) for (const asset of entry.assets) {
    if (assets.has(asset.source)) continue;
    const bytes = await boundedImage(asset.source);
    const [mimetype, extension] = imageType(bytes);
    assets.set(asset.source, { bytes, mimetype, extension, digest: createHash('sha256').update(bytes).digest('hex') });
  }
  const report = { pages: pages.length, placements: pages.reduce((n, p) => n + p.assets.length, 0), uniqueSources: assets.size, created: [], skipped: [], published: false };
  if (process.env.SITE_IMPORT_APPLY !== '1') {
    console.log(`DRY RUN: verified ${report.pages} pages, ${report.placements} placements, ${report.uniqueSources} source images. No writes or publishing.`);
    return;
  }
  if (process.env.NYCMON_SITE_EDITOR !== '1' || process.env.PAYLOAD_PUSH === 'true') throw new Error('Apply the reviewed migration first; enable the admin editor and leave PAYLOAD_PUSH off');
  const { getPayload } = await import('payload');
  const { default: config } = await import('../payload.config.ts');
  const payload = await getPayload({ config });
  const uploaded = new Map();
  try {
    const actorId = process.env.SITE_IMPORT_ACTOR_ID;
    if (!actorId) throw new Error('SITE_IMPORT_ACTOR_ID must identify an existing ops/content staff member');
    const actor = await payload.findByID({ collection: 'users', id: actorId, overrideAccess: true });
    if (!['ops', 'content'].includes(actor.role)) throw new Error('The import actor must be ops or content staff');
    for (const entry of pages) {
      const existing = await payload.find({ collection: 'site-pages', where: { route: { equals: entry.page.route } }, draft: true, limit: 1, depth: 0, overrideAccess: true, user: actor });
      if (existing.docs.length) { report.skipped.push({ route: entry.page.route, id: existing.docs[0].id }); continue; }
      for (const asset of entry.assets) {
        const file = assets.get(asset.source);
        let media = uploaded.get(file.digest);
        if (!media) {
          // The fingerprint field cannot be set through REST by any role; only this trusted import writes it.
          const reused = await payload.find({ collection: 'media', where: { siteSourceHash: { equals: file.digest } }, limit: 1, depth: 0, overrideAccess: true, user: actor });
          media = reused.docs[0];
          if (!media) media = await payload.create({ collection: 'media', data: { alt: asset.alt || `Decorative website image: ${asset.slot}`, width: asset.width, height: asset.height, siteSourceHash: file.digest }, file: { data: file.bytes, mimetype: file.mimetype, name: `website-${file.digest.slice(0, 16)}-${randomUUID()}.${file.extension}`, size: file.bytes.length }, overrideAccess: true, user: actor });
          uploaded.set(file.digest, media);
        }
        const section = entry.page.sections.find((item) => item.sectionKey === asset.sectionKey);
        section.content.push({ blockType: 'image', blockName: asset.slot, slot: asset.slot, image: media.id, alt: asset.alt, decorative: asset.decorative, caption: asset.caption, focalX: asset.focalX, focalY: asset.focalY });
      }
      const page = await payload.create({ collection: 'site-pages', data: entry.page, draft: true, overrideAccess: true, user: actor });
      report.created.push({ route: entry.page.route, id: page.id });
    }
    console.log(JSON.stringify(report, null, 2));
    if (process.env.SITE_IMPORT_REPORT) await writeFile(process.env.SITE_IMPORT_REPORT, JSON.stringify(report, null, 2));
  } finally { await payload.destroy(); }
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : 'Website import failed'); process.exitCode = 1; }
