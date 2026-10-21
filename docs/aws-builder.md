# AWS Builder mini challenge: Claude on Amazon Bedrock in the NYC-MON simulator

Draft for the Devpost Product Feedback answer, which is where the rules ask entrants to "Describe which AWS service(s) you used and how" (`docs/alexa/HACKATHON.md`, submission checklist). Every line below points at code or a commit. Lines marked **pending live verification** have not been run against real AWS yet. As of 2026-10-14, every simulator run used the scripted mock model (`docs/HANDOFF.md`, "Not verified").

## What runs on AWS

The judged surface is `packages/web-sim`, a smart-display page that acts as a real MCP client. Claude on Amazon Bedrock is the agent in that page: it reads the Agent Skill (`skills/nyc-mon-companion/SKILL.md`) as its system prompt, picks NYC-MON MCP tools, and speaks as the Mon. ADR 0015 §3 records that this Bedrock loop is the AWS Builder entry.

The MCP server itself makes no model calls. Amazon's Alexa+ quickstart sets a 500 ms round-trip limit on MCP responses (`docs/alexa/PLATFORM-DOCS.md` §2.3), so the model sits in the simulator's agent loop and the server stays characterless (ADR 0009, ADR 0015 §3).

## Service and settings

| Item | Value | Where |
|---|---|---|
| Service | Amazon Bedrock, the Messages-API endpoint `bedrock-mantle.<region>.api.aws/anthropic/v1/messages` | `packages/web-sim/server/model.ts` (doc comment on `bedrockBackend`) |
| Client | `AnthropicBedrockMantle` from `@anthropic-ai/bedrock-sdk` 0.34.3, SigV4-signed from the default AWS credential chain | `model.ts`, version pinned in `pnpm-workspace.yaml` |
| Model id | `anthropic.claude-opus-5-5` (Claude Opus 5.5), overridable with `SIM_BEDROCK_MODEL_ID` | `packages/web-sim/server/env.ts` |
| IAM action | `bedrock-mantle:CreateInference` on the model, plus Bedrock model access for the account | `docs/alexa/SIMULATOR.md` §2, `docs/HANDOFF.md` §2. **Pending live verification**: confirm the action name on the first real call. |
| Region | `SIM_BEDROCK_REGION`, falling back to `AWS_REGION`. The run instructions use `us-east-1`. | `env.ts`, `SIMULATOR.md` §2. Region of the hosted demo: **[CREATOR: region]** |
| Effort | `output_config.effort: 'low'` by default (`SIM_MODEL_EFFORT`) | `env.ts`, `model.ts` |
| Output cap | 4096 tokens per model turn (`SIM_MAX_OUTPUT_TOKENS`, 256 to 16000) | `env.ts` |
| Streaming | `messages.stream(...)` then `finalMessage()`. Text deltas go to the page as server-sent events | `model.ts` |

Claude Opus 5.5 always thinks and defaults to `medium` effort, so the code sets `low` explicitly. A voice reply should come back quickly.

## How the code keeps spend bounded

- **Credentials stay on the server.** The browser sends the conversation and the tool list. The simulator server adds the system prompt, model id and limits. The request can't choose any of them (`model.ts` header comment. `SIMULATOR.md`, "How `/api/model` is protected", item 4).
- **The Agent Skill is a cached prefix.** The system block carries `cache_control: { type: 'ephemeral' }`, so repeat turns read the skill from the prompt cache (`model.ts`). Cache hit rate on Bedrock: **pending live verification** (read `usage.cache_read_input_tokens` on the second turn).
- **Only signed-in adults can spend tokens.** `/api/model` checks the `Origin`, then verifies the caller's MCP access token (issuer, audience, expiry, a user scope, the `nyc-mon-sim` client) before any Bedrock call (`SIMULATOR.md` items 1 and 2. `packages/web-sim/server/model-auth.ts`). Red-team tests for missing, `"null"`, sandbox and look-alike origins landed in 7e72b98.
- **Rate limits cap the bill.** 30 model turns per client per sliding minute and 120 across all clients (`SIM_RATE_LIMIT_PER_MIN`, `SIM_GLOBAL_RATE_LIMIT_PER_MIN` in `env.ts`).
- **Cancelled turns stop dispatching.** Since 5b66a1a, the agent loop checks the turn's `AbortSignal` before each model call and each tool call, and passes the signal into the MCP client, so a cancelled turn starts no new Bedrock or tool work.
- **The mock can't stand in for Bedrock in production.** `loadSimEnv` throws when `SIM_MODEL_BACKEND=mock` and `NODE_ENV=production` (e3e5036). A judge always gets the real model or an error.

## Errors a person can act on

`model.ts` maps SDK errors to plain sentences: refused AWS credentials, a model id missing from the region, no network to Bedrock, a generic Bedrock error, and missing credentials. Only the network and generic errors are marked retryable.

## CI against real AWS

`.github/workflows/alexa-live-smoke.yml` (30218e5, on `ci/alexa-hackathon-readiness`) is a manual job in the protected `alexa-live` environment. It assumes a Bedrock role through GitHub OIDC (`aws-actions/configure-aws-credentials`, `role-to-assume: vars.AWS_BEDROCK_ROLE_ARN`), so no long-lived AWS keys sit in the repo. `packages/web-sim/scripts/live-smoke.ts` then runs five timed checks: issuer metadata, anonymous MCP rejection, `tools/list`, one `feed_mon`, and one Bedrock turn at `low` effort with a 256-token cap. A missing variable reports NOT RUN and fails the job. Nothing falls back to the mock. The workflow has **not** been run: **pending live verification**.

