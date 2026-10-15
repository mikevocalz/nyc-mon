# Alexa+ submission assets

Draft. Everything Devpost asks for besides the code, due Fri 2026-10-23 12:00 PT. Requirements are quoted in `docs/alexa/HACKATHON.md`.

## Checklist

- [ ] Text description, written to the four equal judging criteria: technical implementation, design, potential impact, quality of the idea.
- [ ] Demo video under 3 minutes, public on YouTube or Vimeo, in English, with no third-party trademarks or copyrighted music and no Alexa+ logo. Record it against the real model; the scripted mock must not appear.
- [ ] Repo URL. The repo is public under MIT, so no reviewer invites are needed.
- [ ] Testing instructions: the simulator URL and a test account (an adult account with one hatched Mon), from `docs/alexa/SIMULATOR.md`.
- [ ] Before/after note (below).
- [ ] Product feedback on every tool used, including the AWS services.
- [ ] Friction log: `docs/FRICTION-LOG.md` has one seed entry. Fill it from the gaps in `docs/alexa/HACKATHON.md` and `docs/alexa/PLATFORM-DOCS.md` (worth up to a 10% bonus).
- [ ] AWS Builder mini challenge: `docs/aws-builder.md`, covering the model id, the IAM action (`bedrock-mantle:CreateInference`), the region and the measured cost per session.
- [ ] Open Source mini challenge: a separate public upstream contribution. Not chosen yet.
- [ ] Tracks and mini challenges entered on the form.

## Before/after note (draft)

The repo existed before 2026-08-31 as one commit: the Solito monorepo scaffold from 2026-08-19 (apps/mobile, apps/web, apps/storybook, packages for UI, theme, Payload and app code). Everything for this entry came after:

- the MCP server, the MCP Apps views and the Agent Skill (first commit 2026-10-05)
- the OAuth authorization server for account linking and the `/v1` routes it uses
- the web simulator on Claude via Amazon Bedrock

The NYC-MON game itself (canon, the kit, the Phase 1 mobile screens) was also built after the scaffold; the hackathon work sits on top of it.

## Demo script: needs rework

The brief's six beats (`docs/alexa-plus-brief.md` §8) no longer match what was built:

| Beat | Problem | Proposed |
|---|---|---|
| 1. Link account, Ratti greets on Echo Show | No device access; "Ratti" as a name is an open canon question | Link through the simulator's sign-in; the Mon greets in the device view with its real name |
| 2. "You hungry?" → status → feed | Works | Keep; show the card update and the room's grid floor |
| 3. James detected nearby | Presence is seeded test data only (ADR 0015) | Seed James from the dev panel on camera, or cut |
| 4. James asks for the rare item → refused | Needs the real model; untested | Keep if it works with the real model |
| 5. Nurse Nay heal flow | `heal_mon` was removed (no canon care action) | Cut, or replace with Rest and Wake |
| 6. Familiar Voices consent screen | Not built; no real voice enrollment until a COPPA/BIPA decision | Cut |

## Decisions needed from Mike

- The Mon's name in the demo (the "Ratti" question).
- Which Open Source contribution to make.
- Who records the video, and whether it shows a real Echo-style device frame or the simulator page as it is.
