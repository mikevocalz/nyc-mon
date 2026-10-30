import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CollectionBeforeChangeHook } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import { MonArt } from '../MonArt.ts';
import { checkMonArtAlt, checkMonArtFile, MON_ART_MAX_BYTES, readImageFacts } from '../monArtFile.ts';
import { monArtAfterChange, monArtAfterDelete, revalidateMonArt } from '../monArtRevalidate.ts';
import { fakeReq, staff } from './helpers.ts';

const asset = (name: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`../../../../assets/creatures/${name}`, import.meta.url))));
const fyeDot = asset('fye-dot.webp');

/** PNG signature and an IHDR chunk for a 640×800 picture. */
function png(width = 640, height = 800): Uint8Array {
  const out = new Uint8Array(33);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(out.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return out;
}

/** SOI, an APP0 segment, then a baseline SOF0 for 960×1200. */
function jpeg(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0xb0, 0x03, 0xc0, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]);
}

describe('mon-art file rules', () => {
  it('takes WebP, PNG and JPEG up to 4 MB and nothing else', () => {
    expect(checkMonArtFile({ name: 'fye-dot.webp', size: 10 })).toEqual({ ok: true, mimeType: 'image/webp' });
    expect(checkMonArtFile({ name: 'FYE.JPG', size: 10 })).toEqual({ ok: true, mimeType: 'image/jpeg' });
    expect(checkMonArtFile({ name: 'fye.png', size: MON_ART_MAX_BYTES })).toMatchObject({ ok: true });
    expect(checkMonArtFile({ name: 'fye.png', size: MON_ART_MAX_BYTES + 1 })).toEqual({ ok: false, problem: 'size' });
    expect(checkMonArtFile({ name: 'fye.png', size: 0 })).toEqual({ ok: false, problem: 'empty' });
    expect(checkMonArtFile({ name: 'fye.gif', size: 10 })).toEqual({ ok: false, problem: 'type' });
    expect(checkMonArtFile({ name: 'fye.svg', size: 10 })).toEqual({ ok: false, problem: 'type' });
  });

  it('reads the type and pixel size from the bytes', () => {
    expect(readImageFacts(fyeDot)).toEqual({ mimeType: 'image/webp', width: 960, height: 1200 });
    expect(readImageFacts(png())).toEqual({ mimeType: 'image/png', width: 640, height: 800 });
    expect(readImageFacts(jpeg())).toEqual({ mimeType: 'image/jpeg', width: 960, height: 1200 });
    expect(readImageFacts(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
  });

  it('requires alt text', () => {
    expect(checkMonArtAlt('Fye Dot, a spotted hopper Mon.')).toBe(true);
    expect(checkMonArtAlt('  ')).toBe(false);
    expect(checkMonArtAlt(undefined)).toBe(false);
  });
});

describe('mon-art beforeChange', () => {
  const hook = MonArt.hooks!.beforeChange![0] as CollectionBeforeChangeHook;
  const run = (data: Record<string, unknown>, file?: Uint8Array, name = 'fye-dot.webp', originalDoc?: Record<string, unknown>) => {
    const { req } = fakeReq({ user: staff('content') });
    if (file) req.file = { data: Buffer.from(file), size: file.length, name, mimetype: 'image/webp' };
    return hook({ data, req, operation: originalDoc ? 'update' : 'create', context: {}, collection: {} as never, originalDoc: originalDoc as never });
  };

  it('fills the form facts and the picture size, names the file freshly and resets review', async () => {
    const data = await run({ speciesId: 'dex-021', alt: 'Fye Dot on a stoop.', status: 'approved' }, fyeDot);
    expect(data).toMatchObject({ stage: 'Baby', bloodlineId: 'F04', width: 960, height: 1200, mimeType: 'image/webp', status: 'in-review' });
    expect(data.filename).toMatch(/^dex-021-[a-z0-9]+\.webp$/);
  });

  it('keeps the saved alt text when only the status changes', async () => {
    await expect(run({ status: 'approved' }, undefined, undefined, { speciesId: 'dex-021', alt: 'Fye Dot on a stoop.' })).resolves.toMatchObject({ status: 'approved' });
  });

  it('rejects a missing alt, an unknown form, a wrong type and bytes that are not a picture', async () => {
    await expect(run({ speciesId: 'dex-021', alt: '' }, fyeDot)).rejects.toThrow(/screen reader/);
    await expect(run({ speciesId: 'nope', alt: 'Fye Dot.' }, fyeDot)).rejects.toThrow(/roster/);
    await expect(run({ speciesId: 'dex-021', alt: 'Fye Dot.' }, fyeDot, 'fye.gif')).rejects.toThrow(/WebP, PNG or JPEG/);
    await expect(run({ speciesId: 'dex-021', alt: 'Fye Dot.' }, new TextEncoder().encode('<html>not a picture</html>'), 'fye.png')).rejects.toThrow(/not a WebP, PNG or JPEG/);
  });

  it('only ops and content write; staff read everything; everyone else reads approved stills', () => {
    const access = MonArt.access!;
    const reqFor = (role: string) => fakeReq({ user: staff(role as never) }).req;
    expect(access.create!({ req: reqFor('content') } as never)).toBe(true);
    expect(access.update!({ req: reqFor('support') } as never)).toBe(false);
    expect(access.read!({ req: reqFor('support') } as never)).toBe(true);
    expect(access.read!({ req: fakeReq({ user: null }).req } as never)).toEqual({ status: { equals: 'approved' } });
  });
});

describe('mon-art revalidation', () => {
  const env = { MON_ART_REVALIDATE_URL: 'https://nyc-mon.city/api/mon-art/revalidate, https://preview.example.test/api/mon-art/revalidate', MON_ART_REVALIDATE_SECRET: 's3cret' };
  const logger = () => ({ payload: { logger: { warn: vi.fn() } } }) as never;

  it('posts the shared secret to every site URL', async () => {
    const send = vi.fn(async () => new Response('{}', { status: 200 }));
    await expect(revalidateMonArt(logger(), env, send as never)).resolves.toBe(2);
    expect(send).toHaveBeenCalledWith('https://nyc-mon.city/api/mon-art/revalidate', expect.objectContaining({ method: 'POST', headers: { 'x-revalidate-secret': 's3cret' } }));
  });

  it('skips without configuration and never throws when a site is down', async () => {
    const send = vi.fn(async () => new Response('', { status: 503 }));
    await expect(revalidateMonArt(logger(), {}, send as never)).resolves.toBe(0);
    expect(send).not.toHaveBeenCalled();
    const req = logger();
    await expect(revalidateMonArt(req, env, send as never)).resolves.toBe(0);
    expect((req as { payload: { logger: { warn: ReturnType<typeof vi.fn> } } }).payload.logger.warn).toHaveBeenCalledTimes(2);
  });

  it('runs after a save and a delete, after the Bunny hook, and not for the hook\'s own URL write', async () => {
    expect(MonArt.hooks!.afterChange!.at(-1)).toBe(monArtAfterChange);
    expect(MonArt.hooks!.afterDelete!.at(-1)).toBe(monArtAfterDelete);
    const original = { ...process.env };
    process.env.MON_ART_REVALIDATE_URL = 'https://nyc-mon.city/api/mon-art/revalidate';
    process.env.MON_ART_REVALIDATE_SECRET = 's3cret';
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    try {
      const doc = { id: 1 };
      await monArtAfterChange({ doc, req: logger(), context: {} } as never);
      expect(send).toHaveBeenCalledTimes(1);
      await monArtAfterChange({ doc, req: logger(), context: { skipBunnyMedia: true } } as never);
      expect(send).toHaveBeenCalledTimes(1);
      await monArtAfterDelete({ doc, req: logger() } as never);
      expect(send).toHaveBeenCalledTimes(2);
    } finally {
      send.mockRestore();
      process.env = original;
    }
  });
});
