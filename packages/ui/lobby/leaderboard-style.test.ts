import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contrastRatio, resolveToken } from '../../theme/contrast.ts';
import { DEFAULT_KEYLINE, DISTRICT_KEYLINE, keylineFor, leaderboardAccessibility, panelRowsOf, SELF_ROW_MARKER } from './leaderboard-style.ts';
import type { LeaderboardModel } from './lobby-contract.ts';

// The rank panel's face is SolidPanel tone="ink": ink-800 in both schemes.
const INK_FACE = resolveToken('ink-800', 'dark');

function tokenOf(className: string): string {
  return className.replace(/^border-(l-)?/, '');
}

describe('rank panel keylines on the ink face (finding H3)', () => {
  it('every district keyline, the default and the own-row marker clear 3:1 on ink-800', () => {
    const classes = [...Object.values(DISTRICT_KEYLINE), DEFAULT_KEYLINE, SELF_ROW_MARKER];
    for (const className of classes) {
      const ratio = contrastRatio(resolveToken(tokenOf(className), 'dark'), INK_FACE);
      assert.ok(ratio >= 3, `${className} measures ${ratio.toFixed(2)}:1 on ink-800`);
    }
  });

  it('the old steps fail there, so the test would have caught them', () => {
    for (const token of ['royal-500', 'orange-700']) {
      assert.ok(contrastRatio(resolveToken(token, 'dark'), INK_FACE) < 3, `${token} should fail on ink-800`);
    }
  });

  it('no district resolves to an unmeasured class', () => {
    assert.equal(keylineFor(undefined), DEFAULT_KEYLINE);
    assert.equal(keylineFor('harlem'), 'border-orange-600');
  });
});

describe('rank panel accessibility (findings H2, M22)', () => {
  const ready: LeaderboardModel = {
    status: 'ready',
    rows: [
      { rank: 1, name: 'Vesper', isSelf: false, playerId: 'p1' },
      { rank: 2, name: 'Nimbus', isSelf: false, playerId: 'p2' },
    ],
    self: { rank: 17, name: 'Sable', isSelf: true, playerId: 'p3' },
  };

  it('names the region by its title and gives every row, including the own row, its own label', () => {
    const a11y = leaderboardAccessibility(ready, panelRowsOf(ready));
    assert.equal(a11y.regionLabel, 'NYC Rank');
    assert.deepEqual(a11y.rowLabels, ['Rank 1, Vesper', 'Rank 2, Nimbus', 'Rank 17, you']);
  });

  it('a status state speaks its deck line in the region label and has no rows', () => {
    const error: LeaderboardModel = { status: 'error', reason: 'x' };
    assert.deepEqual(leaderboardAccessibility(error, panelRowsOf(error)), { regionLabel: "NYC Rank, Rankings didn't load.", rowLabels: [] });
  });

  it('the own row is not repeated when it is already on the page', () => {
    const onPage: LeaderboardModel = { ...ready, self: ready.rows[0]! };
    assert.equal(panelRowsOf(onPage).length, 2);
  });
});
