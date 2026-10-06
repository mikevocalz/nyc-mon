import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
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

  if (data.sizes) {
    for (const [sizeName, resized] of Object.entries(data.sizes)) {
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

const uploadFile = async (file: IncomingFile) => {
  const filename = getKey(file.filename);
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

const deleteFile = async (filename: string) => {
  const response = await fetch(storageURL(getKey(filename)), {
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

  if (doc.sizes && typeof doc.sizes === 'object') {
    for (const size of Object.values(doc.sizes)) {
      if (size?.filename && typeof size.filename === 'string') {
        filenames.push(size.filename);
      }
    }
  }

  return filenames;
};

export const bunnyMediaAfterChange: CollectionAfterChangeHook<
  FileData & TypeWithID
> = async ({ doc, operation, previousDoc, req }) => {
  if (req.context?.skipBunnyMedia || !configured) return doc;

  const files = getIncomingFiles(doc, req);
  if (files.length === 0) return doc;

  const uploaded = await Promise.all(files.map(uploadFile));
  const mainURL = uploaded[0];

  req.context.skipBunnyMedia = true;
  req.file = undefined;
  req.payloadUploadSizes = undefined;

  try {
    await req.payload.update({
      collection: 'media',
      id: doc.id,
      data: { bunnyUrl: mainURL },
      depth: 0,
      req,
    });
  } finally {
    delete req.context.skipBunnyMedia;
  }

  if (previousDoc && operation === 'update') {
    const previousFiles = filenamesFor(previousDoc);
    const newFiles = new Set(filenamesFor(doc));
    await Promise.all(
      previousFiles
        .filter((filename) => !newFiles.has(filename))
        .map(deleteFile),
    );
  }

  return { ...doc, bunnyUrl: mainURL };
};

export const bunnyMediaAfterDelete: CollectionAfterDeleteHook<
  FileData & TypeWithID
> = async ({ doc }) => {
  if (!configured) return;

  await Promise.all(filenamesFor(doc).map(deleteFile));
};
