import type { PhotoDistrict } from '@acme/assets/photos';

/** RNW defaults align-content to flex-start; an implicit grid row must stretch. */
export function cityCardLayout(district: PhotoDistrict): string {
  const span = district === 'downtown' ? 'md:col-span-7 md:row-span-2'
    : district === 'megacity' ? 'md:col-span-12' : 'md:col-span-5';
  return `grid content-stretch min-w-0 ${span}`;
}
