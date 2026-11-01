import type { Meta, StoryObj } from '@storybook/react-vite';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import type { LayoutProfile } from '../game-controls/contract';
import { GameLobby, type GameLobbyProps } from './GameLobby';
import type { AngledStartState, LeaderboardModel, LeaderboardRow, ResumeSummary, TransitionPhase } from './lobby-contract';

/*
  The assembled lobby without the artboards: wordmark, the NYC Rank panel,
  the resume block, START, every state the handoff names
  (docs/design/screens/G02-game-lobby/08-handoff.md § States) and one story
  per LayoutProfile. `Starting` runs a story-local START: press it and the
  cover holds for a second, then drops.
*/

const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);
const ROWS: readonly LeaderboardRow[] = [
  { rank: 1, name: 'Vesper', isSelf: false, playerId: 'p-vesper' },
  { rank: 2, name: 'Nimbus', isSelf: false, playerId: 'p-nimbus' },
  { rank: 3, name: 'Kestrel', isSelf: false, playerId: 'p-kestrel' },
];
const SELF: LeaderboardRow = { rank: 17, name: 'Sable', isSelf: true, playerId: 'p-sable' };
const READY: LeaderboardModel = { status: 'ready', rows: ROWS, self: SELF };
const UNAVAILABLE: LeaderboardModel = { status: 'unavailable' };
const ELIGIBLE: ResumeSummary = { kind: 'eligible', district: 'harlem', savedAtMs: NOW - 60_000, revision: 12 };

const FRAME: Readonly<Record<LayoutProfile, string>> = {
  'phone-portrait': 'h-[667px] w-[375px]',
  'phone-landscape': 'h-[390px] w-[844px]',
  'fold-outer': 'h-[720px] w-[320px]',
  'fold-book': 'h-[720px] w-[840px]',
  'fold-tabletop': 'h-[840px] w-[720px]',
  tablet: 'h-[1024px] w-[768px]',
  web: 'h-[800px] w-[1024px]',
};

const meta = {
  title: 'Lobby/GameLobby',
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

type Partial = Omit<GameLobbyProps, 'onStart' | 'onRecover' | 'profile' | 'reducedMotion' | 'startState' | 'transitionPhase' | 'nowMs'> &
  Partial2;
interface Partial2 {
  profile?: LayoutProfile;
  reducedMotion?: boolean;
  startState?: AngledStartState;
  transitionPhase?: TransitionPhase;
}

function lobby(props: Partial) {
  const profile = props.profile ?? 'phone-portrait';
  return (
    <View className={`${FRAME[profile]} overflow-hidden border border-concrete-700`}>
      <GameLobby
        {...props}
        profile={profile}
        reducedMotion={props.reducedMotion ?? false}
        startState={props.startState ?? 'idle'}
        transitionPhase={props.transitionPhase ?? 'done'}
        nowMs={NOW}
        onStart={() => undefined}
        onRecover={() => undefined}
        onRetryLeaderboard={() => undefined}
        testID="g02-lobby"
      />
    </View>
  );
}

export const NewGame: Story = { render: () => lobby({ resume: { kind: 'none' }, leaderboard: UNAVAILABLE }) };
export const EligibleSave: Story = { render: () => lobby({ resume: ELIGIBLE, leaderboard: READY }) };
export const EligibleSaveNoDistrict: Story = { render: () => lobby({ resume: { ...ELIGIBLE, district: undefined }, leaderboard: READY }) };
export const Offline: Story = {
  render: () => lobby({ resume: { kind: 'offline', district: 'harlem', savedAtMs: NOW - 60_000, revision: 12 }, leaderboard: { status: 'stale', rows: ROWS, self: SELF, updatedAtMs: NOW - 15 * 60_000 } }),
};
export const ResumeFailedDataset: Story = {
  render: () => lobby({ resume: { kind: 'failed', reason: { kind: 'dataset-incompatible' }, recovery: 'start-new' }, leaderboard: READY }),
};
export const ResumeFailedUnreadable: Story = {
  render: () => lobby({ resume: { kind: 'failed', reason: { kind: 'save-unreadable' }, recovery: 'retry-sync' }, leaderboard: READY }),
};
export const ResumeFailedNewerSave: Story = {
  render: () => lobby({ resume: { kind: 'failed', reason: { kind: 'newer-save-elsewhere' }, recovery: 'retry-sync' }, leaderboard: READY }),
};
export const LeaderboardLoading: Story = { render: () => lobby({ resume: ELIGIBLE, leaderboard: { status: 'loading' } }) };
export const LeaderboardError: Story = { render: () => lobby({ resume: ELIGIBLE, leaderboard: { status: 'error', reason: 'transport' } }) };
export const ReducedMotion: Story = { render: () => lobby({ resume: ELIGIBLE, leaderboard: READY, reducedMotion: true }) };
export const Daylit: Story = {
  decorators: [(Story) => <View className="scheme-light"><Story /></View>],
  render: () => lobby({ resume: ELIGIBLE, leaderboard: READY, scheme: 'daylit' }),
};
export const Night: Story = { render: () => lobby({ resume: ELIGIBLE, leaderboard: READY, scheme: 'night' }) };
export const PhoneLandscape: Story = { render: () => lobby({ resume: ELIGIBLE, leaderboard: READY, profile: 'phone-landscape' }) };
export const FoldOuter: Story = { render: () => lobby({ resume: ELIGIBLE, leaderboard: READY, profile: 'fold-outer' }) };
export const FoldBook: Story = { render: () => lobby({ resume: ELIGIBLE, leaderboard: READY, profile: 'fold-book' }) };
export const FoldTabletop: Story = { render: () => lobby({ resume: ELIGIBLE, leaderboard: READY, profile: 'fold-tabletop' }) };
export const Tablet: Story = { render: () => lobby({ resume: ELIGIBLE, leaderboard: READY, profile: 'tablet' }) };
export const Web: Story = { render: () => lobby({ resume: ELIGIBLE, leaderboard: READY, profile: 'web', startState: 'disabled' }) };

interface StartingState {
  startState: AngledStartState;
  phase: TransitionPhase;
}

function StartingDemo() {
  const store = useInstanceStore<StartingState>(() => ({ startState: 'idle', phase: 'done' }));
  const { startState, phase } = useStore(store);
  return (
    <View className={`${FRAME['phone-portrait']} overflow-hidden border border-concrete-700`}>
      <GameLobby
        resume={ELIGIBLE}
        leaderboard={READY}
        profile="phone-portrait"
        reducedMotion={false}
        scheme="night"
        startState={startState}
        transitionPhase={phase}
        nowMs={NOW}
        onStart={() => {
          store.setState({ startState: 'loading', phase: 'enter' });
          setTimeout(() => store.setState({ phase: 'hold' }), 300);
          setTimeout(() => store.setState({ phase: 'reveal' }), 900);
          setTimeout(() => store.setState({ startState: 'idle', phase: 'done' }), 1300);
        }}
        onRecover={() => undefined}
        testID="g02-lobby"
      />
    </View>
  );
}

/** START holds `loading` under the cover until the (story-local) resume reports ready. */
export const Starting: Story = { render: () => <StartingDemo /> };
