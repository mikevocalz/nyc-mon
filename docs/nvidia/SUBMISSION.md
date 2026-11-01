# Submission draft — not submitted

## Name / category

**NYC-Mon Personal Companion** — Personal AI.

## Proposed concise description

A persistent Mon companion for an authenticated NYC-Mon Caller. A NVIDIA Nemotron model served through Nebius Token Factory uses the existing game's MCP tools to inspect a Mon and carry out permitted care actions. The Caller explicitly chooses which preferences to remember and can inspect, export or forget them. Identity, care state and approved memory belong to the existing account rather than a single browser session.

This description is the intended implemented path. Before pasting it into Devpost, remove or qualify every behavior that has not passed the real acceptance run. Do not imply the complete open-world game is NVIDIA-powered, that Audio2Face satisfies Nebius inference, or that mocked/tool-refusal behavior is a successful persisted action.

## Required fields and evidence

| Field | Current state |
|---|---|
| Representative / team | Creator must confirm |
| Public functional repository / license | Rights and dependency-closure review pending |
| Exact tested revision | Pending final acceptance |
| Hosted demo / test build | Pending deployment and clean-browser test |
| NVIDIA model + Nebius endpoint | Integration defaults documented; actual account/runtime proof pending |
| Significant competition-period changes | New provider adapter, explicit persistent memory, authenticated companion and acceptance tooling; link verified commits |
| Setup / testing instructions | `SETUP.md`, `DEPLOY.md`, `ACCEPTANCE.md`; independent reproduction pending |
| Public YouTube video under 3 minutes | Not recorded / no verified URL |
| Screenshots | Capture from actual working demo, not mockups |
| Nebius/NVIDIA feedback | Record only real tool use, friction, limitations and measured results |
| Devpost submitted status | Not verified; a draft is not a submission |

## Suggested 150-second recording, only after real acceptance

0–20 s: identify the Caller/Mon, actual NVIDIA model and Nebius provider, and what problem the companion solves.

20–55 s: show a real signed-in care request, the actual MCP operation and persisted Mon-state change. Do not hide a decline or use an edited success overlay.

55–100 s: explicitly save a harmless approved preference, then demonstrate it from a separate authenticated session alongside the same Mon state.

100–125 s: show privacy controls, including export/forget and denial of an unauthorized action.

125–150 s: show the public source/setup and redacted runtime receipt; summarize limitations honestly. Do not include secret values, real personal data or unlicensed media.

## Judging alignment

Technical implementation: real Nebius/NVIDIA inference, genuine tools, persistent state, ownership/consent/security and measured failures.

Design: clear identity, visible action outcomes and memory controls. This first slice is text-first; it does not pretend the full 3D experience or voice is complete.

Potential impact: continuity of a persistent companion across sessions rather than another stateless chat.

Idea quality: creature identity combined with safe useful actions and user-controlled memory.

Final checkpoint: `node tooling/nvidia/preflight.mjs`, independent public-link verification, then actual Devpost submission before **October 30, 2026, 1:00 pm Eastern**. The preflight does not submit or prove public video visibility.
