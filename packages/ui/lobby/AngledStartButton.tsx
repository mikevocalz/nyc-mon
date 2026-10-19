'use client';
// The lobby's angled START (Master Directive v2 §3 "Angled START button";
// G02 08-handoff.md § Components, § Motion). The app owns what START does:
// this control reflects `state`, names itself per `variant` (05-copy.md
// `g02.start.*`) and reports one press. Focus never starts the game; a press
// while `loading` or `disabled` reports nothing.
//
// Housing: the kit's corner-cut face, full content width × 64 pt, cut 24
// (the handoff's asymmetric top-left + bottom-right pair is not a
// `CutCorner` value; Decision: BUILD with the kit's `bottom-right` cut and
// propose the pair to the CornerCutFrame owner). The energy trace, press
// compression and loading hold are the `start-angled` artboard inside it,
// bound through `lobby/start/*`; without the artboard the face, legend and
// 64 pt target still work. Reduced motion: the artboard's authored sibling
// (no trace, colour-only press) plus a steady 2 dp rim, `carolina-500` at
// night and `royal-500` by day (07-a11y.md contrast rows).
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { palette } from '@acme/theme';
import type { District } from '../district/districts';
import { DISTRICT_NAME } from '../district/districts';
import { testIdProps } from '../hlynk/a11y';
import { CornerCutFrame } from '../neon/CornerCutFrame';
import { Text } from '../Text';
import { Pressable, View } from '../tw';
import type { ArcadeRiveSource } from '../game-controls/ArcadeRiveSurface.types.ts';
import { LOBBY_COPY, startAccessibleName, startHint } from './lobby-copy.ts';
import type { AngledStartState, StartVariant, ThemeVariant } from './lobby-contract.ts';
import { LobbyRiveSurface } from './LobbyRiveSurface';
import { useLobbyRiveBinding } from './use-lobby-rive-binding.ts';

/** Props of {@linkcode AngledStartButton}. */
export interface AngledStartButtonProps {
  /** Which START this is; decides the accessible name and hint. */
  readonly variant: StartVariant;
  /** The last verified district, spoken with a `continue` name and written to `lobby/resume/district`. */
  readonly district?: District;
  readonly state: AngledStartState;
  /** One press in `idle`. Never called while `loading` or `disabled`. */
  readonly onPress: () => void;
  /** Authored sibling: steady rim, no trace, colour-only press. */
  readonly reducedMotion: boolean;
  /** Page scheme, written to `theme/variant`. @default 'night' */
  readonly scheme?: ThemeVariant;
  /** The `start-angled` artboard. Absent: the housing, legend and target still work. */
  readonly rive?: ArcadeRiveSource;
  /** Stops the artboard's render loop (its trace loops) while the lobby is covered (review finding M15). @default false */
  readonly paused?: boolean;
  readonly testID?: string;
}

/** The START face is 64 pt tall at every width (08-handoff.md § Layout). */
export const START_HEIGHT_PT = 64;
/** Corner cut of the START face. */
export const START_CUT_PT = 24;

/**
 * Full-width angled START. Minimum 44 pt target (it is 64), role `button`,
 * sentence-case name, `busy` while loading, `g02.start.loading` spoken once
 * when loading begins.
 *
 * @see {@linkcode AngledStartButtonProps}
 */
export function AngledStartButton({
  variant,
  district,
  state,
  onPress,
  reducedMotion,
  scheme = 'night',
  rive,
  paused = false,
  testID,
}: AngledStartButtonProps) {
  const inert = state === 'loading' || state === 'disabled';
  const eligible = variant === 'continue';
  const districtName = district === undefined ? '' : DISTRICT_NAME[district];

  const binding = useLobbyRiveBinding((b) => {
    b.setStartState(state);
    b.setResume(eligible, districtName);
    b.setTheme(scheme);
    b.setReducedMotion(reducedMotion);
  });
  useEffect(() => { binding.write((b) => b.setStartState(state)); }, [binding, state]);
  useEffect(() => { binding.write((b) => b.setResume(eligible, districtName)); }, [binding, eligible, districtName]);
  useEffect(() => { binding.write((b) => b.setTheme(scheme)); }, [binding, scheme]);
  useEffect(() => { binding.write((b) => b.setReducedMotion(reducedMotion)); }, [binding, reducedMotion]);

  // `g02.start.loading` once per entry into loading (polite; 07-a11y.md).
  const previous = useRef<AngledStartState>(state);
  useEffect(() => {
    if (previous.current === state) return;
    previous.current = state;
    if (state === 'loading') AccessibilityInfo.announceForAccessibility(LOBBY_COPY.startLoadingA11y);
  }, [state]);

  const pressIn = () => binding.write((b) => b.setStartPressed(true));
  const pressOut = () => binding.write((b) => b.setStartPressed(false));
  const focusIn = () => binding.write((b) => b.setStartFocused(true));
  const focusOut = () => binding.write((b) => b.setStartFocused(false));

  const rimClass = reducedMotion ? (scheme === 'night' ? 'border-2 border-carolina-500' : 'border-2 border-royal-500') : '';
  const faceTone = inert ? palette.concrete[700] : state === 'pressed' ? palette.orange[400] : 'orange';

  return (
    <Pressable
      // The web press base is a real <button>, which takes data-testid; RN's Pressable takes testID.
      {...(testID === undefined ? {} : Platform.OS === 'web' ? testIdProps(testID) : { testID })}
      role="button"
      accessibilityLabel={startAccessibleName(variant, district)}
      accessibilityHint={startHint(variant)}
      accessibilityState={{ disabled: state === 'disabled' }}
      aria-disabled={inert}
      // The press base's state type has no `busy`; the ARIA attribute reaches both the DOM button and RN's Pressable.
      {...({ 'aria-busy': state === 'loading' } as object)}
      onPress={inert ? undefined : onPress}
      // The press base is typed on the web <button>; RN's Pressable takes press-in/out, the DOM pointer-down/up.
      {...(Platform.OS === 'web'
        ? { onPointerDown: pressIn, onPointerUp: pressOut, onFocus: focusIn, onBlur: focusOut }
        : ({ onPressIn: pressIn, onPressOut: pressOut, onFocus: focusIn, onBlur: focusOut } as object))}
      className={`w-full ${rimClass}`}
    >
      <CornerCutFrame
        corner="bottom-right"
        cut={START_CUT_PT}
        depth={inert ? 0 : 4}
        variant="solid"
        tone={faceTone}
        className="w-full items-center justify-center"
      >
        <View
          className="w-full items-center justify-center"
          // Computed: the face is 64 pt tall whatever the width (08-handoff.md § Layout).
          style={{ height: START_HEIGHT_PT }}
        >
          <LobbyRiveSurface
            riveFile={rive?.file}
            artboardName={rive?.artboardName}
            stateMachineName={rive?.stateMachineName}
            onBinding={binding.onBinding}
            paused={paused}
            style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
          />
          <Text
            variant="label"
            className={`text-type-tag uppercase ${inert ? 'text-silver-300' : 'text-on-cta'}`}
            numberOfLines={1}
            aria-hidden
          >
            {LOBBY_COPY.startLegend}
          </Text>
        </View>
      </CornerCutFrame>
    </Pressable>
  );
}