## Measured cost per session

**Pending live verification.** No Bedrock call has been made, so there is no measured number. Bedrock bills Claude at partner rates published on the AWS pricing page, which can differ from Anthropic's first-party prices. Take the per-token rates from that page on the day of the run.

Method, once credentials exist:

1. Run one demo session against the deployed simulator: the five beats in `docs/alexa/SIMULATOR.md`, "Demo beats on this surface".
2. Log `usage` from each `finalMessage()`: `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`.
3. Price each field at the Bedrock rate for `anthropic.claude-opus-5-5` in the chosen region, and cross-check against Cost Explorer for that hour.

| Measure | Value |
|---|---|
| Model turns per session | [needs number] |
| Input / cache-write / cache-read / output tokens per session | [needs number] |
| Cost per session (USD) | [needs number] |
| Bedrock turn latency, from `live-smoke.ts` `bedrock-turn` | [needs number] |
| Date, region, commit SHA of the run | [needs number] |

## Who pays

The AWS credit form closed on Oct 7 ("out of credit codes", `docs/alexa/HACKATHON.md`, Deadlines), so Bedrock bills to the creator's account (`docs/HANDOFF.md` §2, step 2).

## Other AWS use

[CREATOR: list any other AWS service used, for example Claude Code on Bedrock during development. The rules accept it ("Yes, CC on Bedrock would count", FT/45321 in `HACKATHON.md`), but nothing in the repo records that it was used. Delete this section if nothing else applies.]

## Feedback on Bedrock for the Product Feedback answer

Draft. Fill in after the live run.

- **Worked:** the Anthropic Bedrock SDK's Mantle client exposes the same `messages.stream` surface as the first-party SDK, so the agent loop and its tests use one code path. Tests swap in a fake through the `BedrockMessagesClient` type (`model.ts`).
- **Needs work:** [pending live verification: model-access request flow, IAM action discovery, first-call latency, quota errors.]
- **Zero to hello world:** [pending live verification: time from a fresh account to the first `bedrock-turn` PASSED.]
- **Would we build with it again:** [CREATOR: Yes/No and why.]

## Account state and decisions, 2026-10-19

Account `142366489572`, `us-east-1`. Checked with the AWS MCP server and the Anthropic Bedrock SDK on 2026-10-19.

What exists:

- GitHub OIDC provider and role `nyc-mon-alexa-live-bedrock`. Only the `alexa-live` environment of `mikevocalz/nyc-mon` can assume it. Its inline policy allows `bedrock-mantle:CreateInference` (plus `Get*` and `List*`) on `project/*`. The `alexa-live` environment has `AWS_BEDROCK_ROLE_ARN`, `AWS_REGION=us-east-1` and `SIM_BEDROCK_MODEL_ID=anthropic.claude-opus-5-5`.
- Budget `nyc-mon-monthly`: $25 a month, with email alerts at 50, 80 and 100 percent of actual spend.
- The IAM action is confirmed: the AWS managed policy `AmazonBedrockMantleInferenceAccess` grants `bedrock-mantle:CreateInference` on `arn:aws:bedrock-mantle:*:*:project/*`.

What blocks a real model turn:

1. Every Anthropic model on `bedrock-runtime` returns `404 Model use case details have not been submitted for this account`. `GetUseCaseForModelAccess` returns `ResourceNotFoundException`. On the first evening, `us.anthropic.claude-sonnet-4-6` and `us.anthropic.claude-opus-4-6-v1` answered for a short time and then started returning this error.
2. Claude Opus 5.5 on `bedrock-mantle` returns `permission_error: anthropic.claude-opus-5-5 is not available for this account`. The account's applied quota is 0 for both `L-1BD3E8A2` (input TPM) and `L-612AE448` (output TPM), against AWS defaults of 20,000,000 and 2,000,000. Service Quotas refuses any increase request at or below the default, so only AWS Support can lift this.

| Item | Decision | Condition to revisit |
|---|---|---|
| Anthropic use-case form | BUILD, by the creator in the Bedrock console | Needed for every Claude model on this account. Retry 15 minutes after submitting. |
| Opus 5.5 on `bedrock-mantle` (current code path) | DEFER | Blocked by the account's restriction, not by code. Reopen when an AWS Support case moves the applied quota off 0. Do not file a Service Quotas increase: the API rejects it. |
| `bedrock-runtime` backend for Claude 4.6 in `server/model.ts` | BUILT 2026-10-21 | `bedrockBackend` sends inference-profile ids (`us.anthropic.claude-sonnet-4-6`) to `AnthropicBedrock` (bedrock-runtime) and bare ids to mantle; switch with `SIM_BEDROCK_MODEL_ID` only. Still needed before it runs: the use-case form (blocker 1), and `bedrock:InvokeModel` + `bedrock:InvokeModelWithResponseStream` on the inference-profile and foundation-model ARNs for the `nyc-mon-alexa-live-bedrock` role. Untested against real AWS. |
| Live smoke workflow | DEFER | Also needs `LIVE_MCP_URL`, `AUTH_ISSUER`, `LIVE_MON_ID` and the `LIVE_ACCESS_TOKEN` secret, which exist only once the MCP server, admin-vite and the simulator are on HTTPS. |
| SMS codes through SNS | STRIKE for the hackathon | No registered toll-free or 10DLC origination number exists, and registration takes longer than the deadline. With `AUTH_SMS_TRANSPORT` unset, codes go by email. |
| Login with Amazon | Out of scope for AWS | It is configured in the Amazon Developer console, not in this account. |
