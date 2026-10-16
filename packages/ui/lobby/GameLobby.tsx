'use client';
// The Game tab's lobby (Master Directive v2 §3; G02 08-handoff.md). Hierarchy
// top to bottom, fixed by §3: identity → NYC Rank → resume status → START.
// Nothing else: no cards, promo widgets or streaks (03-direction.md).
//
// The app owns every decision: `resume` comes from `resolveResume` before
// the first paint, `leaderboard` from the leaderboard source, `startState`
// and `transitionPhase` from the lobby store. This frame lays the four parts
// out per `profile`, names them for assistive tech (07-a11y.md), opens the
// recovery dialog for a failed resume and reports `onStart`, `onRecover` and
// `onRetryLeaderboard`. The leaderboard never blocks START; START never
// blocks the leaderboard (§14 fixture 11).
//
// Layout per LayoutProfile (08-handoff.md § Layout): one column for
// phone-portrait, fold-outer, fold-tabletop, tablet and web; two columns on
// the gutter grid for phone-landscape and fold-book (panel left, resume +
// START right, so nothing sits on a vertical hinge). Tablet and web cap the
// content at `content-screen`. On Android and iOS 27.1+ the panes go through
// `ArrangementPanes` (react-native-arrangement-view): across a vertical fold
// or on a regular-width window, identity + NYC Rank on the left and resume +
// START vertically centred on the right, split exactly at the hinge;
// tabletop puts them above and below the fold; a compact window keeps the
// single column. Web, XR and older iOS keep the profile layout
// (docs/design/foldable-arrangements.md).
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import { ArrangementPanes } from '../arrangement';
import { Button } from '../Button';
import { BrandWordmark } from '../brand/BrandWordmark';
import { Heading } from '../Heading';
import { testIdProps } from '../hlynk/a11y';
import { ResponsiveDialog } from '../ResponsiveDialog';
import { SafeArea } from '../SafeArea';
import { SignageBand } from '../SignageBand';
import { Text } from '../Text';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import type { LayoutProfile } from '../game-controls/contract.ts';
import { AngledStartButton } from './AngledStartButton.tsx';
import { GameTransition } from './GameTransition.tsx';
import { LeaderboardPanel } from './LeaderboardPanel.tsx';
import { LOBBY_PRIMARY_SIDE, lobbyPaneArrangement } from './lobby-arrangement.ts';
import { ALL_RECOVERY_CHOICES, failureLine, LOBBY_COPY, recoveryActions, resumeDistrictLine } from './lobby-copy.ts';
import { isLobbyCovered } from './lobby-playback.ts';
import type {
  AngledStartState,
  LeaderboardModel,
  RecoveryChoice,
  ResumeSummary,
  StartVariant,
  ThemeVariant,
  TransitionPhase,
} from './lobby-contract.ts';
import type { GameLobbyRive } from './lobby-rive.ts';

/** Props of {@linkcode GameLobby}. */
export interface GameLobbyProps {
  readonly resume: ResumeSummary;
  readonly leaderboard: LeaderboardModel;
  readonly profile: LayoutProfile;
  readonly reducedMotion: boolean;
  /** Page scheme from the clock (D8). @default 'night' */
  readonly scheme?: ThemeVariant;
  /** START's visual state; the app sets `loading` while `onStart` runs. */
  readonly startState: AngledStartState;
  /** The cover's phase; `done` shows the lobby. */
  readonly transitionPhase: TransitionPhase;
  /** START pressed with a `none`, `eligible` or `offline` resume. */
  readonly onStart: () => void;
  /** A recovery chosen from the dialog. The app runs it; the old save stays until it confirms. */
  readonly onRecover: (choice: RecoveryChoice) => void;
  /**
   * The recoveries the host can actually carry out. The dialog offers only
   * these, falling back to "Start a new game" or "Try again" (review finding
   * M12: no button that closes the dialog and changes nothing).
   * @default every {@linkcode RecoveryChoice}
   */
  readonly recoveryChoices?: ReadonlySet<RecoveryChoice>;
  /** The last START failed: the strip shows `g02.resume.fail.generic` until the next press (review finding C1). @default false */
  readonly startFailed?: boolean;
  readonly onRetryLeaderboard?: () => void;
  readonly rive?: GameLobbyRive;
  /** When the lobby was opened (epoch ms), for the stale age; from the app's store, never read during render. */
  readonly nowMs: number;
  readonly testID?: string;
}

