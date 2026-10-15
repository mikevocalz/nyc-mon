/**
 * Whether the app runs on a standalone Android headset (Meta Horizon OS or
 * PICO OS), from React Native's `Platform.constants` (Manufacturer/Brand).
 * Device-level on purpose: the viewing distance belongs to the device,
 * whichever flavor was installed. Pure, so node tests can import it; screens
 * read it through `useIsHeadset`.
 */
export function isHeadsetAndroid(
  os: string,
  constants: { readonly Manufacturer?: string; readonly Brand?: string } | undefined,
): boolean {
  if (os !== 'android' || constants === undefined) return false;
  return /\b(oculus|meta|pico)\b/i.test(`${constants.Manufacturer ?? ''} ${constants.Brand ?? ''}`);
}
