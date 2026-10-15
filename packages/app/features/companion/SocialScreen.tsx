'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { PEEK_ROUNDS_PER_SESSION, PEEK_SPOTS } from '@acme/core/schemas';
import { assertNever, createRandom, DEFAULT_CARE_TUNING, hash128 } from '@acme/core/sim';
import type { PeekRound, PeekSpot } from '@acme/core/types';
import {
  Button, CareMeterRing, RoundDots, SheetSurface, useHLynkStageWide, useInstanceStore, useReducedMotion, useStore,
} from '@acme/ui';
import { haptics } from '@acme/ui/haptics';
import { Text, View } from '@acme/ui/tw';
import { useMonStore } from '../mon/mon.store';
import { announcePolitely } from '../onboarding/announce';
import { careLed, useCareNow } from './care-shared';
import { companionCopy as c, type CompanionCopyId } from './copy';
import { useHomeStage } from './home-stage.store';
import { settlePeekPlay } from './peek-session';
import { tickMinuteClock } from './minute-clock';

/** Write time for the one play write; module scope keeps the clock read out of render. */
const writeTime = (): number => Date.now();

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
  const wide = useHLynkStageWide();
  const { care, identity, scheme } = useCareNow();
  const local = useInstanceStore<PeekLocal>(() => INTRO);
  const game = useStore(local);
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

  useHomeStage({
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
            <CareMeterRing
              need="social"
              value={care.social}
              label={c('m13.ring.social')}
              low={care.social < DEFAULT_CARE_TUNING.needsAttentionBelow}
              lowLabel={c('m13.ring.low')}
              size="sm"
              scheme={scheme}
              reducedMotion={reducedMotion}
              testID="m16-ring-social"
            />
          </View>
        )}
        {playing}
        {wide || card === null ? null : <View className="absolute inset-x-0 bottom-0">{card}</View>}
      </View>
    ),
    trailing: wide ? card ?? undefined : undefined,
  });

  return null;
}
