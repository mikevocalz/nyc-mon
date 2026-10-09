# NYC-MON handoff, 2026-10-08

Where the work stands, what's left, and what it was built from. Written for whoever picks this up next: a person or a new agent session.

## 1. Branches and PRs

The four branches stack, so merge them in order. Each PR is based on the one before it.

| Order | Branch | PR | What it is | State |
|---|---|---|---|---|
| 1 | `feat/spatial-contract` | #9 → main | Spatial scene contract, one Mon store, approach trigger (PR A) | open, CI green |
| 2 | `docs/phase2-legends` | #10 → main | Phase 2 legend encounters, parked (ADR 0013) | open |
| 3 | `feat/phase1-loop` | #11 → feat/spatial-contract | Phase 1 screens: egg choice, hatch, companion | open, CI green |
| 4 | `feat/alexa-plus` | #12 → feat/phase1-loop (draft) | Alexa+ add-on: MCP server, OAuth issuer, MCP Apps views, simulator | draft until verified on real infrastructure |

Draft PRs for the unfinished work, each with a plan in `docs/plans/` or a proposed ADR:

| PR | Branch | Covers |
|---|---|---|
| #13 | `draft/alexa-submission` | Devpost assets and the demo-script rework |
| #14 | `draft/alexa-deploy` | hosting, the migration, live verification |
| #15 | `draft/mcp-care-single-roundtrip` | the 500 ms budget fix, if needed |
| #16 | `draft/presence-and-voice-decisions` | proposed ADRs 0018 and 0019 |
| #17 | `draft/kit-issues-for-review` | five kit issues for Mike |
| #18 | `draft/quest-presence` | PR C on Harlem Might's `@viro-external` layout system, based on #11 |

Other open PRs are older work and nothing here depends on them: #4 (canon v12), #5 (lexicon CMS), #6 (Bunny video URLs), #7 (TraceSift profiling).

Repo rules that held throughout: no worktrees; never a dirty tree; Zustand for state; canon is law; no AI attribution lines in commits; never read `.env`; never use the installed Chrome for automation (it launches the Meta XR Simulator), so use Playwright's bundled Chromium.

## 2. Alexa+ hackathon

Amazon "Build, Ship, Shape", Alexa+ track. **Deadline Fri 2026-10-23, 12:00 PT.** Office hours Mon Oct 19, 9:00 PT. Judging starts as early as Oct 26 and runs to Nov 20; keep anything hosted up until then.

### What's built (`feat/alexa-plus`)

- **MCP server** (`packages/mcp-server`). Uses the MCP TypeScript SDK over Streamable HTTP and answers the 2025-11-25 and 2025-03-26 handshakes. Access depends on the token:
  - `mcp:service` tokens get discovery only.
  - User tools need `mcp:caller` or `mcp:care`.
  - Under-18 tokens get no data.

  Eight tools are backed by `/v1`: status, check-on, incubation, talk, feed, rest, wake and play. Care calls are idempotent per intent. Presence tools exist only in dev mode, over fictional seeded people (James, Dana). 103 tests.
- **MCP Apps views** (`packages/mcp-server/src/ui`). The inline card and the fullscreen room are each one self-contained HTML file, built from the kit exactly as its Storybook stories use it:
  - the Notch `Card` in the starter tone
  - `StatusRow`
  - the `CareMeterRing` group
  - `cta` and `outline` buttons, with the action the Mon is asking for in `cta`

  The room draws the site's `GridFloor` band when a WebGPU device is available and the plain sky otherwise. Live preview: https://claude.ai/artifact/4BiRKTzAbPoAEfLvA2ssFB (private to Mike).
- **OAuth issuer for account linking** (`packages/payload/src/auth/oauth`, admin-vite `/oauth/*`) is Better Auth's `oauth-provider` plus the jwt plugin (ADR 0016):
  - Grants: client credentials for discovery, plus the authorization code with PKCE S256.
  - Refresh tokens rotate.
  - `resource` is pinned to the MCP URL, and no OIDC is exposed.
  - Linking is refused under 18 at sign-in, at consent and on every token issue.
  - The linking pages are built from the kit, with passkey sign-in.
- **`/v1`** adds `GET /v1/me/eggs` and a service-key path the MCP server uses to act for a user. That path covers three routes only, uses a constant-time compare, and re-checks age and consent on every request.
- **Simulator** (`packages/web-sim`) is the judged surface:
  - It's a smart-display page and a real MCP client, signed in through the `nyc-mon-sim` OAuth client.
  - Claude on Amazon Bedrock runs the agent loop, with the Agent Skill as the system prompt.
  - Views render in a sandboxed iframe on a second origin.
  - Push-to-talk works and replies are read aloud.
  - The grid floor band sits under the device.
  - `/api/model` needs the signed-in user's token and is rate-limited per client and globally.

  61 tests.
- **Agent Skill** at `skills/nyc-mon-companion/SKILL.md` passes the agentskills.io validator.
- **Decisions:** ADR 0015 (adults only, seeded voiceprints, Claude on Bedrock), 0016 (OAuth issuer), 0017 (simulator package).

