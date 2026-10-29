import { AudioManager, type SessionOptions } from 'react-native-audio-api';
import { devWarn } from './dev-warn.ts';
import { createSessionLeases, type SessionCategory } from './session-lease.ts';

/**
 * Native: the one session owner (session-lease.ts) bound to
 * react-native-audio-api. Its default iOS category is `playback`
 * (AudioSessionManager.mm `init`), which plays through the Ring/Silent switch;
 * a lease switches to `ambient`, which the switch silences. If the session is
 * already active the library reconfigures it in place
 * (`setAudioSessionOptions` -> `configureAudioSession`), so taking the lease
 * BEFORE the lazy `new AudioContext()` means even the first sound on a muted
 * phone starts silent. Android has no silent switch; the call is harmless
 * there and media volume decides.
 */
const OPTIONS: Readonly<Record<SessionCategory, SessionOptions>> = {
  ambient: { iosCategory: 'ambient', iosMode: 'default', iosOptions: [] },
  playback: { iosCategory: 'playback', iosMode: 'default', iosOptions: [] },
};

/** Covers JS timer vs audio clock drift and the release tail after a sound's last sample. */
const RESTORE_MARGIN_MS = 300;

const leases = createSessionLeases({
  apply(category) {
    try {
      AudioManager.setAudioSessionOptions(OPTIONS[category]);
    } catch (error) {
      devWarn(`audio session: could not set ${category}`, error);
      throw error;
    }
  },
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  marginMs: RESTORE_MARGIN_MS,
});

/** Takes an ambient-session lease for a sound of unknown length (a voice line). Call the result when it ends. */
export function acquireAmbientSession(): () => void {
  return leases.acquire();
}

/** Takes an ambient-session lease for `seconds` of sound (a cue, the chirp). */
export function holdAmbientSession(seconds: number): void {
  leases.hold(seconds);
}
