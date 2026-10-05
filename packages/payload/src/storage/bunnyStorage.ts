import type { Adapter } from '@payloadcms/plugin-cloud-storage/types';
import { getFilePrefix } from '@payloadcms/plugin-cloud-storage/utilities';
import path from 'node:path';

type BunnyStorageConfig = {
  zone: string;
  accessKey: string;
  cdnUrl: string;
  region?: string;
};

const storageHost = (region?: string) =>
  region && region !== 'default'
    ? `https://${region}.storage.bunnycdn.com`
    : 'https://storage.bunnycdn.com';

const cleanCdnUrl = (url: string) => url.replace(/\/$/, '');

export const bunnyStorage = ({
  zone,
  accessKey,
  cdnUrl,
  region,
}: BunnyStorageConfig): Adapter => {
  const host = storageHost(region);
  const publicBase = cleanCdnUrl(cdnUrl);

  return ({ collection, prefix = '' }) => {
    const key = (filename: string) => path.posix.join(prefix, filename);

    return {
      name: 'bunny',
      handleUpload: async ({ file }) => {
        const objectKey = key(file.filename);
        const response = await fetch(
          `${host}/${encodeURIComponent(zone)}/${objectKey
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`,
          {
            method: 'PUT',
            headers: {
              AccessKey: accessKey,
              'Content-Type': file.mimeType || 'application/octet-stream',
            },
            body: file.buffer,
          },
        );

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error(
            `Bunny Storage upload failed (${response.status}): ${detail || response.statusText}`,
          );
        }
      },
      handleDelete: async ({ filename, doc }) => {
        const documentPrefix =
          typeof doc === 'object' &&
          doc !== null &&
          'prefix' in doc &&
          typeof doc.prefix === 'string'
            ? doc.prefix
            : prefix;
        const objectKey = path.posix.join(documentPrefix || '', filename);
        const response = await fetch(
          `${host}/${encodeURIComponent(zone)}/${objectKey
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`,
          {
            method: 'DELETE',
            headers: { AccessKey: accessKey },
          },
        );

        if (!response.ok && response.status !== 404) {
          const detail = await response.text().catch(() => '');
          throw new Error(
            `Bunny Storage delete failed (${response.status}): ${detail || response.statusText}`,
          );
        }
      },
      generateURL: ({ filename, prefix: documentPrefix = '' }) => {
        const objectKey = path.posix.join(documentPrefix || prefix, filename);
        return `${publicBase}/${objectKey
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`;
      },
      staticHandler: async (req, { params }) => {
        const resolvedPrefix = await getFilePrefix({
          req,
          collection,
        });
        const objectKey = path.posix.join(
          resolvedPrefix || prefix,
          params.filename,
        );
        const response = await fetch(
          `${host}/${encodeURIComponent(zone)}/${objectKey
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`,
          {
            headers: {
              AccessKey: accessKey,
              ...(req.headers.get('range') ? { Range: req.headers.get('range')! } : {}),
            },
          },
        );

        if (!response.ok) {
          return new Response(null, {
            status: response.status,
            statusText: response.statusText,
          });
        }

        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        });
      },
    };
  };
};