Verified on 2026-10-08. Typecheck, lint, tests and builds pass for mcp-server, web-sim, payload, admin-vite and the kit, and Storybook builds. `pnpm install --frozen-lockfile` passes. Independent code and security reviews found nothing critical or high, and every finding they raised has been fixed.

### Not verified

- A real Bedrock call. No AWS credentials were used; every run used the scripted mock model.
- The OAuth flow end to end against a running admin-vite with a database. The token exchange, a real passkey and a real TOTP sign-in have not been exercised.
- Demo beats 3 and 4 (James greeting, the Caller refusal), which need the real model.
- The 500 ms round-trip budget against a real database. On a stub `/v1`, `feed_mon` is 308 ms p50. A care call is a read and then a write, so it stays under 500 ms only while each `/v1` call takes under about 245 ms. If it runs over, make the care PUT pick the Mon and check declines itself, so a care call is one round trip.
- Anything on a real Echo device. Participants get no device access.

### To finish before Oct 23

1. Open the PR for `feat/alexa-plus` (based on `feat/phase1-loop`) with a deploy checklist, and merge the stack in order.
2. Deploy:
   - Apply migration `20261008_181202_alexa_oauth` (jwks plus seven oauth tables).
   - Set the env vars listed by name in `.env.example`: `AUTH_ISSUER`, `MCP_RESOURCE_URI`, `OAUTH_*`, `V1_MCP_SERVICE_KEY` (same value on admin-vite and the MCP server, 32+ characters), `MCP_ALLOWED_ORIGINS`, `SIM_*`.
   - Host the MCP server, admin-vite and the simulator on HTTPS. Bedrock needs IAM `bedrock-mantle:CreateInference`. The AWS credits form closed Oct 7, so it bills to Mike's account.
3. Run the real model once and walk all six demo beats from `docs/alexa-plus-brief.md`. The Echo Show beat becomes the simulator's device view.
4. Submission assets:
   - **Demo video:** under 3 minutes, public on YouTube or Vimeo, English, no third-party trademarks or music, and never the scripted mock model.
   - **Text description.**
   - **Before/after note:** the repo predates Aug 31 (first commit 2026-08-19), so list what was built after.
   - **Feedback on every tool used,** including the AWS services.
   - **Friction log:** it exists at `docs/FRICTION-LOG.md` but has few entries. It's worth up to a 10% bonus.
   - **AWS Builder write-up** (`docs/aws-builder.md`, not written).
   - **Open Source mini challenge:** a separate public contribution.
   - The repo is already public under MIT, so no reviewer invites are needed.
5. Questions for the Oct 19 office hours:
   - May the simulator use the word "Alexa"? No Alexa+ logo is allowed anywhere.
   - Does Alexa+ honour `ui/request-display-mode` from an inline card?
   - Does it accept `resourceDomains: ['data:']` for inlined fonts? If not, the views fall back to system faces.
   - Does Echo Show expose WebGPU? If not, the room shows the plain sky.
   - Which redirect URIs does Alexa use for account linking?

### Cleanup on the branch

- Done in #12: the old `.devin` skill copy is deleted and every reference points at `skills/nyc-mon-companion`.
- Two ADRs are numbered 0005, and `0005-neon-and-bunny-media.md` says NYC-MON doesn't use Supabase while ADR 0007's presence design does. Presence transport needs a new decision before real presence is built.

### Kit issues found, not patched (Mike's call)

The kit is Mike's. Feature work doesn't edit `packages/ui` or Storybook; the only kit changes so far are the two export lines in commit 0265467, which Mike approved.

- The ring fill against its track is 3.77:1 in daylight. That passes 3:1, but Alexa asks 4.5:1 for colour inside graphics. The fix would be in `packages/ui/care/care-colors.ts`.
- `AuthProviderButton` goes white on white inside a toned `Card`. The linking page avoids it by placing the button outside the card.
- The `CREATURE_ART` alt texts in `packages/assets/creatures` exceed Alexa's 125-character limit.
- Server rendering logs `requestAnimationFrame is not defined` from react-native-worklets via reanimated. The pages still render.

## 3. Everything else still open

- **Merges:** PRs #9, #10 and #11 await Mike.
- **Quest presence (PR C):** not started. The virocore fork's Quest path has no scene anchors yet, so that work goes as a spec to the `viro-meta-vr-glasses-input` session that owns virocore. Validate on a physical Quest 3. Layout rules are in `docs/spatial/HORIZON-LAYOUT.md`.
- **The `quest` script:** unblocked in #18. Its nitro-canvas check guarded a Rive panel only the web page uses. Quest layout reuses Harlem Might's `@viro-external` system; how nyc-mon takes that package is the open choice.
- **Canon questions waiting on Mike:**
  - the capture case look
  - whether "Ratti" is allowed as a Mon's name
  - foods, care numbers and the Baby scale (interim values are D-15/D-16 in `docs/design/DECISIONS.md` and Q43–Q46 in `docs/canon/OPEN_QUESTIONS.md`)
  - Baby speech (Q32)
