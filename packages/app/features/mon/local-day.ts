/**
 * The local calendar day of an instant as ISO `YYYY-MM-DD`, in the device's
 * time zone (M18 day boundaries). The journal and DaysCalendar key days by it.
 * Its own module so journal-model.ts (and the Alexa Mon card that bundles it)
 * does not pull in the Mon store and the full `@acme/content` roster.
 */
export function localDayKey(atMs: number): string {
  const d = new Date(atMs);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
