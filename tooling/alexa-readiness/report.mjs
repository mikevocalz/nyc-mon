/** Offline evidence can never certify a live deployment. */
export const requiredCheckIds = Object.freeze([
  'evidence-contract', 'mcp-contracts', 'oauth-provider-contracts', 'simulator-contracts',
  'environment-contract-fixtures', 'judge-view-browser-contracts', 'agent-skill-format',
  'alexa-types', 'simulator-production-build',
]);

export function testEvidence(result, exitCode, commandError = false) {
  const counts = ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests'];
  if (commandError || exitCode !== 0 || !result || result.success !== true ||
      !counts.every((key) => Number.isSafeInteger(result[key]) && result[key] >= 0) ||
      result.numTotalTests === 0 || result.numPassedTests !== result.numTotalTests ||
      result.numFailedTests !== 0 || result.numPendingTests !== 0 ||
      !Array.isArray(result.testResults) || result.testResults.length === 0) {
    return { status: 'FAILED', reason: 'Missing, failed, skipped, empty or malformed test evidence.' };
  }
  if (result.testResults.some((suite) => !suite || !Array.isArray(suite.assertionResults))) {
    return { status: 'FAILED', reason: 'Test details are malformed or missing.' };
  }
  const assertions = result.testResults.flatMap((suite) => suite.assertionResults);
  if (assertions.length !== result.numTotalTests || assertions.some((test) => !test || test.status !== 'passed')) {
    return { status: 'FAILED', reason: 'Test details do not establish every reported pass.' };
  }
  return { status: 'PASSED', tests: result.numPassedTests };
}

export function makeReport({ checkoutSha, pullRequestHeadSha = null, dirty, checks, now = new Date() }) {
  if (!/^[0-9a-f]{40}$/.test(checkoutSha)) throw new Error('An exact checkout commit is required.');
  if (pullRequestHeadSha !== null && !/^[0-9a-f]{40}$/.test(pullRequestHeadSha)) {
    throw new Error('Invalid pull-request head commit.');
  }
  if (!Array.isArray(checks) || checks.length !== requiredCheckIds.length ||
      checks.some((check) => !check || !requiredCheckIds.includes(check.id) || !['PASSED', 'FAILED', 'NOT RUN'].includes(check.status)) ||
      new Set(checks.map((check) => check.id)).size !== checks.length) {
    throw new Error('Every required offline check needs exactly one explicit status.');
  }
  return {
    schemaVersion: 1,
    checkedAt: now.toISOString(),
    checkoutSha,
    pullRequestHeadSha,
    dirtyWorkingTree: Boolean(dirty),
    scope: 'Offline contract evidence; no release or live-provider certification.',
    offlineStatus: checks.every((check) => check.status === 'PASSED') ? 'PASSED' : 'FAILED',
    checks,
    liveSmoke: { status: 'NOT RUN', reason: 'No Bedrock call, deployed OAuth flow, live database mutation or live latency measurement was run.' },
    remainingAcceptance: [
      { id: 'deployed-production-environment', status: 'NOT RUN' },
      { id: 'judge-accessibility-acceptance', status: 'NOT RUN' },
      { id: 'physical-device-acceptance', status: 'NOT RUN' },
    ],
    submissionReady: false,
  };
}

export function markdownReport(report) {
  return [
    '# Alexa offline contract evidence',
    '',
    `Tested checkout: ${report.checkoutSha}`,
    `PR head: ${report.pullRequestHeadSha ?? 'local run'}`,
    `Working tree: ${report.dirtyWorkingTree ? 'modified; commit alone does not identify local changes' : 'clean'}`,
    '',
    `Offline checks: **${report.offlineStatus}**`,
    ...report.checks.map((check) => `- ${check.id}: ${check.status}${check.tests ? ` (${check.tests} tests)` : ''}${check.reason ? ` — ${check.reason}` : ''}`),
    '',
    '**Live smoke: NOT RUN. Submission readiness: not established.**',
    report.liveSmoke.reason,
    'Deployment environment, complete judge accessibility acceptance and physical-device acceptance remain NOT RUN.',
    '',
  ].join('\n');
}
