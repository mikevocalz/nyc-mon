# AWS Builder mini challenge: Claude on Amazon Bedrock in the NYC-MON simulator

Draft for the Devpost Product Feedback answer, which is where the rules ask entrants to "Describe which AWS service(s) you used and how" (`docs/alexa/HACKATHON.md`, submission checklist). Every line below points at code or a commit. Lines marked **pending live verification** have not been run against real AWS yet. The first real Bedrock turns ran on 2026-10-21; a full demo session against Bedrock is measured below.

## What runs on AWS

The judged surface is `packages/web-sim`, a smart-display page that acts as a real MCP client. Claude on Amazon Bedrock is the agent in that page: it reads the Agent Skill (`skills/nyc-mon-companion/SKILL.md`) as its system prompt, picks NYC-MON MCP tools, and speaks as the Mon. ADR 0015 §3 records that this Bedrock loop is the AWS Builder entry.

The MCP server itself makes no model calls. Amazon's Alexa+ quickstart sets a 500 ms round-trip limit on MCP responses (`docs/alexa/PLATFORM-DOCS.md` §2.3), so the model sits in the simulator's agent loop and the server stays characterless (ADR 0009, ADR 0015 §3).

## Service and settings

| Item | Value | Where |
|---|---|---|
| Service | Amazon Bedrock `bedrock-runtime` (InvokeModel with response streaming) for inference-profile ids. Bare ids such as `anthropic.claude-opus-5-5` go to the Messages-API endpoint `bedrock-mantle.<region>.api.aws/anthropic/v1/messages` instead | `packages/web-sim/server/model.ts` (`usesBedrockRuntime`, `bedrockBackend`) |
| Client | `AnthropicBedrock` (runtime) or `AnthropicBedrockMantle` (mantle) from `@anthropic-ai/bedrock-sdk` 0.35.0, SigV4-signed from the default AWS credential chain | `model.ts`, version pinned in `pnpm-workspace.yaml` |
| Model id | `us.anthropic.claude-sonnet-4-6` (Claude Sonnet 4.6, US cross-region inference profile) by default since 58fb23d, overridable with `SIM_BEDROCK_MODEL_ID` | `packages/web-sim/server/env.ts` |
| IAM action | Runtime: `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on the inference-profile and foundation-model ARNs, plus the Anthropic use-case form on the account. Mantle: `bedrock-mantle:CreateInference` (AWS managed policy `AmazonBedrockMantleInferenceAccess`) | Confirmed on 2026-10-19 and 2026-10-21, see the dated sections below |
| Region | `SIM_BEDROCK_REGION`, falling back to `AWS_REGION`. Every measured run used `us-east-1`. There is no hosted demo. | `env.ts`, `SIMULATOR.md` §2 |
| Effort | `output_config.effort: 'low'` by default (`SIM_MODEL_EFFORT`) | `env.ts`, `model.ts` |
| Output cap | 4096 tokens per model turn (`SIM_MAX_OUTPUT_TOKENS`, 256 to 16000) | `env.ts` |
| Streaming | `messages.stream(...)` then `finalMessage()`. Text deltas go to the page as server-sent events | `model.ts` |

The code sets `low` effort explicitly so a voice reply comes back quickly. In the measured session the mean model call took 2.6 s.

## How the code keeps spend bounded

- **Credentials stay on the server.** The browser sends the conversation and the tool list. The simulator server adds the system prompt, model id and limits. The request can't choose any of them (`model.ts` header comment. `SIMULATOR.md`, "How `/api/model` is protected", item 4).
- **The Agent Skill is a cached prefix.** The system block carries `cache_control: { type: 'ephemeral' }`, so repeat turns read the skill from the prompt cache (`model.ts`). On Bedrock the cached prefix (skill plus tool definitions) is 5,760 tokens. In the measured session one call wrote it and the other seven read it.
- **Only signed-in adults can spend tokens.** `/api/model` checks the `Origin`, then verifies the caller's MCP access token (issuer, audience, expiry, a user scope, the `nyc-mon-sim` client) before any Bedrock call (`SIMULATOR.md` items 1 and 2. `packages/web-sim/server/model-auth.ts`). Red-team tests for missing, `"null"`, sandbox and look-alike origins landed in 7e72b98.
- **Rate limits cap the bill.** 30 model turns per client per sliding minute and 120 across all clients (`SIM_RATE_LIMIT_PER_MIN`, `SIM_GLOBAL_RATE_LIMIT_PER_MIN` in `env.ts`).
- **Cancelled turns stop dispatching.** Since 5b66a1a, the agent loop checks the turn's `AbortSignal` before each model call and each tool call, and passes the signal into the MCP client, so a cancelled turn starts no new Bedrock or tool work.
- **The mock can't stand in for Bedrock in production.** `loadSimEnv` throws when `SIM_MODEL_BACKEND=mock` and `NODE_ENV=production` (e3e5036). A judge always gets the real model or an error.

## Errors a person can act on

`model.ts` maps SDK errors to plain sentences: refused AWS credentials, a model id missing from the region, no network to Bedrock, a generic Bedrock error, and missing credentials. Only the network and generic errors are marked retryable.

## CI against real AWS

`.github/workflows/alexa-live-smoke.yml` (30218e5, now on `main`) is a manual job in the protected `alexa-live` environment. It assumes a Bedrock role through GitHub OIDC (`aws-actions/configure-aws-credentials`, `role-to-assume: vars.AWS_BEDROCK_ROLE_ARN`), so no long-lived AWS keys sit in the repo. `packages/web-sim/scripts/live-smoke.ts` then runs five timed checks: issuer metadata, anonymous MCP rejection, `tools/list`, one `feed_mon`, and one Bedrock turn at `low` effort with a 256-token cap. A missing variable reports NOT RUN and fails the job. Nothing falls back to the mock. The workflow has **not** been run: `LIVE_MCP_URL`, `AUTH_ISSUER`, `LIVE_MON_ID` and `LIVE_ACCESS_TOKEN` need the hosted services, and none are hosted.

## Measured cost per session

One demo session, run headlessly on 2026-10-21 at 16:31 UTC from commit `58956b6`, in `us-east-1`, with `us.anthropic.claude-sonnet-4-6`, effort `low` and a 4096-token cap. The script used the simulator's own `bedrockBackend`, `runAgentTurn` and MCP client against the local MCP server in dev mode, with the 13 tools the model sees. The `/v1` game API was not running, so Mon-status tools returned their "can't reach your Mon" error. Beats 3 and 4 (presence and James) ran in full from the server's fixtures.

| Measure | Value |
|---|---|
| Model calls per session | 8 |
| Input / cache write / cache read / output tokens | 4,567 / 5,760 / 40,320 / 323 |
| Cost per session (USD) | $0.0575 at the US-profile rates below. $0.0522 at the global-profile rates |
| Model time | 20.5 s in total, 2.6 s mean per call, 0.8 s to 5.3 s range |
| Bedrock turn latency, from `live-smoke.ts` `bedrock-turn` | Not run (needs the hosted services) |

Prices come from the AWS Price List API (`aws pricing get-products --service-code AmazonBedrockFoundationModels`, `us-east-1`, Claude Sonnet 4.6), because the pricing web page renders the Anthropic rates client-side. The US profile is billed at the regional rates: $3.30 input, $4.125 cache write (5-minute), $0.33 cache read and $16.50 output per million tokens. The global profile is $3.00, $3.75, $0.30 and $15.00. The one cache write is 44% of the session's cost.

The status beats would return a Mon instead of an error once `/v1` runs, so their tool results and replies would be longer. That run has not been measured.

## Who pays

The AWS credit form closed on Oct 7 ("out of credit codes", `docs/alexa/HACKATHON.md`, Deadlines), so Bedrock bills to the creator's account (`docs/HANDOFF.md` §2, step 2).

## Other AWS use

[CREATOR: list any other AWS service used, for example Claude Code on Bedrock during development. The rules accept it ("Yes, CC on Bedrock would count", FT/45321 in `HACKATHON.md`), but nothing in the repo records that it was used. Delete this section if nothing else applies.]

## Feedback on Bedrock for the Product Feedback answer

Draft.

- **Worked:** both Anthropic Bedrock SDK clients expose the same `messages.stream` surface as the first-party SDK, so switching from mantle to bedrock-runtime was a one-function change and the agent loop kept one code path. Tests swap in a fake through the `BedrockMessagesClient` type (`model.ts`). Prompt caching worked on the first try.
- **Needs work:** on a new account, Claude 4.6 answered for about an hour and then every Anthropic model returned `404 Model use case details have not been submitted`. The console's Model access page is retired and no console page we found linked the form, so we filed it with `PutUseCaseForModelAccess`. Claude Opus 5.5 on bedrock-mantle returned `permission_error ... not available for this account`: the applied quota was 0 against a 20M default, and Service Quotas refuses any request at or below the default, so only a Support case can raise it. Mantle and runtime also use different IAM actions (`bedrock-mantle:CreateInference` and `bedrock:InvokeModel*`).
- **Zero to hello world:** the account was created on 2026-10-19 and the first lasting Claude turn ran on 2026-10-21. The use-case form was most of that wait.
- **Would we build with it again:** [CREATOR: Yes/No and why.]

## Account state and decisions, 2026-10-19

Account `142366489572`, `us-east-1`. Checked with the AWS MCP server and the Anthropic Bedrock SDK on 2026-10-19.

What exists:

- GitHub OIDC provider and role `nyc-mon-alexa-live-bedrock`. Only the `alexa-live` environment of `mikevocalz/nyc-mon` can assume it. Its inline policy allows `bedrock-mantle:CreateInference` (plus `Get*` and `List*`) on `project/*`. The `alexa-live` environment has `AWS_BEDROCK_ROLE_ARN`, `AWS_REGION=us-east-1` and `SIM_BEDROCK_MODEL_ID` (`anthropic.claude-opus-5-5` on 2026-10-19, `us.anthropic.claude-sonnet-4-6` since 2026-10-21).
- Budget `nyc-mon-monthly`: $25 a month, with email alerts at 50, 80 and 100 percent of actual spend.
- The IAM action is confirmed: the AWS managed policy `AmazonBedrockMantleInferenceAccess` grants `bedrock-mantle:CreateInference` on `arn:aws:bedrock-mantle:*:*:project/*`.

What blocks a real model turn:

1. Every Anthropic model on `bedrock-runtime` returns `404 Model use case details have not been submitted for this account`. `GetUseCaseForModelAccess` returns `ResourceNotFoundException`. On the first evening, `us.anthropic.claude-sonnet-4-6` and `us.anthropic.claude-opus-4-6-v1` answered for a short time and then started returning this error.
2. Claude Opus 5.5 on `bedrock-mantle` returns `permission_error: anthropic.claude-opus-5-5 is not available for this account`. The account's applied quota is 0 for both `L-1BD3E8A2` (input TPM) and `L-612AE448` (output TPM), against AWS defaults of 20,000,000 and 2,000,000. Service Quotas refuses any increase request at or below the default, so only AWS Support can lift this.

| Item | Decision | Condition to revisit |
|---|---|---|
| Anthropic use-case form | DONE 2026-10-21, filed with `PutUseCaseForModelAccess` | `GetFoundationModelAvailability` reports Sonnet 4.6 `AVAILABLE` / `AUTHORIZED`. The console's Model access page is retired. |
| Opus 5.5 on `bedrock-mantle` (the default until 58fb23d) | DEFER | Blocked by the account's restriction, not by code. Reopen when an AWS Support case moves the applied quota off 0. Do not file a Service Quotas increase: the API rejects it. |
| `bedrock-runtime` backend for Claude 4.6 in `server/model.ts` | BUILT 2026-10-21 (48f54a6), default since 58fb23d | `bedrockBackend` sends inference-profile ids (`us.anthropic.claude-sonnet-4-6`) to `AnthropicBedrock` and bare ids to mantle. The CI role has `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on the 4.6 profiles and foundation models (inline policy `bedrock-runtime-claude-46`) but has not made a call. Real turns: see below. |
| Live smoke workflow | DEFER | Also needs `LIVE_MCP_URL`, `AUTH_ISSUER`, `LIVE_MON_ID` and the `LIVE_ACCESS_TOKEN` secret, which exist only once the MCP server, admin-vite and the simulator are on HTTPS. |
| SMS codes through SNS | STRIKE for the hackathon | No registered toll-free or 10DLC origination number exists, and registration takes longer than the deadline. With `AUTH_SMS_TRANSPORT` unset, codes go by email. |
| Login with Amazon | Out of scope for AWS | It is configured in the Amazon Developer console, not in this account. |

## First real Bedrock turns, 2026-10-21

The Anthropic use-case form is on file, so `GetFoundationModelAvailability` reports `anthropic.claude-sonnet-4-6` as `AVAILABLE` / `AUTHORIZED`. The simulator's `bedrockBackend` went through bedrock-runtime with `us.anthropic.claude-sonnet-4-6`, `us-east-1`, effort `low` and a 256-token cap, at commit `aea433a`. Credentials came from the creator's laptop session, not the CI role.

| Run | System prompt | Latency | Input | Cache write | Cache read | Output |
|---|---|---|---|---|---|---|
| 1 | `skills/nyc-mon-companion/SKILL.md` | 2087 ms | 11 | 2805 | 0 | 12 |
| 2 | same, a few seconds later | 2177 ms | 11 | 0 | 2805 | 12 |

The Agent Skill is cached on Bedrock: the second turn read all 2805 skill tokens from the cache. No tools were sent, so this is not a full agent-loop turn. Cost per demo session is still unmeasured.

Still open: Opus 5.5 on bedrock-mantle (account restriction, needs AWS Support); `SIM_BEDROCK_MODEL_ID` in the `alexa-live` environment is `us.anthropic.claude-sonnet-4-6` since 2026-10-21. The CI role has `bedrock:InvokeModel*` on the 4.6 profiles (inline policy `bedrock-runtime-claude-46`) but has not made a call yet.
