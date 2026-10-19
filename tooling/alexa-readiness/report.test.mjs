import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeReport, markdownReport, requiredCheckIds, testEvidence } from './report.mjs';

const checks = (status = 'PASSED') => requiredCheckIds.map((id) => ({ id, status }));
const sha = 'a'.repeat(40);
const good = () => ({ success: true, numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, numPendingTests: 0,
  testResults: [{ assertionResults: [{ status: 'passed' }] }] });

describe('test evidence fails closed', () => {
  it('accepts complete passing evidence', () => assert.deepEqual(testEvidence(good(), 0), { status: 'PASSED', tests: 1 }));
  for (const [name, patch, code] of [
    ['failed command', {}, 1],
    ['interrupted command', {}, null],
    ['failed suite', { success: false }, 0],
    ['skips', { numPendingTests: 1 }, 0],
    ['empty suite', { numTotalTests: 0, numPassedTests: 0 }, 0],
    ['string counts', { numTotalTests: '1' }, 0],
    ['no test details', { testResults: [] }, 0],
    ['missing assertion', { testResults: [{}] }, 0],
    ['null suite', { testResults: [null] }, 0],
    ['malformed assertions', { testResults: [{ assertionResults: 1 }] }, 0],
    ['null assertion', { testResults: [{ assertionResults: [null] }] }, 0],
    ['pending assertion', { testResults: [{ assertionResults: [{ status: 'pending' }] }] }, 0],
  ]) {
    it(`rejects ${name}`, () => assert.equal(testEvidence({ ...good(), ...patch }, code).status, 'FAILED'));
  }
  it('rejects a command error despite a passing report and zero status', () => assert.equal(testEvidence(good(), 0, true).status, 'FAILED'));
  it('rejects absent evidence', () => assert.equal(testEvidence(undefined, 0).status, 'FAILED'));
});

describe('report truthfulness', () => {
  it('never converts offline passes into live acceptance', () => {
    const report = makeReport({ checkoutSha: sha, checks: checks(), dirty: false });
    assert.equal(report.offlineStatus, 'PASSED');
    assert.equal(report.liveSmoke.status, 'NOT RUN');
    assert.equal(report.submissionReady, false);
    assert.match(markdownReport(report), /Live smoke: NOT RUN/);
  });
  it('treats NOT RUN as an incomplete offline gate', () => {
    assert.equal(makeReport({ checkoutSha: sha, checks: checks('NOT RUN') }).offlineStatus, 'FAILED');
  });
  it('separates the tested merge checkout from the PR head and marks local modifications', () => {
    const report = makeReport({ checkoutSha: sha, pullRequestHeadSha: 'b'.repeat(40), dirty: true,
      checks: checks() });
    assert.notEqual(report.checkoutSha, report.pullRequestHeadSha);
    assert.equal(report.dirtyWorkingTree, true);
  });
  it('rejects unknown statuses, duplicate IDs, absent checks and invalid commits', () => {
    for (const checks of [[], [{ id: requiredCheckIds[0], status: 'PASSED' }], [{ id: 'x', status: 'green' }], [{ id: 'x', status: 'PASSED' }, { id: 'x', status: 'PASSED' }]]) {
      assert.throws(() => makeReport({ checkoutSha: sha, checks }));
    }
    assert.throws(() => makeReport({ checkoutSha: 'main', checks: checks() }));
    assert.throws(() => makeReport({ checkoutSha: sha, checks: [...checks().slice(1), checks()[1]] }));
    assert.throws(() => makeReport({ checkoutSha: sha, checks: checks().map((check, i) => i === 0 ? { ...check, status: 'green' } : check) }));
    assert.throws(() => makeReport({ checkoutSha: sha, checks: checks().map((check, i) => i === 0 ? null : check) }));
  });
});
