import type { AuthState } from '../shared/auth.ts';

export type JudgeStageKind =
  | 'signed-out'
  | 'signing-in'
  | 'connecting'
  | 'offline'
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'acting';

export type JudgeStageTone = 'neutral' | 'info' | 'success' | 'danger';

export interface JudgeStage {
  readonly kind: JudgeStageKind;
  readonly label: string;
  readonly tone: JudgeStageTone;
  readonly headline: string;
}

export function judgeStage(input: {
  readonly authKind: AuthState['kind'];
  readonly connectionKind: 'idle' | 'connecting' | 'connected' | 'failed';
  readonly listening: boolean;
  readonly busy: boolean;
  readonly activeToolTitle: string | null;
  readonly heard: string;
  readonly live: string;
  readonly lastReply: string;
}): JudgeStage {
  if (input.authKind === 'signing-in') {
    return { kind: 'signing-in', label: 'Signing in', tone: 'info', headline: 'Opening your NYC-MON account…' };
  }
  if (input.authKind === 'signed-out' || input.authKind === 'error') {
    return {
      kind: 'signed-out',
      label: input.authKind === 'error' ? 'Sign-in issue' : 'Sign in',
      tone: input.authKind === 'error' ? 'danger' : 'neutral',
      headline: 'Sign in to meet your Mon here.',
    };
  }
  if (input.connectionKind === 'connecting' || input.connectionKind === 'idle') {
    return { kind: 'connecting', label: 'Connecting', tone: 'info', headline: 'Connecting to NYC-MON…' };
  }
  if (input.connectionKind === 'failed') {
    return { kind: 'offline', label: 'Offline', tone: 'danger', headline: 'NYC-MON is out of reach right now.' };
  }
  if (input.listening) {
    return {
      kind: 'listening',
      label: 'Listening',
      tone: 'info',
      headline: input.heard.trim() || 'I’m listening…',
    };
  }
  if (input.activeToolTitle) {
    return {
      kind: 'acting',
      label: 'Taking action',
      tone: 'info',
      headline: `${input.activeToolTitle}…`,
    };
  }
  if (input.live) {
    return { kind: 'thinking', label: 'Replying', tone: 'info', headline: input.live };
  }
  if (input.busy) {
    return { kind: 'thinking', label: 'Thinking', tone: 'info', headline: 'Your Mon is thinking…' };
  }
  return {
    kind: 'ready',
    label: 'Ready',
    tone: 'success',
    headline: input.lastReply || 'Say or type something to your Mon.',
  };
}
