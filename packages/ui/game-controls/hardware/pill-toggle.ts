// Short press of a pause key (gamepad Start, keyboard Enter or Escape) means
// different things depending on what the pill shows. Shared by both mappings
// so the two never disagree.
import type { PillState } from '../contract.ts';
import type { SessionCommand } from './commands.ts';

/**
 * The request a short press makes for the current {@linkcode PillState}:
 * `playing` asks to pause, `paused` asks to resume. `start` (no session yet)
 * and `stopConfirm` (the session's own dialog is up) take nothing from a
 * short press, so the lobby and the confirm dialog keep their own controls.
 */
export function pillToggleCommand(pill: PillState): Extract<SessionCommand, 'pause-request' | 'resume-request'> | null {
  switch (pill) {
    case 'playing':
      return 'pause-request';
    case 'paused':
      return 'resume-request';
    case 'start':
    case 'stopConfirm':
      return null;
  }
}