interface LobbyFrameState {
  readonly dialogOpen: boolean;
}

function startVariantOf(resume: ResumeSummary): StartVariant {
  switch (resume.kind) {
    case 'none':
      return 'new';
    case 'eligible':
    case 'offline':
      return 'continue';
    case 'failed':
      return 'recover';
  }
}

function districtOf(resume: ResumeSummary) {
  return resume.kind === 'eligible' || resume.kind === 'offline' ? resume.district : undefined;
}

const TWO_COLUMN: ReadonlySet<LayoutProfile> = new Set(['phone-landscape', 'fold-book']);
const CAPPED: ReadonlySet<LayoutProfile> = new Set(['tablet', 'web']);

/**
 * The assembled lobby. Focus order: wordmark (h1) → panel region → resume
 * title → strip → START (07-a11y.md). START is last in reading order and
 * first in importance.
 *
 * @see {@linkcode GameLobbyProps}
 */
export function GameLobby({
  resume,
  leaderboard,
  profile,
  reducedMotion,
  scheme = 'night',
  startState,
  transitionPhase,
  onStart,
  onRecover,
  recoveryChoices = ALL_RECOVERY_CHOICES,
  startFailed = false,
  onRetryLeaderboard,
  rive,
  nowMs,
  testID,
}: GameLobbyProps) {
  const frame = useInstanceStore<LobbyFrameState>(() => ({ dialogOpen: false }));
  const dialogOpen = useStore(frame, (s) => s.dialogOpen);
  const variant = startVariantOf(resume);
  const district = districtOf(resume);
  const twoColumn = TWO_COLUMN.has(profile);
  const tabletop = profile === 'fold-tabletop';
  // While the cover is up, the lobby under it is neither reachable by a screen reader nor animating (review findings H1, M15).
  const covered = isLobbyCovered(transitionPhase);

  // `g02.screen.a11y` is announced once when the lobby opens (review finding L6): a label on a plain View is never read.
  // A lobby that mounts already covered (re-hosted over the world mid-START) is not an opening and stays quiet.
  const coveredAtMount = useRef(covered);
  useEffect(() => {
    if (!coveredAtMount.current) AccessibilityInfo.announceForAccessibility(LOBBY_COPY.screenA11y);
  }, []);

  const choose = (choice: RecoveryChoice) => {
    frame.setState({ dialogOpen: false });
    onRecover(choice);
  };

  const resumeBlock = (
    <View className="gap-1" {...(testIdProps(testID ? `${testID}-resume` : undefined) as object)}>
      <Heading level={2} size="title" {...(testIdProps(testID ? `${testID}-resume-title` : undefined) as object)}>
        {variant === 'new' ? LOBBY_COPY.resumeTitleNew : LOBBY_COPY.resumeTitleContinue}
      </Heading>
      {variant === 'new' ? (
        <Text variant="caption" tone="muted">{LOBBY_COPY.resumeBodyNew}</Text>
      ) : district === undefined ? null : (
        <Text variant="body" tone="muted" {...(testIdProps(testID ? `${testID}-resume-district` : undefined) as object)}>
          {resumeDistrictLine(district)}
        </Text>
      )}
    </View>
  );

  const strip = (() => {
    if (startFailed) {
      return (
        <View {...(testIdProps(testID ? `${testID}-start-failed` : undefined) as object)} accessibilityLiveRegion="polite">
          <SignageBand tone="signage" size="strip" headline={LOBBY_COPY.failGeneric} />
        </View>
      );
    }
    if (resume.kind === 'offline') {
      return <SignageBand tone="signage" size="strip" headline={LOBBY_COPY.resumeOffline} />;
    }
    if (resume.kind === 'failed') {
      return (
        <View {...(testIdProps(testID ? `${testID}-resume-strip` : undefined) as object)}>
          <SignageBand tone="signage" size="strip" headline={failureLine(resume.reason)} />
        </View>
      );
    }
    return null;
  })();

  const start = (
    <AngledStartButton
      variant={variant}
      district={district}
      state={startState}
      reducedMotion={reducedMotion}
      scheme={scheme}
      rive={rive?.start}
      paused={covered}
      onPress={variant === 'recover' ? () => frame.setState({ dialogOpen: true }) : onStart}
      testID={testID ? `${testID}-start` : undefined}
    />
  );

  const panelFor = (fill: boolean) => (
    <LeaderboardPanel
      fill={fill}
      model={leaderboard}
      reducedMotion={reducedMotion}
      district={district}
      onRetry={onRetryLeaderboard}
      rive={rive?.leaderboard}
      paused={covered}
      nowMs={nowMs}
      testID={testID ? `${testID}-rank` : undefined}
    />
  );
  const panel = panelFor(false);

  const wordmark = (
    <View {...(testIdProps(testID ? `${testID}-wordmark` : undefined) as object)} accessibilityRole="header">
      <BrandWordmark height={28} />
    </View>
  );

  // Today's layout for the profile: the whole lobby when it has one pane.
  const singleColumn = (
    <View className={`flex-1 gap-6 px-4 pb-4 pt-6 ${CAPPED.has(profile) ? 'w-full max-w-content-screen self-center' : ''}`}>
      {wordmark}
      {twoColumn ? (
        <View className="flex-1 flex-row gap-6">
          <View className="basis-[48%]">{panel}</View>
          <View className="flex-1 justify-between gap-6">
            <View className="gap-3">
              {resumeBlock}
              {strip}
            </View>
            {start}
          </View>
        </View>
      ) : (
        <View className={`flex-1 gap-6 ${tabletop ? 'justify-between' : ''}`}>
          {panel}
          <View className="gap-3">
            {resumeBlock}
            {strip}
          </View>
          <View className={tabletop ? '' : 'mt-auto'}>{start}</View>
        </View>
      )}
    </View>
  );

  // Paired panes (native backend, beside each other): identity + rank in the
  // companion pane, resume + START vertically centred in the primary.
  const identityPane = (
    <View className="flex-1 gap-6 px-4 pb-4 pt-6">
      {wordmark}
      {/* Beside START the board runs the full height of its pane. */}
      <View className="flex-1">{panelFor(true)}</View>
    </View>
  );
  const resumePane = (
    <View className="flex-1 justify-center gap-6 px-4 py-4">
      <View className="gap-3">
        {resumeBlock}
        {strip}
      </View>
      {start}
    </View>
  );

  const actions = resume.kind === 'failed' ? recoveryActions(resume.reason, resume.recovery, recoveryChoices) : null;

  return (
    <SafeArea edges={['top', 'bottom']} className="flex-1 bg-bg" {...(testIdProps(testID) as object)}>
      <View
        className="flex-1"
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        aria-hidden={covered}
      >
        <ArrangementPanes
          arrangement={lobbyPaneArrangement(profile)}
          primarySide={LOBBY_PRIMARY_SIDE}
          testID={testID ? `${testID}-arrangement` : undefined}
          primary={(paired) => (paired ? resumePane : singleColumn)}
          secondary={(shown) => (shown ? identityPane : null)}
          fallback={() => singleColumn}
        />
      </View>
      {actions ? (
        <ResponsiveDialog
          open={dialogOpen}
          onClose={() => frame.setState({ dialogOpen: false })}
          title={LOBBY_COPY.recoveryDialogTitle}
          description={resume.kind === 'failed' ? failureLine(resume.reason) : undefined}
          actions={
            <>
              {actions.secondary ? (
                <Button variant="outline" size="lg" title={actions.secondary.label} onPress={() => choose(actions.secondary!.choice)} />
              ) : null}
              <Button variant="cta" size="lg" title={actions.primary.label} onPress={() => choose(actions.primary.choice)} />
            </>
          }
        />
      ) : null}
      <GameTransition phase={transitionPhase} reducedMotion={reducedMotion} scheme={scheme} rive={rive?.transition} testID={testID ? `${testID}-transition` : undefined} />
    </SafeArea>
  );
}
