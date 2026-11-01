import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALL_RECOVERY_CHOICES,
  failureLine,
  LOBBY_COPY,
  rankRegionLabel,
  rankStatusSpoken,
  recoveryActions,
  relativeAge,
  resumeDistrictLine,
  rowAccessibleLabel,
  staleHeadline,
  startAccessibleName,
  startHint,
} from './lobby-copy.ts';

describe('lobby copy', () => {
  it('names START per variant, sentence case, with the district when known (g02.start.a11y.*)', () => {
    assert.equal(startAccessibleName('new'), 'Start a new game');
    assert.equal(startAccessibleName('continue'), 'Continue your game');
    assert.equal(startAccessibleName('continue', 'harlem'), 'Continue your game, last seen in Harlem');
    assert.equal(startAccessibleName('recover'), 'Fix your last save');
    assert.equal(startHint('recover'), undefined);
    assert.equal(startHint('new'), LOBBY_COPY.startHintNew);
  });

  it('uses DISTRICT_NAME for the district line (g02.resume.district)', () => {
    assert.equal(resumeDistrictLine('megacity'), 'Last seen in Mega City');
  });

  it('maps each failure to its deck line and its recovery buttons', () => {
    assert.equal(failureLine({ kind: 'dataset-incompatible' }), LOBBY_COPY.failDataset);
    assert.equal(failureLine({ kind: 'unknown' }), LOBBY_COPY.failGeneric);
    assert.deepEqual(recoveryActions({ kind: 'dataset-incompatible' }, 'start-new'), {
      primary: { label: 'Start from your last district', choice: 'from-district' },
      secondary: { label: 'Start a new game', choice: 'new-game' },
    });
    // The conflict rule can refuse "Keep this one": the button is then absent.
    assert.equal(recoveryActions({ kind: 'newer-save-elsewhere' }, 'keep-waiting').secondary, undefined);
    assert.equal(recoveryActions({ kind: 'newer-save-elsewhere' }, 'retry-sync').secondary?.choice, 'keep-local');
    assert.equal(recoveryActions({ kind: 'unknown' }, 'retry-sync').primary.choice, 'retry');
  });

  it('formats the stale age in plain speech, floored at a minute', () => {
    assert.equal(relativeAge(0), 'a minute');
    assert.equal(relativeAge(4 * 60_000), '4 minutes');
    assert.equal(relativeAge(60 * 60_000), 'an hour');
    assert.equal(relativeAge(3 * 24 * 60 * 60_000), '3 days');
    assert.equal(relativeAge(Number.NaN), 'a minute');
    const now = Date.UTC(2026, 9, 15, 12, 0, 0);
    assert.equal(staleHeadline(now - 4 * 60_000, now), 'Last updated 4 minutes ago');
  });

  it('speaks rows without a score and the region with its status', () => {
    assert.equal(rowAccessibleLabel(3, 'Kestrel', false), 'Rank 3, Kestrel');
    assert.equal(rowAccessibleLabel(17, 'Sable', true), 'Rank 17, you');
    assert.equal(rankRegionLabel(rankStatusSpoken('unavailable')), "NYC Rank, Rankings aren't live yet.");
  });

  it('speaks only deck lines: ready and stale have no status, so the region says its title (finding M22)', () => {
    assert.equal(rankStatusSpoken('ready'), undefined);
    assert.equal(rankStatusSpoken('stale'), undefined);
    assert.equal(rankRegionLabel(rankStatusSpoken('ready')), 'NYC Rank');
    for (const status of ['loading', 'ready', 'empty', 'stale', 'error', 'unavailable'] as const) {
      assert.ok(!/\brows?\b/.test(rankRegionLabel(rankStatusSpoken(status))), `${status} speaks no "rows"`);
    }
  });

  it('never offers a recovery the host cannot perform (finding M12)', () => {
    const app = new Set(['new-game', 'retry', 'not-now'] as const);
    const all = [
      recoveryActions({ kind: 'dataset-incompatible' }, 'start-new', app),
      recoveryActions({ kind: 'save-unreadable' }, 'retry-sync', app),
      recoveryActions({ kind: 'newer-save-elsewhere' }, 'retry-sync', app),
      recoveryActions({ kind: 'newer-save-elsewhere' }, 'keep-waiting', app),
      recoveryActions({ kind: 'unknown' }, 'retry-sync', app),
    ];
    for (const actions of all) {
      assert.ok(app.has(actions.primary.choice as never), `primary ${actions.primary.choice}`);
      assert.notEqual(actions.primary.choice, 'not-now');
      if (actions.secondary) assert.ok(app.has(actions.secondary.choice as never), `secondary ${actions.secondary.choice}`);
    }
    // An unreadable save offers a new game (with the save quarantined) and a dismiss; both are deck strings.
    assert.deepEqual(all[1], {
      primary: { label: LOBBY_COPY.failDatasetSecondary, choice: 'new-game' },
      secondary: { label: LOBBY_COPY.failUnreadableSecondary, choice: 'not-now' },
    });
    // A changed map offers the new game as the only action.
    assert.deepEqual(all[0], { primary: { label: LOBBY_COPY.failDatasetSecondary, choice: 'new-game' } });
    // With every choice available the deck order is untouched.
    assert.equal(recoveryActions({ kind: 'save-unreadable' }, 'retry-sync', ALL_RECOVERY_CHOICES).primary.choice, 'restore-server');
  });
});
