# Alexa+ deploy and live verification

Draft. Get the three services running on HTTPS and prove the parts PR #12 could only test against mocks. Judging can start Oct 26 and runs to Nov 20; everything stays up until then.

## Hosting (decision needed)

Three services, all Node:

| Service | Package | Needs |
|---|---|---|
| Authorization server and `/v1` | `apps/admin-vite` | the database, the migration, `AUTH_ISSUER`, `OAUTH_*`, `V1_MCP_SERVICE_KEY` |
| MCP server | `packages/mcp-server` | `MCP_RESOURCE_URI`, `AUTH_ISSUER`, `V1_MCP_SERVICE_KEY`, `MCP_ALLOWED_ORIGINS` |
| Simulator | `packages/web-sim` | two origins (page and sandbox), `SIM_*`, an AWS role with `bedrock-mantle:CreateInference` |

admin-vite already deploys to Vercel (`apps/admin-vite/vercel.json`). The MCP server and the simulator are long-running Node servers; the simulator needs a second origin for the view sandbox. Hosting them on AWS would also strengthen the AWS Builder entry. Pick a host for each.

## Steps

- [ ] Review and apply migration `20261008_181202_alexa_oauth` (jwks plus seven oauth tables).
- [ ] Set the env vars from the PR #12 deploy checklist, with `NODE_ENV=production` everywhere.
- [ ] Deploy the three services on HTTPS.
- [ ] Live checks:
  - [ ] An adult account links through the simulator; an under-18 account is refused.
  - [ ] Passkey and TOTP sign-in on the linking page.
  - [ ] `tools/list` with a service token; a user tool without a user token gets 401.
  - [ ] Feed lands once, including when retried.
  - [ ] A real Bedrock turn: the agent loop calls `get_mon_status` and the card renders.
  - [ ] Demo beats 3 and 4 with the real model.
- [ ] Measure `feed_mon` latency against the real database. If p95 goes over 500 ms, take the plan in the care single-round-trip draft PR.
- [ ] Keep the services up through 2026-11-20.
