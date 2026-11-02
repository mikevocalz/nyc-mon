# NYC-Mon Personal Companion — NVIDIA submission workstream

Target: **Nebius × NVIDIA Global AI Hackathon / Personal AI**. Official deadline verified October 24: **October 30, 2026, 10:00 am PDT / 1:00 pm EDT**. Amazon was not submitted and is closed; none of this work claims an Amazon entry.

## PR order

1. **#100** — real Nebius/Nemotron provider adapter and protocol tests.
2. **#101** — explicit Caller-controlled memory on the existing Payload/Neon backend.
3. **#102** — authenticated companion page and actual MCP care integration.
4. **#103** — live proof runner, Node 24 launchers and CI separation.
5. Publication/readiness PR — this directory, preflight gates, public-source boundary and deployment checklist.

All are drafts until their gates pass. Retarget the next stacked PR to `main` after its parent is reviewed and merged; do not squash unrelated branches into the submission. Do not claim live success from commits or unit tests.

## Architecture

`nvidia.html` → existing OAuth/PKCE → existing MCP tools → existing Payload `/v1` → existing Neon.

Model turns use a server-held Nebius key and a reviewed NVIDIA Nemotron model. The existing agent loop performs tool calls; no Bedrock fallback. Explicit preferences are saved by user controls, not by an LLM. Stored text is treated as untrusted data; authorization never comes from memory. Personality remains the existing companion Skill, not newly invented canon.

[Setup](SETUP.md) · [Runtime](RUNTIME.md) · [Memory](MEMORY.md) · [Acceptance](ACCEPTANCE.md) · [Public source boundary](PUBLIC-SLICE.md) · [Deployment](DEPLOY.md) · [Submission](SUBMISSION.md)

## Executable commands

Node 24 native strip-only mode cannot execute TypeScript parameter properties. Use the included `.mjs` launchers; they explicitly set Node's `--experimental-transform-types`. Do not run the corresponding `.ts` entry directly in strip-only mode.

```
pnpm --filter @acme/web-sim exec node server/nvidia-main.mjs
pnpm --filter @acme/web-sim exec node scripts/nvidia-live.mjs
# Dedicated test account only; valid credentials and explicit mutation consent required:
NVIDIA_ALLOW_TEST_ACCOUNT_MUTATION=yes pnpm --filter @acme/web-sim exec node scripts/nvidia-live.mjs --full
node --test tooling/nvidia/preflight.test.mjs
node tooling/nvidia/preflight.mjs
```

The committed manifest intentionally fails preflight. Missing credentials produce NOT_RUN with a nonzero exit and zero provider receipts. A valid preflight is only a structural check: a person must verify the public repo, demo and footage, and actually submit Devpost.

## Sources verified for implementation

- https://nebiusglobalaihackathon.devpost.com/rules
- https://nebiusglobalaihackathon.devpost.com/resources
- https://docs.tokenfactory.nebius.com/quickstart
- https://nebius.com/services/token-factory/models/nvidia-nemotron-models-inference
- https://github.com/nebius/token-factory-cookbook/tree/main/models/nemotron

Runtime catalog availability must still be checked for the actual account. NVIDIA Audio2Face via a non-Nebius provider, or Claude on Bedrock, does not substitute for the qualifying model/runtime requirement.
