# Amazon hackathon readiness CI lane

## Mission

Add a focused readiness gate for the NYC-Mon Amazon Build, Ship, Shape submission so hackathon-critical regressions cannot hide behind the general monorepo test suite.

This branch is stacked on `feat/alexa-plus`.

## Engineering owners

- Technical Fellow — gate definition and scope control
- Staff DevOps / Release Engineer — CI implementation
- Principal MCP Engineer — protocol/tool assertions
- Principal Identity Engineer — auth assertions
- Principal TypeScript Engineer — schema/type gates
- Verification Fellow — acceptance criteria and false-positive review

## Mandatory skills / tools

Use the strongest available equivalents of:

- CI/CD engineering
- testing-strategy
- verification-before-completion
- `vercel/deployments-cicd` if hosted runtime uses Vercel
- `vercel/env-vars` for environment-contract checks
- `vercel/react-best-practices` for simulator changes
- CodeRabbit review
- repository hygiene
- no-ai-slop for CI/readiness docs

## Required gate coverage

The readiness workflow should cover the highest-risk submission requirements without making every pull request depend on paid/live external calls.

### MCP

- protocol handshake compatibility required by current Amazon rules
- tools/list contract
- schema validation
- unauthorized request rejection
- service-token discovery-only restrictions
- mutation idempotency contracts

### Identity / OAuth

- PKCE S256 contract
- issuer/resource validation
- refresh rotation/replay tests
- under-18 refusal
- production dev-bypass assertion
- service-token/user-data separation

### Agent / simulator

- Agent Skill validator
- simulator production build
- web-sim focused tests
- malformed model/tool payload handling
- no silent mock fallback in production mode

### Environment contract

Assert required production variable names/config relationships without printing secrets.

Include checks for:

- issuer/resource alignment
- allowed origins configuration
- production mode
- disabled dev bypasses
- required OAuth client configuration
- required service key presence at runtime boundary
- Bedrock runtime configuration contract

### Judge UI

Run focused accessibility and browser tests that catch:

- known contrast regressions
- broken MCP App bridge
- WebGPU fallback failure
- inaccessible auth/error states

## Live provider smoke tests

Do NOT call Bedrock on every commit.

Provide an explicit protected/manual workflow for:

- real Bedrock turn
- deployed OAuth link
- deployed MCP request
- representative care mutation
- latency capture

The workflow must fail clearly when credentials/environment are unavailable rather than silently switching to mocks.

## Evidence artifact

CI should emit a concise hackathon-readiness artifact/report containing:

- commit SHA
- date
- MCP checks
- auth checks
- simulator/build checks
- agent-skill validation
- environment-contract result
- live-smoke status: PASSED / NOT RUN / FAILED

"NOT RUN" must never render as "PASSED".

## Non-goals

- no unrelated whole-repo refactor
- no paid provider calls on every PR
- no production secrets in logs/artifacts
- no replacing existing CI where focused extension is enough

## Definition of done

A reviewer can look at one readiness workflow and immediately know whether the exact commit is structurally eligible for the Amazon submission and whether live-runtime proof has or has not been performed.
