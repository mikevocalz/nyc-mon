'use client';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { motionTokens } from '@acme/theme';
import { Badge } from '../Badge';
import { NIGHT_SCHEME, NightScope } from '../NightScope';
import { ArrangementPanes } from '../arrangement';
import { AnimatedView } from '../progress/motion';
import { SafeArea } from '../SafeArea';
import { Text, View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { hiddenA11y } from './a11y';
import { ShellHiddenContext } from './hidden-context';
import { Announcer } from './Announcer';
import { HLYNK_COPY } from './copy';
import { HLynkBrandPane } from './HLynkBrandPane';
import { HLynkKey } from './HLynkKey';
import { HLynkScreen } from './HLynkScreen';
import type { HLynkShellProps, HLynkStatus, ShellKeyProps } from './HLynkShell.types';
import { HLYNK_GEOMETRY, placeBodyInFrame, resolveForcedLayout, type ShellGeometry } from './layout';
import { HLynkBox, HLynkFallbackPanes, type HLynkBoxSize } from './HLynkPanes';
import { ScannerLed, type ScannerLedProps } from './ScannerLed';
import { assertNever, isImplementedTier, resolveTier, type HLynkTier } from './tier';
import { Trackpad } from './Trackpad';
import { useKeyboardVisible } from './use-keyboard-visible';

export type { HLynkShellProps, HLynkStatus };

const G = HLYNK_GEOMETRY;
const POWER = motionTokens['motion-power-on'];
const ENTER = motionTokens['motion-enter'];

const TIER_NAME: Record<HLynkTier, string> = { core: 'H-Lynk Core', standard: 'H-Lynk', pro: 'H-Lynk Pro' };

function ledProps(status: HLynkStatus): Pick<ScannerLedProps, 'state'> & Partial<{ label: string; progress: number }> {
  switch (status.led) {
    case 'off':
    case 'boot':
      return { state: status.led };
    case 'incubating':
      return { state: 'incubating', label: status.label, progress: status.progress };
    case 'ready':
    case 'needsYou':
      return { state: status.led, label: status.label };
    default:
      return assertNever(status);
  }
}

function isDev(): boolean {
  const g = globalThis as { __DEV__?: boolean; process?: { env?: { NODE_ENV?: string } } };
  return typeof g.__DEV__ === 'boolean' ? g.__DEV__ : g.process?.env?.NODE_ENV !== 'production';
}

/**
 * The H-Lynk Core around a companion screen: matte red `apple-600` body,
 * black scanner head with the red emitter, a 3:4 screen in a black bezel, and
 * the control row (home, menu, trackpad, back, forward). Built from
 * {@linkcode ScannerLed}, {@linkcode HLynkScreen}, {@linkcode Trackpad} and
 * {@linkcode HLynkKey}.
 *
 * Layout is measured: on iPhone SE 3 the row gets 139 pt and uses 136; short
 * windows switch to the compact layout. Windows wider than a phone fit the
 * body to the height with the 3:4 screen kept (up to 600 pt wide, Decision
 * H-1). From 600 pt wide, and on any window a fold splits, the NYC-MON brand
 * pane takes the left (or, in tabletop, the upper) region and the device sits
 * wholly in the right (lower) one, never across a hinge or under a rail
 * (Decision H-2, docs/design/hlynk/ADAPTIVE.md). The pane pair goes through
 * `ArrangementPanes`: the native Arrangement View on Android and iOS 27.1+,
 * that planner elsewhere, and the body is centred in whichever pane it gets
 * (Decision H-4, docs/design/foldable-arrangements.md). The body never changes with the
 * scheme. Power-on (M01): body scale 0.98 → 1 and the emitter ramp over
 * 240 ms, then the screen fades up by 600 ms; reduced motion cuts each step.
 * The LED's label also appears as a chip in the screen's status row, so the
 * light is never the only carrier of its meaning.
 */
export function HLynkShell({
  tier = 'core',
  scheme = 'daylit',
  status = { led: 'off' },
  reducedMotion,
  layout: forcedLayout,
  screen,
  statusRow,
  trackpad,
  keys,
  power = 'on',
  powerOnAnnouncement = HLYNK_COPY['m01.a11y.power_on'],
  accessibilityHidden = false,
  insets,
  railRightPt = 0,
  testIDPrefix,
}: HLynkShellProps) {
  resolveTier(tier, 'HLynkShell');
  const id = (part: string) => (testIDPrefix ? `${testIDPrefix}-${part}` : undefined);
  const keyboardVisible = useKeyboardVisible();
  const forced = resolveForcedLayout(forcedLayout, keyboardVisible);
  const live = power === 'on';
  const night = scheme === 'night';

  // Announce only on the transition into `on`, never on a plain mount.
  const announce = useInstanceStore(() => ({ message: undefined as string | undefined }));
  const message = useStore(announce, (s) => s.message);
  const prevPower = useRef(power);
  useEffect(() => {
    if (prevPower.current !== 'on' && power === 'on') announce.setState({ message: powerOnAnnouncement });
    prevPower.current = power;
  }, [power, powerOnAnnouncement, announce]);

  const led = ledProps(status);
  const chip = 'label' in led && led.label ? led.label : undefined;

  const powerStep = reducedMotion ? POWER.reduced : POWER.full;
  const scale = !reducedMotion && power === 'off' && powerStep.kind === 'tween' && powerStep.scale !== undefined ? powerStep.scale : 1;
  const rampMs = powerStep.kind === 'tween' ? powerStep.durationMs : 0;
  const coverMs = reducedMotion ? 0 : 600 - rampMs;

  const placeholder = !isImplementedTier(tier) && isDev();

  // The device for the box its pane gives it: sized and centred by
  // placeBodyInFrame, the same arithmetic on every arrangement backend, so the
  // body's centre is its pane's centre and both rails stay inside the pane.
  const renderDevice = (box: HLynkBoxSize) => {
    const { geo, left, top } = placeBodyInFrame(box, forced);
    return renderBody(geo, left, top);
  };

  function renderBody(geo: ShellGeometry, left: number, top: number) {
    const compact = geo.layout === 'compact';
    const keyFor = (role: 'home' | 'menu' | 'back' | 'forward') => {
      const k: ShellKeyProps = keys?.[role] ?? {};
      return (
        <HLynkKey
          key={role}
          tier={tier}
          role={role}
          reducedMotion={reducedMotion}
          label={k.label}
          disabled={k.disabled || !live}
          onPress={live ? k.onPress : undefined}
          testID={k.testID ?? id(`key-${role}`)}
        />
      );
    };

    const pad = (
      <Trackpad
        {...trackpad}
        tier={tier}
        shape={compact ? 'pill' : 'square'}
        sizePt={geo.trackpadPt}
        reducedMotion={reducedMotion}
        disabled={trackpad.disabled || !live}
        testID={trackpad.testID ?? id('trackpad')}
      />
    );

    return (
        <AnimatedView
          testID={id('shell')}
          className="relative bg-hlynk-core-body"
          style={{
            position: 'absolute',
            left,
            top,
            width: geo.bodyWidthPt,
            height: geo.bodyHeightPt,
            transform: [{ scale }],
            transitionProperty: ['transform'],
            transitionDuration: `${power === 'off' ? 0 : rampMs}ms`,
            transitionTimingFunction: 'ease-out',
          } as object}
        >
          {/* Stub antenna, top-left in the rail. Decorative. */}
          {!compact ? (
            <View {...hiddenA11y(true)} className="absolute bg-hlynk-core-black" style={{ left: 3, top: 0, width: 6, height: G.headPt - 8 }} />
          ) : null}
          <View style={{ paddingHorizontal: compact ? 0 : G.railPt }}>
            <ScannerLed
              tier={tier}
              {...(led as ScannerLedProps)}
              size={compact ? 'compact' : 'standard'}
              fan={status.led === 'boot'}
              reducedMotion={reducedMotion}
              testID={id('led')}
            />
          </View>
          <View
            className="relative self-center"
            style={{ width: geo.screenWidthPt, height: geo.screenHeightPt }}
          >
            <HLynkScreen
              tier={tier}
              aspect={compact ? 'fill' : '3:4'}
              testID={id('screen')}
              statusRow={chip || statusRow ? (
                <>
                  {chip ? <Badge label={chip} size="sm" tone="neutral" /> : null}
                  {statusRow}
                </>
              ) : undefined}
            >
              {screen}
            </HLynkScreen>
            {/* The dark screen before power-on. Cuts away under reduced motion. */}
            <AnimatedView
              {...hiddenA11y(true)}
              className="absolute inset-0 bg-hlynk-core-black"
              style={{
                pointerEvents: live ? 'none' : 'auto',
                opacity: live ? 0 : 1,
                transitionProperty: ['opacity'],
                transitionDuration: `${live ? coverMs : 0}ms`,
                transitionTimingFunction: 'ease-out',
              } as object}
            />
            {placeholder ? (
              <View className="absolute bottom-3 left-3 right-3 bg-hlynk-core-body px-2 py-1">
                <Text className="text-type-caption text-hlynk-core-ink">{`${TIER_NAME[tier]} placeholder: draws the Core look`}</Text>
              </View>
            ) : null}
          </View>
          <View
            className="flex-row items-center justify-evenly"
            style={{ height: geo.rowPt, paddingHorizontal: G.railPt, columnGap: G.minGapPt }}
          >
            {keyFor('home')}
            {keyFor('menu')}
            {pad}
            {keyFor('back')}
            {keyFor('forward')}
          </View>
        </AnimatedView>
    );
  }

  const renderBrand = (box: HLynkBoxSize) => (
    <HLynkBrandPane widthPt={box.width} heightPt={box.height} scheme={scheme} reducedMotion={reducedMotion} testID={id('brand')} />
  );

  // Brand pane secondary, H-Lynk primary on the PHYSICAL right (in RTL too,
  // like the rail). Overlay: beside each other across a separating or
  // half-open fold (Duo span, book: brand left; tabletop: brand above),
  // H-Lynk alone otherwise. Native Arrangement View on Android and iOS 27.1;
  // the Decision H-2 planner everywhere else (docs/design/foldable-arrangements.md).
  const content = (
    <View className={`flex-1 bg-bg ${night && Platform.OS === 'web' ? NIGHT_SCHEME : ''}`}>
      <ArrangementPanes
        arrangement="overlay"
        primarySide="right"
        insetRightPt={railRightPt}
        testID={id('arrangement')}
        primary={<View testID={id('device-pane')} className="flex-1 bg-bg"><HLynkBox>{renderDevice}</HLynkBox></View>}
        secondary={(shown) => (shown ? <HLynkBox>{renderBrand}</HLynkBox> : null)}
        fallback={() => (
          <HLynkFallbackPanes force={forced} railRightPt={railRightPt} device={renderDevice} brand={renderBrand} testIDPrefix={testIDPrefix} />
        )}
      />
      <Announcer message={message} />
    </View>
  );

  const scoped = night ? <NightScope>{content}</NightScope> : content;
  return (
    <ShellHiddenContext.Provider value={accessibilityHidden}>
    <View
      className={`flex-1 bg-bg ${night && Platform.OS === 'web' ? NIGHT_SCHEME : Platform.OS === 'web' ? 'scheme-light' : ''}`}
      {...hiddenA11y(accessibilityHidden)}
    >
      {insets ? (
        <View className="flex-1" style={{ paddingTop: insets.topPt, paddingBottom: insets.bottomPt }}>{scoped}</View>
      ) : (
        <SafeArea className="flex-1" edges={['top', 'bottom', 'left', 'right']}>{scoped}</SafeArea>
      )}
    </View>
    </ShellHiddenContext.Provider>
  );
}

/** Duration of the first-run shell lowering, full and reduced (`motion-enter`). */
export const SHELL_HANDOFF_MS = {
  full: ENTER.full.kind === 'tween' ? ENTER.full.durationMs : 300,
  reduced: ENTER.reduced.kind === 'tween' ? ENTER.reduced.durationMs : 200,
} as const;
