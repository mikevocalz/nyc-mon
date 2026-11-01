import type { Meta, StoryObj } from '@storybook/react-vite';
import { View } from '../tw';
import { LeaderboardPanel } from './LeaderboardPanel';
import type { LeaderboardModel, LeaderboardRow } from './lobby-contract';

/*
  The NYC Rank panel without the `leaderboard` artboard: the kit's ink board,
  one story per `LeaderboardStatus` (contract.ts) plus the own-row cases.
  Rows carry rank and name only: no unit exists, so no score is shown or
  spoken (05-copy.md). The names are the Rive data contract's sample rows
  (docs/evidence/rive/game-lobby/data-contract.data.json).
*/

const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);

const ROWS: readonly LeaderboardRow[] = [
  { rank: 1, name: 'Vesper', isSelf: false, playerId: 'p-vesper' },
  { rank: 2, name: 'Nimbus', isSelf: false, playerId: 'p-nimbus' },
  { rank: 3, name: 'Kestrel', isSelf: false, playerId: 'p-kestrel' },
];
const SELF: LeaderboardRow = { rank: 17, name: 'Sable', isSelf: true, playerId: 'p-sable' };

const meta = {
  title: 'Lobby/LeaderboardPanel',
  decorators: [
    (Story) => (
      <View className="w-[343px] bg-bg p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function panel(model: LeaderboardModel, reducedMotion = false) {
  return <LeaderboardPanel model={model} reducedMotion={reducedMotion} nowMs={NOW} onRetry={() => undefined} testID="g02-rank" />;
}

export const Loading: Story = { render: () => panel({ status: 'loading' }) };
export const Ready: Story = { render: () => panel({ status: 'ready', rows: ROWS, self: SELF }) };
export const Empty: Story = { render: () => panel({ status: 'empty', selfEligible: true }) };
export const EmptyNotEligible: Story = { render: () => panel({ status: 'empty', selfEligible: false }) };
export const Stale: Story = { render: () => panel({ status: 'stale', rows: ROWS, self: SELF, updatedAtMs: NOW - 4 * 60_000 }) };
export const Error: Story = { render: () => panel({ status: 'error', reason: 'transport' }) };
/** The default until a ranking authority exists: same header, same height. */
export const Unavailable: Story = { render: () => panel({ status: 'unavailable' }) };
export const SelfInTopThree: Story = {
  render: () => panel({ status: 'ready', rows: [ROWS[0]!, { ...SELF, rank: 2 }, { ...ROWS[2]!, rank: 3 }], self: { ...SELF, rank: 2 } }),
};
export const SelfOutsideList: Story = { render: () => panel({ status: 'ready', rows: ROWS, self: SELF }) };
export const LongName: Story = {
  render: () => panel({ status: 'ready', rows: [{ ...ROWS[0]!, name: 'Vesper of the Grand Concourse' }, ROWS[1]!, ROWS[2]!], self: null }),
};
/** Instant status changes, no skeleton sweep. */
export const ReducedMotion: Story = { render: () => panel({ status: 'loading' }, true) };
export const DistrictKeyline: Story = {
  render: () => <LeaderboardPanel model={{ status: 'ready', rows: ROWS, self: SELF }} reducedMotion={false} district="harlem" nowMs={NOW} />,
};
