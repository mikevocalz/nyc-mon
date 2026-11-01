/**
 * Native: the stage's hidden controls stay screen-reader-only. VoiceOver and
 * TalkBack draw their own focus ring, and there is no keyboard focus to show
 * on a phone, so nothing here ever becomes visible.
 */
export const STAGE_CONTROLS_LOOK = {
  group: 'absolute left-0 top-0 h-px w-px overflow-hidden opacity-0',
  item: '',
} as const;
