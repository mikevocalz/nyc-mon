import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import {
  appendLine, errorMessage, expireSession, initialCompanionState, memoryErrorMessage, monLine, toolResultLine,
  type CompanionRuntime, type CompanionState,
} from '../src/client/companionState.ts';

describe('a refused token in the middle of a turn', () => {
  it('signs out, shows why, and leaves Send usable', () => {
    const store = createStore<CompanionState>(() => ({ ...initialCompanionState(), connected: true, busy: true, status: 'Waiting for Nemotron on Nebius…' }));
    const controller = new AbortController();
    const runtime = createStore<CompanionRuntime>(() => ({ session: null, abort: controller, history: [{ role: 'user', content: 'feed my Mon' }] }));

    expireSession(store, runtime);

    // send()'s finally skips `busy:false` once its signal is aborted, so expiry must clear it.
    expect(controller.signal.aborted).toBe(true);
    expect(runtime.getState().history).toEqual([]);
    const state = store.getState();
    expect(state.connected).toBe(false);
    expect(state.busy).toBe(false);
    expect(state.status).toBe('');
    expect(state.error).toBe('Your sign-in expired. Sign in again to keep talking.');
  });
});

describe('conversation lines', () => {
  it('get stable ids that survive trimming to the last 40', () => {
    let state = initialCompanionState();
    for (let i = 0; i < 45; i += 1) state = { ...state, ...appendLine(state, { who: 'Caller', text: `q${i}` }) };
    expect(state.lines).toHaveLength(40);
    expect(state.lines[0]).toMatchObject({ id: 5, text: 'q5' });
    expect(state.lines[39]).toMatchObject({ id: 44, text: 'q44' });
    expect(state.nextId).toBe(45);
  });

  it.each([
    [{ structuredContent: { applied: true, effect: 'eaten' } }, 'Feed: done. The server saved the change.'],
    [{ structuredContent: { applied: false, declinedBecause: 'asleep' } }, 'Feed: not done. The server declined it, so nothing changed.'],
    [{ isError: true, content: [{ type: 'text', text: 'x' }] }, 'Feed: failed. Nothing changed. Try again.'],
    [{ structuredContent: { applied: 'true' } }, 'Feed: the server’s answer couldn’t be read, so this isn’t counted as done.'],
  ] as const)('care result %j reads as a sentence', (result, text) => {
    const line = toolResultLine('feed_mon', result as never);
    expect(line).toMatchObject({ who: 'Result', text });
    const shown = result as { structuredContent?: unknown; content?: unknown };
    expect(line.detail).toBe(JSON.stringify(shown.structuredContent ?? shown.content, null, 2));
  });

  it('names a status read and an unknown tool plainly', () => {
    expect(toolResultLine('get_mon_status', { content: [{ type: 'text', text: '{}' }] } as never).text).toBe('Status: checked.');
    expect(toolResultLine('mystery_tool', { structuredContent: { mon: {} } } as never).text).toBe('mystery_tool: checked.');
  });

  it('shows the Mon reply as a caption: Caller on screen, no stage directions', () => {
    expect(monLine('*yawns* Hey Callah, I ate.', 'done')).toEqual({ who: 'Mon', text: 'Hey Caller, I ate.' });
  });

  it.each([
    ['done', 'No reply text.'],
    ['refused', 'The model declined to answer. Try asking another way.'],
    ['truncated', 'The reply was cut off at the length limit.'],
    ['step-limit', 'Your Mon tried too many steps and stopped. Try a simpler request.'],
  ] as const)('an empty %s reply says what happened, never a code', (outcome, text) => {
    expect(monLine('  ', outcome)).toEqual({ who: 'Mon', text });
  });
});

describe('error copy', () => {
  it.each([
    ['GET', 500, 'Saved preferences couldn’t be loaded. Try again.'],
    ['PUT', 500, 'Preferences weren’t saved. Try again.'],
    ['DELETE', 502, 'Preferences weren’t forgotten. Try again.'],
    ['PUT', 409, 'Your preferences changed in another session. Reload them, then save again.'],
    ['DELETE', 409, 'Your preferences changed in another session. Reload them, then save again.'],
  ] as const)('%s %i', (method, status, text) => {
    expect(memoryErrorMessage(method, status)).toBe(text);
  });

  it('keeps a real error message and gives a plain fallback otherwise', () => {
    expect(errorMessage(new Error('Sign-in state did not match. Start again.'))).toBe('Sign-in state did not match. Start again.');
    expect(errorMessage('nope')).toBe('Something on this page failed. Reload and try again.');
  });
});
