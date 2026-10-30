import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterReadHook,
  FileData,
  PayloadRequest,
  TypeWithID,
} from 'payload';

type IncomingFile = {
  buffer: Buffer;
  filename: string;
  filesize: number;
  mimeType: string;
};

const configured = Boolean(
  process.env.BUNNY_STORAGE_ZONE &&
    process.env.BUNNY_STORAGE_PASSWORD &&
    process.env.BUNNY_CDN_URL,
);

if (process.env.NODE_ENV === 'production' && !configured) {
  throw new Error('Bunny Storage must be configured in production.');
}

const storageHost = (region?: string) =>
  region && region !== 'default'
    ? `https://${region}.storage.bunnycdn.com`
    : 'https://storage.bunnycdn.com';

const objectURL = (filename: string) => {
  const base = process.env.BUNNY_CDN_URL!.replace(/\/$/, '');
  return `${base}/${filename
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
};

const storageURL = (filename: string) => {
  const zone = process.env.BUNNY_STORAGE_ZONE!;
  const host = storageHost(process.env.BUNNY_STORAGE_REGION);
  return `${host}/${encodeURIComponent(zone)}/${filename
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
};

const getKey = (filename: string) =>
  filename.replace(/^\/+/, '').replace(/\\/g, '/');

const getIncomingFiles = (
  data: Partial<FileData>,
  req: PayloadRequest,
): IncomingFile[] => {
  const file = req.file;
  const uploadSizes = req.payloadUploadSizes;
  if (!file || !data.filename || !data.mimeType) return [];

  const files: IncomingFile[] = [
    {
      buffer: file.data,
      filename: data.filename,
      filesize: file.size,
      mimeType: data.mimeType,
    },
  ];

  if (data.variants) {
    for (const [sizeName, resized] of Object.entries(data.variants)) {
      const buffer = uploadSizes?.[sizeName];
      if (buffer && resized?.mimeType && resized.filename) {
        files.push({
          buffer,
          filename: resized.filename,
          filesize: buffer.length,
          mimeType: resized.mimeType,
        });
      }
    }
  }

  return files;
};

/** Media keeps the zone root; every other upload collection gets its own folder so filenames never collide. */
const keyFor = (slug: string, filename: string) =>
  slug === 'media' ? getKey(filename) : `${slug}/${getKey(filename)}`;

const uploadFile = async (slug: string, file: IncomingFile) => {
  const filename = keyFor(slug, file.filename);
  const response = await fetch(storageURL(filename), {
    method: 'PUT',
    headers: {
      AccessKey: process.env.BUNNY_STORAGE_PASSWORD!,
      'Content-Type': file.mimeType || 'application/octet-stream',
    },
    body: new Uint8Array(file.buffer),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Bunny Storage upload failed (${response.status}): ${detail || response.statusText}`,
    );
  }

  return objectURL(filename);
};

const deleteFile = async (slug: string, filename: string) => {
  const response = await fetch(storageURL(keyFor(slug, filename)), {
    method: 'DELETE',
    headers: { AccessKey: process.env.BUNNY_STORAGE_PASSWORD! },
  });

  if (!response.ok && response.status !== 404) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Bunny Storage delete failed (${response.status}): ${detail || response.statusText}`,
    );
  }
};

const filenamesFor = (doc: Partial<FileData>) => {
  const filenames: string[] = [];
  if (typeof doc.filename === 'string') filenames.push(doc.filename);

  if (doc.variants && typeof doc.variants === 'object') {
    for (const size of Object.values(doc.variants)) {
      if (size?.filename && typeof size.filename === 'string') {
        filenames.push(size.filename);
      }
    }
  }

  return filenames;
};

export const bunnyMediaAfterChange: CollectionAfterChangeHook<
  FileData & TypeWithID
> = async ({ collection, doc, operation, previousDoc, req }) => {
  if (req.context?.skipBunnyMedia || !configured) return doc;

  const files = getIncomingFiles(doc, req);
  if (files.length === 0) return doc;

  const uploaded = await Promise.all(files.map((file) => uploadFile(collection.slug, file)));
  const mainURL = uploaded[0];

  req.context.skipBunnyMedia = true;
  req.file = undefined;
  req.payloadUploadSizes = undefined;

  try {
    await req.payload.update({
      collection: collection.slug as 'media',
      id: doc.id,
      data: { bunnyUrl: mainURL },
      // This trusted hook persists its own computed URL after the outer write was authorized.
      // Payload 4 defaults Local API access enforcement on, including service imports with no user.
      overrideAccess: true,
      depth: 0,
      req,
    });
  } finally {
    delete req.context.skipBunnyMedia;
  }

  if (previousDoc && operation === 'update') {
    const previousFiles = filenamesFor(previousDoc);
    const newFiles = new Set(filenamesFor(doc));
    // Best effort: the new file and row are already saved, so a failed delete
    // leaves an orphan on Bunny instead of rolling back the replacement.
    await Promise.all(
      previousFiles
        .filter((filename) => !newFiles.has(filename))
        .map((filename) => deleteFile(collection.slug, filename).catch((error: unknown) => {
          req.payload.logger.warn({ err: error, filename }, 'Bunny Storage delete of a replaced file failed');
        })),
    );
  }

  return withBunnyMediaURLs({ ...doc, bunnyUrl: mainURL });
};

export const bunnyMediaAfterDelete: CollectionAfterDeleteHook<
  FileData & TypeWithID
> = async ({ collection, doc }) => {
  if (!configured) return;

  await Promise.all(filenamesFor(doc).map((filename) => deleteFile(collection.slug, filename)));
};


type BunnyReadableMedia = FileData &
  TypeWithID & {
    bunnyUrl?: string | null;
    thumbnailURL?: string | null;
    url?: string | null;
  };

/**
 * Payload's built-in upload fields generate /api/media/file/:filename URLs.
 * With disableLocalStorage those routes have no bytes unless a real storage
 * adapter supplies a static handler. NYC-Mon serves Bunny media publicly, so
 * expose the CDN URL as the canonical Payload `url` on read.
 *
 * This is especially important for video/audio previews, which consume
 * `media.url` rather than `adminThumbnail`.
 */
/**
 * Resolve an image variant from the public URL already persisted on the
 * record. Unlike objectURL(), reading media must not require upload credentials
 * or BUNNY_CDN_URL: the persisted Bunny URL is authoritative.
 */
function projectedSizeURL(publicURL: string, sourceFilename: string | undefined, sizeFilename: string): string {
  const url = new URL(publicURL);
  const escaped = (name: string) => getKey(name).split('/').map(encodeURIComponent).join('/');
  const sourceKey = sourceFilename ? escaped(sourceFilename) : '';
  const dir = sourceKey && url.pathname.endsWith(`/${sourceKey}`)
    ? url.pathname.slice(0, -sourceKey.length)
    : url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
  url.pathname = dir + escaped(sizeFilename);
  return url.href;
}

export const withBunnyMediaURLs = <T extends BunnyReadableMedia>(doc: T): T => {
  const publicURL = doc.bunnyUrl;
  if (typeof publicURL !== 'string' || publicURL.length === 0) return doc;

  const variants =
    doc.variants && typeof doc.variants === 'object'
      ? Object.fromEntries(
          Object.entries(doc.variants).map(([name, size]) => {
            if (
              size &&
              typeof size === 'object' &&
              'filename' in size &&
              typeof size.filename === 'string'
            ) {
              return [name, { ...size, url: projectedSizeURL(publicURL, doc.filename, size.filename) }];
            }
            return [name, size];
          }),
        )
      : doc.variants;

  return {
    ...doc,
    url: publicURL,
    ...(doc.mimeType?.startsWith('image/') ? { thumbnailURL: publicURL } : {}),
    ...(variants ? { variants } : {}),
  };
};

export const bunnyMediaAfterRead: CollectionAfterReadHook<BunnyReadableMedia> = ({
  doc,
}) => withBunnyMediaURLs(doc);
