/**
 * Web (and the platform resolution anchor): browsers expose no audio session
 * and no silent switch, so the leases do nothing here. Same API as
 * session.native.ts so shared callers stay platform-free.
 */
const noop = () => {};

/** Takes an ambient-session lease for a sound of unknown length. No-op on web. */
export function acquireAmbientSession(): () => void {
  return noop;
}

/** Takes an ambient-session lease for `seconds` of sound. No-op on web. */
export function holdAmbientSession(_seconds: number): void {}
