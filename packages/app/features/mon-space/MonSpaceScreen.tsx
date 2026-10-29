'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useRouter } from 'solito/navigation';
import {
  Button, EmptyState, SafeArea, playCareCue,
  useInstanceStore, useReducedMotion, useStore,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { Text } from '@acme/ui/tw';
import { announcePolitely } from '../onboarding/announce';
import { requestNotifyPermission } from '../onboarding/notify-permission';
import { schemeForTime } from '../onboarding/time-scheme';
import { useDevicePrefs } from '../settings/device-prefs.store';
import { selectActiveMon, selectMonCareViewAt, useMonStore } from '../mon/mon.store';
import { companionCopy } from '../companion/copy';
import { useHomeStage } from '../companion/home-stage.store';
import { tickMinuteClock, useMinuteClock } from '../companion/minute-clock';
import { artFor, monIdentity } from '../companion/mon-identity';
import { actionsFor, PAUSE_ACTION } from './care-actions';
import { useCareTick } from './care-tick';
import { useHardwareKeys } from './hardware-keys';
import { MonSpaceView } from './MonSpaceView';
import {
  feedbackFor, initialUi, intentFor, keyFromKeyboard, newCall, pressKey, statusLine, tapIcon,
  callCopy, type Line, type MonSpaceIcon, type MonSpaceKey, type MonSpaceUi, type PressResult,
} from './mon-space-model';

/** How long the evolve and hatch moments hold the name plate. */
const MOMENT_MS = 2400;
/** The evolve beat: the LCD inverts for one beat (never under Reduce Motion). */
const BEAT_MS = 600;
/** Wide windows (tablets, open foldables) put the status twins beside the LCD. */
const WIDE_PT = 768;

interface Local {
  ui: MonSpaceUi;
  /** The last action's line, until the view changes it. */
  result: Line | null;
  moment: { kind: 'evolve' | 'hatch'; text: string } | null;
  beat: boolean;
  /** Bumped by each idle vignette (the sprite steps). */
  pose: number;
  askOpen: boolean;
  started: boolean;
}

/**
 * M32 Mon Space at `/(home)/mon-space`: the active Mon's full care loop on
 * a full-screen Memory LCD, with no H-Lynk frame, keys or trackpad (Decision
 * "Mon Space has no H-Lynk", Mike 2026-10-29). A cycles the icons, B selects,
 * C backs out; every icon is also a direct button. Calls light the lamp,
 * print a line, buzz once and chirp once (sound and haptics follow Settings).
 */
export function MonSpaceScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_PT;
  const nowMs = useMinuteClock((s) => s.nowMs);
  const mon = useMonStore(selectActiveMon);
  const view = useMonStore(useMemo(() => selectMonCareViewAt(nowMs), [nowMs]));
  const identity = useMemo(() => (mon === undefined ? undefined : monIdentity(mon)), [mon]);
  const name = identity?.name ?? '';
  const scheme = schemeForTime(nowMs);
  const askedCalls = useDevicePrefs((s) => s.monCallsAsked);
  const setPref = useDevicePrefs((s) => s.set);
  const local = useInstanceStore<Local>(() => ({
    ui: initialUi(undefined), result: null, moment: null, beat: false, pose: 0, askOpen: false, started: false,
  }));
  const { ui, result, moment, beat, pose, askOpen } = useStore(local);

  // Shell: none. The (home) layout unmounts its H-Lynk while this route shows.
  useHomeStage({ immersive: true });

  // First view: the cursor starts on the icon that answers the open call; the Mon calls ask shows once.
  useEffect(() => {
    if (view === undefined || local.getState().started) return;
    local.setState({ started: true, ui: initialUi(view), askOpen: !askedCalls });
  }, [view, askedCalls, local]);

  // A new call: one polite line, one attention cue, one haptic. Never repeated on the minute tick.
  const lastCall = useRef<typeof view extends undefined ? never : NonNullable<typeof view>['call'] | undefined>(undefined);
  useEffect(() => {
    if (view === undefined) return;
    const fresh = newCall(lastCall.current, view.call);
    lastCall.current = view.call;
    if (fresh === null || view.paused) return;
    announcePolitely(companionCopy(callCopy(fresh.kind), { name }));
    haptics.attention();
    playCareCue('attention');
  }, [view, name]);

  // Idle vignettes from the sim tick move the sprite (the app calls step() through stepMonCare).
  const tickSeq = useCareTick((s) => s.seq);
  const vignettes = useCareTick((s) => s.vignettes.length);
  useEffect(() => {
    if (vignettes > 0) local.setState((s) => ({ pose: s.pose + 1 }));
  }, [tickSeq, vignettes, local]);

  // Evolve (the stage changes while open) and hatch (opened within two minutes of the hatch): plate, cue, haptic.
  const stage = mon?.stage;
  const lastStage = useRef(stage);
  useEffect(() => {
    if (mon === undefined || identity === undefined) return;
    const prev = lastStage.current;
    lastStage.current = mon.stage;
    const evolved = prev !== undefined && prev !== mon.stage;
    const hatched = prev === mon.stage && !local.getState().started && Date.now() - mon.hatchedAt < 120_000;
    if (!evolved && !hatched) return;
    const text = evolved ? companionCopy('monspace.evolve.done', { name, formName: identity.formName ?? name }) : name;
    local.setState({ moment: { kind: evolved ? 'evolve' : 'hatch', text }, beat: evolved && !reducedMotion });
    announcePolitely(text);
    playCareCue(evolved ? 'evolve' : 'hatch');
    if (evolved) haptics.evolve();
    else haptics.hatchEmerge();
    const beatTimer = setTimeout(() => local.setState({ beat: false }), BEAT_MS);
    const plateTimer = setTimeout(() => local.setState({ moment: null }), MOMENT_MS);
    return () => {
      clearTimeout(beatTimer);
      clearTimeout(plateTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the stage is the trigger
  }, [stage]);

  const say = useCallback((line: Line) => {
    local.setState({ result: line });
    announcePolitely(companionCopy(line.copy, { name, ...line.tokens }));
  }, [local, name]);

  const act = useCallback((icon: MonSpaceIcon) => {
    const v = view;
    if (v === undefined) return;
    const intent = intentFor(icon, v);
    switch (intent.kind) {
      case 'explain':
        playCareCue('cancel');
        say({ copy: intent.copy });
        return;
      case 'status':
        playCareCue('select');
        haptics.tap();
        local.setState((s) => ({ ui: { ...s.ui, layer: 'status' } }));
        return;
      case 'confirm-pause':
        playCareCue('select');
        local.setState((s) => ({ ui: { ...s.ui, layer: 'pause-confirm' } }));
        return;
      case 'peek':
        playCareCue('select');
        router.push('/social');
        return;
      default:
        break;
    }
    const at = Date.now();
    let last = null;
    for (const action of actionsFor(intent)) {
      last = useMonStore.getState().applyMonCare(action, at).outcome;
      if (last.kind === 'declined') break;
    }
    tickMinuteClock();
    if (last === null) return;
    const fb = feedbackFor(last, intent);
    if (fb.cue !== null) playCareCue(fb.cue);
    if (fb.haptic !== null) haptics[fb.haptic]();
    say(fb);
  }, [view, local, router, say]);

  const pauseNow = useCallback(() => {
    const outcome = useMonStore.getState().applyMonCare(PAUSE_ACTION, Date.now()).outcome;
    tickMinuteClock();
    const fb = feedbackFor(outcome, { kind: 'confirm-pause' });
    if (fb.cue !== null) playCareCue(fb.cue);
    say(fb);
  }, [say]);

  const apply = useCallback((r: PressResult) => {
    const fromConfirm = local.getState().ui.layer === 'pause-confirm';
    local.setState({ ui: r.ui });
    switch (r.effect.kind) {
      case 'moved':
        haptics.selection();
        playCareCue('select');
        return;
      case 'closed':
        haptics.tap();
        playCareCue('cancel');
        return;
      case 'exit':
        playCareCue('cancel');
        router.back();
        return;
      case 'act':
        if (fromConfirm && r.effect.icon === 'pause') {
          // B on the pause confirm.
          pauseNow();
          return;
        }
        act(r.effect.icon);
        return;
      default:
        r.effect satisfies never;
    }
  }, [local, router, act, pauseNow]);

  const press = useCallback((key: MonSpaceKey) => apply(pressKey(local.getState().ui, key)), [apply, local]);
  const onIcon = useCallback((icon: MonSpaceIcon) => {
    const r = tapIcon(local.getState().ui, icon);
    local.setState({ ui: r.ui });
    act(icon);
  }, [local, act]);
  useHardwareKeys(useCallback((key: string) => {
    const k = keyFromKeyboard(key);
    if (k === null) return false;
    press(k);
    return true;
  }, [press]));

  const answerAsk = useCallback(async (on: boolean) => {
    local.setState({ askOpen: false });
    setPref('monCallsAsked', true);
    if (!on) return;
    setPref('monCalls', true);
    await requestNotifyPermission();
  }, [local, setPref]);

  if (mon === undefined) {
    return (
      <SafeArea className="flex-1 items-center justify-center bg-bg p-6">
        <EmptyState
          title={companionCopy('monspace.empty.title')}
          description={companionCopy('monspace.empty.body')}
          action={<Button variant="outline" size="lg" title={companionCopy('monspace.empty.action')} onPress={() => router.replace('/')} className="min-h-target" />}
        />
      </SafeArea>
    );
  }
  if (view === undefined) {
    return (
      <SafeArea className="flex-1 items-center justify-center bg-bg">
        <Text aria-live="polite" className="text-type-body text-text">{companionCopy('monspace.loading')}</Text>
      </SafeArea>
    );
  }

  return (
    <MonSpaceView
      view={view}
      ui={ui}
      name={name}
      scheme={scheme}
      wide={wide}
      reducedMotion={reducedMotion}
      status={companionCopy((result ?? statusLine(view)).copy, { name, ...(result ?? statusLine(view)).tokens })}
      beat={beat}
      pose={pose}
      art={artFor('baby', identity?.dexId ?? null)}
      moment={moment}
      askOpen={askOpen}
      onIcon={onIcon}
      onKey={press}
      onAsk={(on) => void answerAsk(on)}
    />
  );
}
