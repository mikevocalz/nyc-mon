import { describe, expect, it } from 'vitest';
import { withBunnyMediaURLs } from '../../storage/bunnyMedia.ts';

describe('Bunny media URL projection', () => {
  it('returns the Bunny CDN URL as the canonical video URL', () => {
    const doc = {
      id: 1,
      alt: 'battle replay',
      bunnyUrl: 'https://cdn.example.com/battle.mp4',
      filename: 'battle.mp4',
      mimeType: 'video/mp4',
      url: '/api/media/file/battle.mp4',
      filesize: 123,
      width: null,
      height: null,
      focalX: undefined,
      focalY: undefined,
      sizes: {},
    };

    expect(withBunnyMediaURLs(doc).url).toBe(
      'https://cdn.example.com/battle.mp4',
    );
  });

  it('keeps media without a Bunny URL unchanged', () => {
    const doc = {
      id: 2,
      alt: 'local dev',
      filename: 'local.mp4',
      mimeType: 'video/mp4',
      url: '/api/media/file/local.mp4',
      filesize: 123,
      width: null,
      height: null,
      focalX: undefined,
      focalY: undefined,
      sizes: {},
    };

    expect(withBunnyMediaURLs(doc).url).toBe('/api/media/file/local.mp4');
  });

  it('projects Bunny URLs for generated image sizes too', () => {
    const doc = {
      id: 3,
      alt: 'poster',
      bunnyUrl: 'https://cdn.example.com/poster.jpg',
      filename: 'poster.jpg',
      mimeType: 'image/jpeg',
      url: '/api/media/file/poster.jpg',
      thumbnailURL: null,
      filesize: 123,
      width: 1000,
      height: 1000,
      focalX: 50,
      focalY: 50,
      sizes: {
        card: {
          filename: 'poster-640x640.jpg',
          width: 640,
          height: 640,
          mimeType: 'image/jpeg',
          filesize: 42,
          url: '/api/media/file/poster-640x640.jpg',
        },
      },
    };

    const result = withBunnyMediaURLs(doc);
    expect(result.thumbnailURL).toBe('https://cdn.example.com/poster.jpg');
    expect(result.sizes?.card?.url).toBe(
      'https://cdn.example.com/poster-640x640.jpg',
    );
  });
});
