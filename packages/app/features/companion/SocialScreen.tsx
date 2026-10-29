'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { PEEK_ROUNDS_PER_SESSION, PEEK_SPOTS } from '@acme/core/schemas';
import { assertNever, createRandom, DEFAULT_CARE_TUNING, hash128, heartsFor } from '@acme/core/sim';
import type { PeekRound, PeekSpot } from '@acme/core/types';
import {
  Button, HeartRow, HLYNK_COPY, RoundDots, SheetSurface, useInstanceStore, useReducedMotion, useStore, type DeviceKey,
  type GlassAction, type GlassLine, type GlassView,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { Text, View } from '@acme/ui/tw';
import { useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { careLed, useCareNow } from './care-shared';
import { companionCopy as c, type CompanionCopyId } from './copy';
import { GlassStage, glassControls, glassRing, useGlassOn, useGlassScreen, useMonGlass } from './glass';
import { useHomeStage } from './home-stage.store';
import { CareHistoryPane } from './pane-content';
import { settlePeekPlay } from './peek-session';
import { tickMinuteClock } from './minute-clock';

/** Write time for the one play write; module scope keeps the clock read out of render. */
const writeTime = (): number => Date.now();

/** The Baby large, the social ring, two lines, and two rows of three (the spots, then the twins). */
const LAYOUT = { model: 'large', rings: true, lineRows: 2, actionRows: 2, perRow: 3 } as const;

/** Where each spot sits across the glass, a share of its width, for the Baby peeking out there. */
const PEEK_OFFSET: Record<PeekSpot, number> = { left: -0.3, middle: 0, right: 0.3 };

const SPOT_COPY: Record<PeekSpot, CompanionCopyId> = { left: 'm16.spot.left', middle: 'm16.spot.middle', right: 'm16.spot.right' };

/**
 * Where the Mon hides each round. Deterministic for a Mon and session start
 * (M16 "Hiding sequence": seed from `hash128(monInstanceId + sessionStart)`),
 * so a test can replay a session.
 */
export function peekHidingSpots(monInstanceId: string, sessionStart: number, rounds = PEEK_ROUNDS_PER_SESSION): PeekSpot[] {
  const [seed] = hash128(`${monInstanceId}${sessionStart}`);
  const next = createRandom(seed);
  return Array.from({ length: rounds }, () => PEEK_SPOTS[Math.floor(next() * PEEK_SPOTS.length)] ?? 'middle');
}

interface PeekLocal {
  phase: 'intro' | 'playing' | 'result';
  hidden: PeekSpot[];
  rounds: PeekRound[];
  focus: number;
  /** The spot the Mon just peeked out from, shown until the next peek. */
  lastFound: PeekSpot | null;
  applied: boolean;
}

const INTRO: PeekLocal = { phase: 'intro', hidden: [], rounds: [], focus: 1, lastFound: null, applied: false };

/**
 * M16 Social: Peek (D-15b). The Mon hides behind one of three spots; the
 * Caller flicks to look and taps to peek. A wrong peek still counts: the Mon
 * peeks out from where it hid and the round is found. Six rounds, no timer,
 * no score; the only number is "Round n of 6". One `applyCare` play per
 * session (Done, round six, or Back after at least one round); Back at
 * round 0 applies nothing (06-critique S-5).
 */
export function SocialScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { care, identity, scheme } = useCareNow();
  const local = useInstanceStore<PeekLocal>(() => INTRO);
  const game = useStore(local);
  const glassUi = useInstanceStore(() => ({ failed: false, nudge: 0 }));
  const { failed, nudge } = useStore(glassUi);
  const glassOn = useGlassOn(failed);
  const leaving = useRef(false);
  const name = identity?.name ?? '';

  useEffect(() => {
    if (identity === undefined) router.replace('/(home)');
  }, [identity, router]);

  const asleep = care?.activity.kind === 'asleep';
  const canPlay = care !== undefined && !asleep && care.energy >= DEFAULT_CARE_TUNING.playMinEnergy;

  /**
   * Applies the session's play once; nothing when no round finished. On
   * unmount there is no screen left to route from, so a failed write only
   * navigates while mounted.
   */
  const applyPlay = (mounted = true) => {
    settlePeekPlay(local, (quality) => {
      let outcome;
      try {
        outcome = useMonStore.getState().applyCare({ kind: 'play', quality }, writeTime());
      } catch {
        if (mounted) router.replace('/(home)');
        return;
      }
      tickMinuteClock();
      switch (outcome.kind) {
        case 'played':
        case 'paused':
        case 'resumed':
        case 'declined': // asleep / too-tired only on a race; the gate prevents it
        case 'eaten':
        case 'overfed':
        case 'fell-asleep':
        case 'woke':
          return;
        default:
          return assertNever(outcome);
      }
    });
  };

  // Android back, a deep link, or any other route change unmounts the screen
  // without Done/Back/Home; settle the finished rounds here. `applied` keeps
  // it to one write when an explicit exit already ran.
  const applyPlayRef = useRef(applyPlay);
  useEffect(() => {
    applyPlayRef.current = applyPlay;
  });
  useEffect(() => () => applyPlayRef.current(false), []);

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    applyPlay();
    router.back();
  };

  const start = () => {
    if (!canPlay || identity === undefined) return;
    leaving.current = false;
    local.setState({
      ...INTRO,
      phase: 'playing',
      hidden: peekHidingSpots(identity.monInstanceId, Date.now()),
    });
  };

  const step = (direction: -1 | 1) => {
    const { focus } = local.getState();
    const next = Math.min(PEEK_SPOTS.length - 1, Math.max(0, focus + direction));
    if (next !== focus) haptics.selection();
    local.setState({ focus: next });
  };

  const peek = (spot?: PeekSpot) => {
    const s = local.getState();
    if (s.phase !== 'playing') return;
    const guess = spot ?? PEEK_SPOTS[s.focus] ?? 'middle';
    const hiddenAt = s.hidden[s.rounds.length] ?? 'middle';
    const round: PeekRound = { hiddenAt, guesses: guess === hiddenAt ? [guess] : [guess, hiddenAt] };
    if (guess === hiddenAt) {
      haptics.success();
      announcePolitely(c('m16.found.a11y', { name }));
    } else {
      haptics.tap();
      announcePolitely(c('m16.peekout.a11y', { name, spot: c(SPOT_COPY[hiddenAt]) }));
    }
    const rounds = [...s.rounds, round];
    local.setState({ rounds, lastFound: hiddenAt, focus: PEEK_SPOTS.indexOf(guess) });
    if (rounds.length >= PEEK_ROUNDS_PER_SESSION) {
      applyPlay();
      local.setState({ phase: 'result' });
    }
  };

  const roundNumber = Math.min(game.rounds.length + 1, PEEK_ROUNDS_PER_SESSION);
  const roundLabel = c('m16.round.a11y', { n: roundNumber, total: PEEK_ROUNDS_PER_SESSION });
  const focusedSpot = PEEK_SPOTS[game.focus] ?? 'middle';

  const card = game.phase === 'intro' ? (
    <SheetSurface placement="in-screen" scheme="night" title={c('m16.intro.title', { name })} testID="m16-intro">
      <View className="gap-target-gap">
        {canPlay ? (
          <>
            <Text className="text-xr-body text-text">{c('m16.intro.body', { name })}</Text>
            <View testID="m16-start">
              <Button title={c('m16.intro.start')} variant="cta" size="lg" fullWidth className="min-h-target" onPress={start} />
            </View>
          </>
        ) : (
          <>
            <Text testID="m16-tired" className="text-xr-body text-text">
              {asleep ? c('m16.intro.asleep', { name }) : c('m16.intro.tired', { name })}
            </Text>
            {asleep ? null : (
              <View testID="m16-tired-action">
                <Button title={c('m16.intro.tired.action')} variant="outline" size="lg" fullWidth className="min-h-target" onPress={() => router.replace('/(home)/rest')} />
              </View>
            )}
          </>
        )}
      </View>
    </SheetSurface>
  ) : game.phase === 'result' ? (
    <SheetSurface placement="in-screen" scheme="night" testID="m16-result">
      <View className="gap-target-gap">
        <Text className="text-xr-body text-text">{c('m16.result.body', { name })}</Text>
        <View testID="m16-again">
          <Button title={c('m16.result.again')} variant="cta" size="lg" fullWidth className="min-h-target" disabled={!canPlay} onPress={start} />
        </View>
        {canPlay ? null : <Text className="text-xr-caption text-text-muted">{c('m16.intro.tired', { name })}</Text>}
        <View testID="m16-done">
          <Button title={c('m16.result.done')} variant="outline" size="lg" fullWidth className="min-h-target" onPress={leave} />
        </View>
      </View>
    </SheetSurface>
  ) : null;

  const playing = game.phase === 'playing' ? (
    <View className="absolute inset-x-0 bottom-0 gap-target-gap p-4" style={{ pointerEvents: 'box-none' }}>
      <View className="flex-row justify-between gap-target-gap">
        {PEEK_SPOTS.map((spot, i) => (
          <View
            key={spot}
            testID={`m16-spot-${spot}`}
            className={`flex-1 border-2 ${i === game.focus ? 'border-structure' : 'border-transparent'}`}
          >
            <Button
              title={game.lastFound === spot ? name : c(SPOT_COPY[spot])}
              aria-label={c(SPOT_COPY[spot])}
              variant="outline"
              size="lg"
              fullWidth
              className="min-h-target"
              onPress={() => peek(spot)}
            />
          </View>
        ))}
      </View>
      <View className="items-center">
        <RoundDots total={PEEK_ROUNDS_PER_SESSION} current={roundNumber} accessibilityLabel={roundLabel} reducedMotion={reducedMotion} testID="m16-rounds" />
      </View>
      <View className="flex-row gap-target-gap">
        <View testID="m16-twin-back" className="flex-1">
          <Button title={c('m16.twin.back')} variant="outline" size="lg" fullWidth className="min-h-target" onPress={() => step(-1)} />
        </View>
        <View testID="m16-twin-peek" className="flex-1">
          <Button title={c('m16.twin.peek')} variant="outline" size="lg" fullWidth className="min-h-target" onPress={() => peek()} />
        </View>
        <View testID="m16-twin-forward" className="flex-1">
          <Button title={c('m16.twin.forward')} variant="outline" size="lg" fullWidth className="min-h-target" onPress={() => step(1)} />
        </View>
      </View>
    </View>
  ) : null;

  // ---- the 3D H-Lynk: the Baby on the glass (hidden while the rounds run), the ring, the spots and the twins drawn there ----
  const { model, monClips } = useMonGlass(identity?.dexId ?? null, care);
  const glassLines: GlassLine[] = game.phase === 'intro'
    ? [{ text: canPlay ? c('m16.intro.body', { name }) : asleep ? c('m16.intro.asleep', { name }) : c('m16.intro.tired', { name }) }]
    : game.phase === 'result'
      ? [{ text: c('m16.result.body', { name }) }, ...(canPlay ? [] : [{ text: c('m16.intro.tired', { name }), size: 'caption' as const }])]
      : [{ text: roundLabel, tone: 'dim' }];
  const actions: GlassAction[] = game.phase === 'playing'
    ? [
      ...PEEK_SPOTS.map((spot, i): GlassAction => ({
        target: `spot:${spot}`, label: game.lastFound === spot ? name : c(SPOT_COPY[spot]), tone: i === game.focus ? 'selected' : 'secondary',
      })),
      { target: 'back', label: c('m16.twin.back'), tone: 'secondary' },
      { target: 'peek', label: c('m16.twin.peek'), tone: 'primary' },
      { target: 'forward', label: c('m16.twin.forward'), tone: 'secondary' },
    ]
    : game.phase === 'result'
      ? [
        { target: 'again', label: c('m16.result.again'), tone: 'primary', disabled: !canPlay },
        { target: 'done', label: c('m16.result.done'), tone: 'secondary' },
      ]
      : canPlay
        ? [{ target: 'start', label: c('m16.intro.start'), tone: 'primary' }]
        : asleep ? [] : [{ target: 'tired', label: c('m16.intro.tired.action'), tone: 'secondary' }];
  const glassView: GlassView = {
    status: null,
    title: c('m16.intro.title', { name }),
    subtitle: game.phase === 'playing' ? c('m16.trackpad.label', { spot: c(SPOT_COPY[focusedSpot]) }) : '',
    rings: care === undefined ? [] : [glassRing('social', care.social)],
    lines: glassLines,
    actions,
  };
  const onAction = (target: string) => {
    if (target.startsWith('spot:')) peek(target.slice(5) as PeekSpot);
    else if (target === 'back') step(-1);
    else if (target === 'forward') step(1);
    else if (target === 'peek') peek();
    else if (target === 'start' || target === 'again') start();
    else if (target === 'done') leave();
    else if (target === 'tired') router.replace('/(home)/rest');
  };
  const glass = useGlassScreen({
    layout: LAYOUT, model, view: glassView, nudge,
    // While playing, the Mon hides behind a spot until the Caller peeks; then
    // it peeks out in 3D at the spot it was found, until the next peek.
    modelVisible: game.phase !== 'playing' || game.lastFound !== null,
    modelOffset: game.phase === 'playing' && game.lastFound !== null ? PEEK_OFFSET[game.lastFound] : 0,
  });
  useEffect(() => {
    glass.bind({ onAction, monClips, onModel: () => glassUi.setState({ nudge: glassUi.getState().nudge + 1 }) });
  });
  const onKey = (key: DeviceKey) => {
    if (key === 'prev' && game.phase === 'playing') step(-1);
    else if (key === 'next' && game.phase === 'playing') step(1);
    else if (key === 'activate') {
      if (game.phase === 'playing') peek();
      else if (game.phase === 'intro' && canPlay) start();
    } else if (key === 'back') leave();
    else if (key === 'home') {
      applyPlay();
      router.replace('/(home)');
    }
  };
  const onFailed = useCallback(() => glassUi.setState({ failed: true }), [glassUi]);

  useHomeStage(glassOn ? {} : {
    chrome: {
      status: careLed(care),
      scheme,
      testIDPrefix: 'm16',
      // While playing, the Mon is hiding: the spots stand in until the room has set dressing (B2).
      creature: game.phase !== 'playing',
      framing: 'home',
      trackpad: game.phase === 'playing'
        ? { label: c('m16.trackpad.label', { spot: c(SPOT_COPY[focusedSpot]) }), hint: c('m16.trackpad.hint'), onStep: step, onActivate: () => peek() }
        : game.phase === 'intro' && canPlay
          ? { label: c('m16.intro.title', { name }), onActivate: start }
          : { label: c('m16.intro.title', { name }), disabled: true },
      keys: {
        home: { onPress: () => { applyPlay(); router.replace('/(home)'); } },
        back: { onPress: leave },
      },
    },
    screen: (
      <View className="flex-1" style={{ pointerEvents: 'box-none' }}>
        {care === undefined ? null : (
          <View className="absolute right-4 top-4">
            <HeartRow
              filled={heartsFor(care.social)}
              label={care.social < DEFAULT_CARE_TUNING.needsAttentionBelow ? `${c('m13.ring.social')} · ${c('m13.ring.low')}` : c('m13.ring.social')}
              accessibilityLabel={`${c('m13.ring.social')}, ${c('monspace.a11y.hearts', { count: heartsFor(care.social) })}${care.social < DEFAULT_CARE_TUNING.needsAttentionBelow ? `, ${c('m13.ring.low')}` : ''}`}
              scheme={scheme}
              testID="m16-ring-social"
            />
          </View>
        )}
        {playing}
        {/* From md the card sits in the stage's companion pane instead (HLynkStage). */}
        {card === null ? null : <View className="absolute inset-x-0 bottom-0 md:hidden">{card}</View>}
      </View>
    ),
    // While playing, the pane keeps its place with the round count so the
    // shell does not jump width between the intro, the rounds and the result.
    trailing: card ?? (
      <SheetSurface placement="in-screen" scheme="night" title={c('m16.intro.title', { name })} testID="m16-pane-round">
        <Text className="text-xr-body text-text">{roundLabel}</Text>
      </SheetSurface>
    ),
  });

  if (!glassOn) return null;
  const paneTips = [
    c('pane.social.tip.how', { name }),
    c('pane.social.tip.social'),
    ...(canPlay ? [] : [c('pane.social.tip.tired', { name })]),
  ];

  return (
    <GlassStage
      screen={glass.screen}
      label={c('m16.intro.title', { name })}
      testIDPrefix="m16"
      onKey={onKey}
      onFailed={onFailed}
      companion={<CareHistoryPane route="social" tips={paneTips} loading={care === undefined} />}
      a11y={
        <>
          <Text accessibilityRole="header">{c('m16.intro.title', { name })}</Text>
          {care === undefined ? null : <Text testID="m16-ring-social">{`${c('m13.ring.social')}, ${c('monspace.a11y.hearts', { count: heartsFor(care.social) })}`}</Text>}
          {glassLines.map((l) => <Text key={l.text}>{l.text}</Text>)}
        </>
      }
      controls={[
        ...glassControls(actions, glass.press, (t) => (t.startsWith('spot:') ? `m16-spot-${t.slice(5)}` : t === 'tired' ? 'm16-tired-action'
          : ['back', 'peek', 'forward'].includes(t) ? `m16-twin-${t}` : `m16-${t}`)),
        { key: 'leave', label: HLYNK_COPY['hlynk.key.back.label'], onPress: leave, testID: 'm16-leave' },
      ]}
    />
  );
}
