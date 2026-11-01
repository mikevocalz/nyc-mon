# Alexa+ end-to-end verification and red-team lane

## Mission

Independently prove that NYC-Mon's Amazon hackathon path works end to end and fails safely.

This lane is intentionally separate from the engineers implementing PR #12, deployment in #14, performance work in #15, judge UX, and submission assets.

The builder never signs off its own work.

## Review board

- Distinguished Verification Fellow — final evidence owner
- Distinguished Security Fellow — auth/secrets/trust review
- Verification / QA Distinguished Engineer — end-to-end and regression owner
- Security Red Team — adversarial auth/MCP testing
- Reliability Chaos Agent — external-service and network failure injection
- Demo Saboteur — rehearsal failure hunting
- Hackathon Judge Agent — final rubric-based acceptance

## Mandatory skills / tools

Use the strongest available equivalents of:

- testing-strategy
- TDD where appropriate
- verification-before-completion
- `vercel/verification` where hosted components use Vercel
- CodeRabbit review for changed test/support code
- API design review
- security review
- performance profiling
- agent LLM response tests
- agent tool-call tests
- multi-turn simulation tests
- `Argent/agent-device` when device interaction is relevant/available
- `petergyang/no-ai-slop` for evidence docs

## Evidence taxonomy

Every claim must be classified as one of:

- VERIFIED
- IMPLEMENTED — LIVE VERIFICATION PENDING
- BLOCKED
- FAILED

There is no "should work".

Maintain evidence separately for:

- static correctness
- unit/integration behavior
- browser runtime
- deployed runtime
- real Bedrock
- real database
- real OAuth
- real MCP
- performance
- security

## Required golden-path test

Prove this exact chain using deployed services:

browser/simulator
→ account linking
→ valid user token
→ Bedrock
→ Agent Skill/context
→ MCP
→ NYC-Mon /v1
→ persisted backend state
→ MCP App / simulator result

Minimum scenario:

1. Adult user signs in and links.
2. User asks for current Mon state.
3. Agent selects the correct read tool.
4. Result matches backend state.
5. User asks for a valid care action.
6. Correct mutation tool is called once.
7. Backend state changes once.
8. User asks what changed.
9. Answer reflects the updated persisted state.
10. A new session still sees the changed state.

## Security cases

Attempt and document:

- under-18 account linking
- expired access token
- wrong issuer
- wrong resource/audience
- invalid PKCE verifier
- refresh token replay
- service-token attempt to access user data
- cross-user resource access
- malformed MCP request
- unexpected tool arguments
- repeated mutation/idempotency key reuse
- CORS abuse
- iframe boundary abuse
- missing production env var
- production dev-bypass attempt
- secret exposure in browser bundle/logs

Expected behavior is fail-closed.

## Reliability / chaos cases

Break:

- Bedrock credentials
- Bedrock timeout
- Bedrock throttling
- backend timeout
- database write timeout
- network interruption
- MCP server unavailable
- iframe load failure
- WebGPU unavailable
- malformed model output
- malformed tool result
- auth expiry during an interaction

Expected outcomes:

- no duplicate mutation
- no unauthorized fallback
- no raw stack trace in judge UI
- no blank screen
- clear recoverable error where recovery is possible

## Performance evidence

Collect at minimum:

- tools/list latency
- representative read-tool p50/p95
- representative care mutation p50/p95
- /v1 latency
- Bedrock inference latency
- full user-turn latency

PR #15 remains conditional: implement the single-round-trip care optimization only if live measurements justify it.

## Agent evals

Create/maintain:

### LLM behavior tests
Check what the assistant says for representative turns.

### Tool-call tests
Check correct tool selection, parameters, and cases where no tool should be called.

### Multi-turn simulations
Verify persistent context and updated state over several turns.

No eval may depend on an unimplemented tool such as removed `heal_mon` or `get_inventory`.

## Demo-saboteur rehearsal

Run the final demo flow under:

- cold load
- expired session
- slow inference
- duplicate command
- browser refresh
- WebGPU disabled
- narrow viewport
- long Mon name
- one recoverable backend failure

The submitted path must recover without secret manual intervention.

## Deliverables

- canonical evidence matrix
- test/eval coverage
- security findings and resolutions
- performance measurements
- deployed smoke-test results
- final go/no-go recommendation

## Definition of done

This lane goes GREEN only when an independent verifier can reproduce the complete real path twice consecutively and no unresolved Critical/High security or demo-blocking reliability issue remains.
