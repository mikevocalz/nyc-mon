import { AudioManager, type SessionOptions } from 'react-native-audio-api';

/**
 * iOS session handling for short UI cues (the care cues and the side-key
 * chirp). react-native-audio-api's default session category is `playback`
 * (AudioSessionManager.mm `init`), which plays through the Ring/Silent
 * switch. For a cue's length the session switches to `ambient`, which the
 * switch silences and which mixes with the Caller's own music, then returns
 * to the library default so voice notes keep playing with the switch on.
 * Same pattern and same two option sets as the Mon voice port
 * (packages/app/features/voice/mon-voice-port.native.ts). Android has no
 * silent switch; media volume decides, and the call is harmless there.
 */
const CUE: SessionOptions = { iosCategory: 'ambient', iosMode: 'default', iosOptions: [] };
const AFTER: SessionOptions = { iosCategory: 'playback', iosMode: 'default', iosOptions: [] };
/** Slack past the cue's end before the session goes back. */
const RELEASE_MS = 250;

let restore: ReturnType<typeof setTimeout> | null = null;

function setSession(options: SessionOptions): void {
  try {
    AudioManager.setAudioSessionOptions(options);
  } catch {
    // No session control here: keep whatever is set.
  }
}

/** Holds the ambient session for `seconds` of cue. Overlapping cues extend the hold. */
export function holdCueSession(seconds: number): void {
  if (restore === null) setSession(CUE);
  else clearTimeout(restore);
  restore = setTimeout(() => {
    restore = null;
    setSession(AFTER);
  }, Math.ceil(seconds * 1000) + RELEASE_MS);
}
