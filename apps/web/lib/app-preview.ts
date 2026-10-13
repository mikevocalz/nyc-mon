/**
 * The template app screens (/explore, /profile, /settings, /schedule,
 * /notifications) render demo people and counts ("Nina Alvarez", "1.2k
 * Followers"). They are not NYC-MON features and must not be public: in a
 * production build they 404 unless NYCMON_APP_PREVIEW=1 opts a preview
 * deployment in. Development builds keep them for kit work.
 *
 * Build-time flag: these layouts are prerendered, so NYCMON_APP_PREVIEW must be
 * set when `next build` runs; setting it only at runtime changes nothing.
 */
export function appPreviewEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.NYCMON_APP_PREVIEW === '1';
}
