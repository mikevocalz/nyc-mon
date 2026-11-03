import { twMerge } from 'tailwind-merge';

/** Default button layout yields to explicit caller utilities after CSS interop. */
export function buttonClassName(className?: string): string {
  return twMerge('inline-flex flex-col', className);
}
