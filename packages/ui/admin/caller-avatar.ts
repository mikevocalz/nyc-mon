/** Only normal image URLs may be used by the staff console; never HTML or script URLs. */
export function safeCallerAvatarSource(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const source = value.trim();
  if (!source || /[\u0000-\u0020\\]/.test(source)) return null;
  if (source.startsWith('/')) return source.startsWith('//') ? null : source;
  try {
    const url = new URL(source);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** Failure is keyed to the URL, so changing the user's photo tries the new image. */
export function callerAvatarPresentation(image: unknown, failedSource: string | null, userId: string) {
  const source = safeCallerAvatarSource(image);
  const visibleSource = source && source !== failedSource ? source : null;
  return {
    source: visibleSource,
    label: visibleSource ? `Profile photo for user ${userId}` : `No profile photo for user ${userId}`,
  };
}
