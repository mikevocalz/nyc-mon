'use client';
// The Game tab's lobby (Master Directive v2 §3; G02 08-handoff.md). Binds
// the kit's GameLobby to the app's stores: resume from `useLobbyResume`
// (local, before the first paint), rankings from `useLobbyLeaderboard`
// (never blocks START), START through `startLobbySession`, which runs the
// pure plan in resume-sequence.ts so the camera is restored before the
// cover reveals (§3 "no visible teleport"; §14 fixtures 2, 3).
//
// Session ownership (Carmack/Acton: one authoritative owner): START
// dispatches `start` to `worldSessionStore` here, once, after the world's
// first frame; GameScreen mounts under the cover and reflects the session.
// A resume reuses the eligible save's session id; a new game mints one (ADR
// 0020). Resume never mints a world instance or a Caller: the world id is
// minted by the first save of a new game (`world-snapshot.ts`), and the
// identity is read, not created (`lobby-identity.ts`).
//
// Failure (review finding C1): the wait for the first frame is bounded and
// fails fast when GameScreen reports a state that can never draw; START then
// returns to `idle` and the strip shows `g02.resume.fail.generic`.
//
// Web: GameScreen never mounts on web (its header). Decision: DEFER the
// lead's ruling on web START (08-handoff.md B4); until then the web lobby
// renders with START `disabled` and no web-specific copy, because the deck
// has none ("Not written until ruled").
import { useEffect, useRef } from 'react';
import { Platform, type LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import { useInstanceStore, useReducedMotion } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { foldLayoutsFromRegions, useAdaptiveNavigationPlacement, useReservedRegions } from '@acme/ui/adaptive-panes/parts';
import { resolveLayoutProfile } from '@acme/ui/game-controls/layout/parts';
import { GameLobby, LOBBY_COPY, type RecoveryChoice, type ThemeVariant } from '@acme/ui/lobby';
import { bundledCity } from '../city-data.ts';
import { gameCameraStore, gameScreenActions, gameScreenStore } from '../game-session.ts';
import { runSessionEffects } from '../world-resume/use-world-save-lifecycle.ts';
import { worldSaveStore } from '../world-resume/world-save.store.ts';
import { worldSessionStore } from '../world-resume/world-session.store.ts';
import { mintSessionId } from '../world-resume/world-snapshot.ts';
import { awaitWorldReady } from './await-world-ready.ts';
import { readLobbyIdentity } from './lobby-identity.ts';
import { lobbyStore } from './lobby.store.ts';
import { planResumeSequence, runResumeSequence } from './resume-sequence.ts';
import { toResumeSummary } from './resume-summary.ts';
import { useLobbyLeaderboard } from './use-lobby-leaderboard.ts';
import { resolveLobbyResume, useLobbyResume } from './use-lobby-resume.ts';

/** Daylit between 06:00 and 18:00 local time (D8). The clock, not the OS theme. */
export function schemeForHour(hour: number): ThemeVariant {
  return hour >= 6 && hour < 18 ? 'daylit' : 'night';
}

/**
 * START. Plans from the stored resume result and runs the steps: camera
 * restore, hold until the world's first frame (bounded), session start,
 * reveal. A rejection returns START to `idle` with the generic strip line
 * (`g02.resume.fail.generic`); the reason is logged, never shown.
 */
export async function startLobbySession(now: number = Date.now()): Promise<void> {
  const store = lobbyStore.getState();
  const result = store.resume;
  const identity = readLobbyIdentity();
  if (result === null || result.kind === 'error' || identity === null) return;
  if (!store.beginStart()) return;
  const plan = planResumeSequence(result);
  // A fresh GameScreen mounts for this START; an earlier mount's first frame must not count.
  gameScreenActions.resetForMount();
  const city = bundledCity();
  const lifecycle = { identity, dataset: city.ok ? city.dataset : null };
  try {
    await runResumeSequence(plan, {
      startSession: (reuseSessionId) => {
        const at = Date.now();
        // Every dispatch runs its effects (review finding L3); `start` emits none today.
        runSessionEffects(
          worldSessionStore.getState().dispatch({ type: 'start', sessionId: reuseSessionId ?? mintSessionId(identity, now), at }),
          lifecycle,
        );
      },
      setCamera: (camera) => gameCameraStore.setState({ camera }),
      hold: () => lobbyStore.getState().setTransitionPhase('hold'),
      awaitFirstFrame: () => awaitWorldReady(gameScreenStore),
      reveal: () => lobbyStore.getState().setTransitionPhase('reveal'),
    });
    lobbyStore.getState().finishStart();
  } catch (error) {
    console.error('[lobby] START failed', error);
    lobbyStore.getState().failStart(LOBBY_COPY.failGeneric);
  }
}

/**
 * The recoveries this screen can carry out today (review finding M12). No
 * server world-save endpoint exists, so restoring, comparing against a newer
 * save and rebuilding from the last district have nothing to act on; the
 * dialog never offers them. `not-now` dismisses.
 */
export const LOBBY_RECOVERY_CHOICES: ReadonlySet<RecoveryChoice> = new Set<RecoveryChoice>(['new-game', 'retry', 'not-now']);

/**
 * The recovery dialog's choices. Only `new-game` clears the save, and only
 * after the Caller chose it; an unreadable save is quarantined first
 * (`world-save.store.shared.ts` `clear`, review finding M20).
 */
export function recoverLobby(choice: RecoveryChoice): void {
  switch (choice) {
    case 'new-game':
      worldSaveStore.getState().clear();
      return;
    case 'retry': {
      const now = Date.now();
      const result = resolveLobbyResume(now);
      if (result !== null) lobbyStore.getState().setResume(result, now);
      return;
    }
    case 'not-now':
      // The dialog closes and the old save stays.
      return;
    case 'from-district':
    case 'restore-server':
    case 'use-newer':
    case 'keep-local':
      // Never offered (LOBBY_RECOVERY_CHOICES). Decision: DEFER until a server
      // world-save endpoint exists; reaching here is a wiring bug, so say so.
      console.error(`[lobby] recovery "${choice}" is not offered and has no effect`);
      return;
  }
}

export function GameLobbyScreen() {
  const resume = useLobbyResume();
  const { model, retry } = useLobbyLeaderboard();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const placement = useAdaptiveNavigationPlacement();
  const regions = useReservedRegions();
  const window = useWindowDimensions();
  // The host's window origin, measured like GameScreen's: folds arrive in window space (skill §4, §10 nonzero host origin).
  const geometry = useInstanceStore(() => ({ width: 0, height: 0, originX: 0, originY: 0, measured: false }));
  const { width: hostW, height: hostH, originX, originY, measured } = useStore(geometry);
  const host = useRef<{ measureInWindow?: (cb: (x: number, y: number) => void) => void } | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    const apply = (x: number, y: number) => geometry.setState({ width: w, height: h, originX: x, originY: y, measured: true });
    if (host.current?.measureInWindow) host.current.measureInWindow(apply);
    else apply(0, 0);
  };
  const startState = useStore(lobbyStore, (s) => s.startState);
  const transitionPhase = useStore(lobbyStore, (s) => s.transitionPhase);
  const openedAtMs = useStore(lobbyStore, (s) => s.openedAtMs);
  const startFailed = useStore(lobbyStore, (s) => s.startError !== null);

  // A lobby that is covered mid-start shows the cover from `enter`; on a plain visit the lobby is clear.
  useEffect(() => {
    if (lobbyStore.getState().phase === 'lobby') lobbyStore.getState().setTransitionPhase('done');
  }, []);

  const profile = resolveLayoutProfile({
    runtime: Platform.OS === 'web' ? 'web' : 'native',
    hardwareFamily: placement.family,
    width: measured ? hostW : window.width - insets.left - insets.right,
    height: measured ? hostH : window.height,
    // Until the first layout pass, no folds: snapping before the origin is known is worse than not snapping.
    folds: measured ? foldLayoutsFromRegions(regions, originX).map((f) => ({ ...f, y: f.y - originY })) : [],
  });
  const summary = toResumeSummary(resume);
  const web = Platform.OS === 'web';

  return (
    <View ref={host as never} className="flex-1" onLayout={onLayout}>
      <GameLobby
        resume={summary}
        leaderboard={model}
        profile={profile}
        reducedMotion={reducedMotion}
        scheme={schemeForHour(new Date(openedAtMs).getHours())}
        startState={web ? 'disabled' : startState}
        transitionPhase={transitionPhase}
        nowMs={openedAtMs}
        onStart={() => { void startLobbySession(); }}
        onRecover={recoverLobby}
        recoveryChoices={LOBBY_RECOVERY_CHOICES}
        startFailed={startFailed}
        onRetryLeaderboard={retry}
        testID="g02-lobby"
      />
    </View>
  );
}
