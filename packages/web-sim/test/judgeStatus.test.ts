import { describe, expect, it } from 'vitest';
import { judgeStage } from '../src/client/judgeStatus.ts';

const base = {
  authKind: 'signed-in' as const,
  connectionKind: 'connected' as const,
  listening: false,
  busy: false,
  activeToolTitle: null,
  heard: '',
  live: '',
  lastReply: '',
};

describe('judgeStage', () => {
  it('makes the idle judge state explicitly ready', () => {
    expect(judgeStage(base)).toMatchObject({ kind: 'ready', label: 'Ready', tone: 'success' });
  });

  it('puts listening ahead of thinking and uses interim speech', () => {
    expect(judgeStage({ ...base, listening: true, busy: true, heard: 'feed my Mon' })).toEqual({
      kind: 'listening',
      label: 'Listening',
      tone: 'info',
      headline: 'feed my Mon',
    });
  });

  it('names the active MCP action instead of showing a generic spinner', () => {
    expect(judgeStage({ ...base, busy: true, activeToolTitle: 'Feed Mon' })).toEqual({
      kind: 'acting',
      label: 'Taking action',
      tone: 'info',
      headline: 'Feed Mon…',
    });
  });

  it('shows offline and sign-in problems before a ready state', () => {
    expect(judgeStage({ ...base, connectionKind: 'failed' })).toMatchObject({ kind: 'offline', tone: 'danger' });
    expect(judgeStage({ ...base, authKind: 'error' })).toMatchObject({ kind: 'signed-out', label: 'Sign-in issue', tone: 'danger' });
  });

  it('keeps a streamed reply visible while the turn is still busy', () => {
    expect(judgeStage({ ...base, busy: true, live: 'Yo, I could eat.' })).toMatchObject({
      kind: 'thinking',
      label: 'Replying',
      headline: 'Yo, I could eat.',
    });
  });
});
