# Alexa offline contract evidence

This lane implements the offline portion of the [readiness plan](../../docs/plans/alexa-hackathon-readiness-ci.md). It is a draft gate, not a submission-readiness certificate.

## Run locally

Use the repository's Node and pnpm versions, then:

```sh
pnpm install --frozen-lockfile
python -m venv ../nyc-readiness-venv
../nyc-readiness-venv/bin/python -m pip install -r tooling/alexa-readiness/requirements.txt
pnpm exec playwright install --with-deps chromium
PATH="$PWD/../nyc-readiness-venv/bin:$PATH" node tooling/alexa-readiness/run.mjs
```

The pinned official `skills-ref` 0.1.0 package provides the `agentskills` command. The workflow installs its pinned dependencies and the Playwright-matched browser. Do not substitute the system browser to make a failed browser check pass. The example keeps the local Python environment outside the repository.

The runner writes `.alexa-readiness/report.json`, `report.md`, and per-run command logs/test evidence. Exit 0 means every required **offline** check passed. A failed command, missing/malformed test report, skipped test, empty suite, missing build output, or missing required check cannot pass. Setup failures produce explicit `NOT RUN` entries and a failing gate. Reports identify the tested checkout SHA separately from the PR head SHA because GitHub normally tests a PR merge ref. Locally modified trees are labeled.

## Coverage

- MCP transport/tool/auth/schema/idempotency contracts in `mcp-server/src/__tests__`.
- Actual OAuth provider behavior with the existing in-memory database adapter: PKCE, refresh rotation/replay, and caller eligibility. No live database is accessed.
- Simulator contracts and production build.
- Synthetic production configuration relationships checked against the runtime schemas and OAuth config parser. These fixtures test the contract; they do not inspect a deployed environment.
- Existing built MCP App browser/bridge and WebGPU fallback contracts in bundled Chromium. These checks do not establish complete accessibility or physical-device acceptance.
- Official Agent Skills reference validation and the three Alexa packages' TypeScript checks.

The runner passes an allowlisted tool environment to child commands, with no inherited provider/database credentials. Test fixtures use synthetic values. No `.env` file, live credentials, browser storage, deployment, or provider response belongs in the evidence artifact. The workflow has read-only repository permissions and does not persist checkout credentials.

## Still required

Every report explicitly records live smoke, deployed environment verification, full judge accessibility acceptance and physical-device acceptance as `NOT RUN`; `submissionReady` remains `false`. A protected live-provider workflow (real Bedrock turn, deployed OAuth/MCP, authorized care mutation and latency capture) is **not implemented** here. It needs separately approved environment/credential and live-action setup. Existing plans are retained, and the general monorepo CI remains unchanged.