- **`.p6`:** an agent-made folder at `~/nyc-mon/.p6` with a line in `.git/info/exclude`. Mike to delete; agents were denied `rm -rf` on it.
- **Voice enrollment:** real voiceprints need a COPPA/BIPA decision and their own ADR before any code collects audio (ADR 0015 §2).
- **PayPal E-Card:** not in canon or code. The PayPal AI hackathon closes 2026-11-12. Ask Mike before building anything.
- **Phase 2 legends:** parked per ADR 0013 (PR #10).

## 4. What the work was built from

### Documents Mike gave

| Source | Where | Used for |
|---|---|---|
| Spatial Presence & Legend Encounters brief v1 (pasted 2026-10-08) | captured in `docs/spatial/CONTRACT.md` and ADRs 0010–0012 (this stack); `docs/spatial/PHASE2-LEGENDS.md` and ADR 0013 are on the PR #10 branch | spatial contract, Phase 1 vs Phase 2 split |
| Alexa+ brief | `docs/alexa-plus-brief.md` | deliverables, demo beats, roster |
| Hackathon pages | https://amazonappdev2026.devpost.com/ (rules, resources, FAQ, schedule, updates, discussions), captured in `docs/alexa/HACKATHON.md` | submission checklist, judging, constraints |
| Amazon Alexa+ add-on docs | developer.amazon.com/docs/alexaplus/add-ons/ (MCP toolkit quickstart, authentication, account linking, client lifecycle, display modes, design guide, functional and policy requirements), captured in `docs/alexa/PLATFORM-DOCS.md` | transport, auth, UI and policy requirements |
| Standards | MCP spec 2025-11-25 (modelcontextprotocol.io), MCP Apps SEP-1865 / ext-apps, agentskills.io/specification, OAuth 2.1, RFC 9728 | protocol and skill format |
| Canon | `docs/canon/` (DECISIONS.md, OPEN_QUESTIONS.md, source/, STARTERS_EXTRACT.md), `docs/phase-1-brief.md` | names, rules, what's in scope |
| Premium site prompt pack v3 | `~/Downloads/nyc-mon-premium-site-prompt-pack-v3` | site redesign (merged as b3e2446) |
| Harlem Might layout lessons | from the harlem-might-premium-redesign session, written up in `docs/spatial/HORIZON-LAYOUT.md` | 48dp targets, headset type ramp |
| Design screens | `docs/design/screens/M08–M18/` (01–08 each), `docs/design/DECISIONS.md` | Phase 1 screens and copy (05-copy.md) |

### Skills used

- **Every task:** `no-ai-slop` (all prose), `verification-before-completion`, `product-decisions` (BUILD/STRIKE/DEFER calls).
- **Architecture and API:** `engineering:architecture`, `engineering:system-design`, `api-design` (Margelo), `engineering:testing-strategy`, `tdd-workflow`.
- **Backend and auth:** `payload`, `better-auth-best-practices`, `better-auth-security-best-practices`, `security-review`, `backend-patterns`.
- **UI:** `frontend-design`, `design:design-system`, `design:ux-copy`, `design:accessibility-review`, `design:design-critique`, plus Mobbin references before each screen.
- **Model:** `claude-api` (Bedrock path), `vercel:nextjs` for apps/web.
- **Process:** `engineering:deploy-checklist`, and the artifact quickstart for preview pages.

### MCP servers and tools

- **Research:** WebFetch, curl and Exa (`web_search_exa`, `web_fetch_exa`) for the hackathon and Amazon docs; context7 for the MCP SDK, ext-apps and Bedrock SDK docs.
- **Design references:** Mobbin (`search_screens`).
- **Previews:** the Artifact tool for the live views preview.
- **Browser checks:** Playwright's bundled Chromium. Never system Chrome.
- **Not used here:** Supabase MCP. NYC-MON is on Neon (ADR 0005), and no database was touched.

### Agents

Work ran in parallel lanes, each owning its own files, with the lead integrating, reviewing and committing:

- **A:** MCP server
- **B:** OAuth issuer and linking pages
- **C:** MCP Apps views and the Agent Skill
- **D:** simulator

Reviews used `ecc:typescript-reviewer` and `ecc:security-reviewer`. A lane's report is input, not proof: check claims against the code and screenshots before relaying them.

## 5. How to run it locally

From `docs/alexa/SIMULATOR.md`:

1. Start admin-vite.
2. Start the MCP server with `pnpm --filter @acme/mcp-server dev`. That script sets `NODE_ENV=development` and builds the views first.
3. Start the simulator with `pnpm --filter @acme/web-sim dev`, on :5180 and :5181.

Set `MCP_ALLOWED_ORIGINS=http://localhost:5180` on the MCP server. For a run without the issuer, use `OAUTH_DEV_BYPASS=1` with `SIM_AUTH_MODE=dev-bypass`, and `SIM_MODEL_BACKEND=mock` to skip Bedrock. On this machine port 8788 is taken by another process, so run the MCP server with `MCP_PORT=8789` and point `SIM_MCP_URL` and `MCP_RESOURCE_URI` at it.
