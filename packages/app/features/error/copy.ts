/**
 * Every string on the error and not-found screens (app and site share them).
 * Plain language: say what happened and the way out.
 */
export const ERROR_COPY = {
  'error.not_found.code': '404',
  'error.not_found.title': 'Page not found',
  'error.not_found.body': 'The page you are looking for does not exist or has moved.',
  'error.failed.code': '!',
  'error.failed.title': 'Something went wrong',
  'error.failed.body': 'An unexpected error occurred. Try again in a moment.',
  'error.retry': 'Try again',
  'error.home': 'Back to Home',
  'error.back': 'Go back',
} as const;

export type ErrorCopyId = keyof typeof ERROR_COPY;

export const errorCopy = (id: ErrorCopyId): string => ERROR_COPY[id];
