import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { record, sectionKeysAreUnique } from '../../../content/site-content/core.ts';

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

async function main() {
  const filename = process.env.SITE_SEED_MANIFEST;
  const sourceOrigin = process.env.SITE_IMPORT_SOURCE_ORIGIN;
  if (!filename || !sourceOrigin) throw new Error('Set SITE_SEED_MANIFEST and SITE_IMPORT_SOURCE_ORIGIN. No database changes made.');
  const origin = new URL(sourceOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('The source must be one explicit HTTPS origin');
  const manifest = JSON.parse(await readFile(filename, 'utf8'));
  if (!record(manifest) || manifest.schemaVersion !== 1 || !record(manifest.page) || manifest.page.route !== '/' || manifest.page._status !== 'draft' || !sectionKeysAreUnique(manifest.page.sections) || !Array.isArray(manifest.assets) || manifest.assets.length > 40) throw new Error('Invalid homepage seed manifest');
  if (!manifest.page.sections.every((section) => Array.isArray(section.copy) && Array.isArray(section.content) && section.content.length === 0)) throw new Error('Seed sections must have copy arrays and no pre-existing media relationships');
  const positions = new Set();
  for (const asset of manifest.assets) {
    if (!record(asset) || typeof asset.source !== 'string' || typeof asset.slot !== 'string' || typeof asset.sectionKey !== 'string') throw new Error('Invalid asset placement');
    const url = new URL(asset.source);
    if (url.origin !== origin.origin || url.username || url.password || !/^\/(?:_next\/static\/media\/|home\/)/.test(url.pathname)) throw new Error('Assets must come from the approved site static-media or home directory');
    if (!manifest.page.sections.some((section) => section.sectionKey === asset.sectionKey)) throw new Error('Asset refers to an unknown section');
    const key = `${asset.sectionKey}:${asset.slot}`;
    if (positions.has(key)) throw new Error('Duplicate image slot');
    positions.add(key);
  }
  if (process.env.SITE_IMPORT_APPLY !== '1') {
    console.log(`DRY RUN: ${manifest.page.sections.length} homepage sections, ${manifest.assets.length} image placements. No uploads, database writes, or publishing performed.`);
    return;
  }
  if (process.env.NYCMON_SITE_EDITOR !== '1' || process.env.PAYLOAD_PUSH === 'true') throw new Error('Enable the editor only after applying its reviewed migration. PAYLOAD_PUSH must remain off.');
  const { getPayload } = await import('payload');
  const { default: config } = await import('../payload.config.ts');
  const payload = await getPayload({ config });
  try {
    const existing = await payload.find({ collection: 'site-pages', where: { route: { equals: '/' } }, draft: true, limit: 1, depth: 0, overrideAccess: true });
    if (existing.docs.length) throw new Error('A Home page already exists. It was not overwritten, published, or reseeded.');
    for (const asset of manifest.assets) {
      const bytes = await boundedImage(asset.source);
      const [mimetype, extension] = imageType(bytes);
      const digest = createHash('sha256').update(bytes).digest('hex');
      const name = `site-home-${digest.slice(0, 16)}-${randomUUID()}.${extension}`;
      // Do not trust a caller-uploaded file merely because it has the expected name.
      const media = await payload.create({ collection: 'media', data: { alt: asset.alt || `Decorative image for ${asset.slot}`, width: asset.width, height: asset.height }, file: { data: bytes, mimetype, name, size: bytes.length }, overrideAccess: true });
      const section = manifest.page.sections.find((item) => item.sectionKey === asset.sectionKey);
      section.content.push({ blockType: 'image', blockName: asset.slot, slot: asset.slot, image: media.id, alt: asset.alt, decorative: Boolean(asset.decorative), caption: asset.caption, focalX: asset.focalX, focalY: asset.focalY });
    }
    const page = await payload.create({ collection: 'site-pages', data: { ...manifest.page, _status: 'draft' }, draft: true, overrideAccess: true });
    console.log(`Created draft Home page ${page.id}. Review and publish it in Payload. Nothing was published by this script.`);
  } finally {
    if (typeof payload.destroy === 'function') await payload.destroy();
    else if (typeof payload.db.destroy === 'function') await payload.db.destroy();
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Website import failed'); process.exitCode = 1; });
