import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Fetch data only. Existing mismatches fail instead of replacing pins. */
export async function fetchPinnedTextures(pinFile) {
  const pins = JSON.parse(await readFile(pinFile, 'utf8'));
  if (!/^[a-f0-9]{40}$/.test(pins.revision)) throw new Error('Texture dataset revision must be immutable');
  for (const [source, expected] of Object.entries(pins.files)) {
    if (!source.startsWith('Content/textures/') || source.includes('..') || !/^[a-f0-9]{64}$/.test(expected.sha256) || !Number.isSafeInteger(expected.bytes) || expected.bytes < 1) throw new Error(`Invalid texture pin: ${source}`);
    const target = new URL(`../.cache/valdrada-textures/${source.slice('Content/textures/'.length)}`, import.meta.url);
    const valid = bytes => bytes.length === expected.bytes && createHash('sha256').update(bytes).digest('hex') === expected.sha256;
    let cached;
    try { cached = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (cached) {
      if (!valid(cached)) throw new Error(`Cached texture checksum mismatch: ${source}`);
      continue;
    }
    const response = await fetch(`${pins.repo}/resolve/${pins.revision}/${source}`, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Texture HTTP ${response.status}: ${source}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!valid(bytes)) throw new Error(`Texture checksum mismatch: ${source}`);
    await mkdir(dirname(fileURLToPath(target)), { recursive: true });
    const temporary = new URL(`${target.href}.${process.pid}.tmp`);
    try { await writeFile(temporary, bytes); await rename(temporary, target); }
    finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
}
