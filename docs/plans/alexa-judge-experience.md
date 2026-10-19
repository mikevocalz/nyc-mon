# Alexa+ judge experience implementation lane

## Mission

Turn the existing NYC-Mon web simulator and MCP Apps surfaces from a technically valid harness into a polished, judge-facing smart-display product experience for the Amazon Build, Ship, Shape submission.

This lane is stacked on `feat/alexa-plus` and must not duplicate the live deployment work in PR #14, latency optimization in PR #15, submission copy in PR #13, or the narrow kit issue inventory in PR #17.

## Technical owners

- Product Engineering Fellow — end-to-end judge experience and scope control
- Staff Smart-Display UX Engineer — primary implementation owner
- Staff Design Systems Engineer — existing NYC-Mon UI system, hierarchy, spacing, typography
- Staff Voice & Conversational UX Engineer — concise voice-first turns and recovery
- Staff Accessibility Engineer — contrast, focus, semantics, reduced motion, readable smart-display scale
- Principal React/TypeScript reviewer — browser/runtime correctness and strict boundaries
- UX Critic — independent final critique
- Hackathon Judge Agent — rubric-based acceptance review

## Mandatory skills / review stack

Use the strongest available equivalents of:

- Mobbin research
- `pbakaus/impeccable`
- frontend-design
- design-system
- UX heuristics review
- accessibility review
- design critique
- UX copy
- `vercel/react-best-practices`
- `mattpocock/skills` for typed UI/tool-state boundaries
- `petergyang/no-ai-slop` for judge-facing copy/docs
- CodeRabbit review after implementation

A skill counts as used only when it materially changes the work.

## Implementation scope

### 1. Judge-first state model

The simulator must present explicit, legible states for:

- signed out / account linking required
- ready
- listening
- thinking
- tool in progress
- successful tool result
- recoverable provider failure
- expired/revoked session
- backend unavailable
- WebGPU unavailable / visual fallback

Do not expose raw developer diagnostics in the judge path.

### 2. Voice-first flow

The primary path must work coherently when the screen is treated as a supporting surface, not the main interaction model.

Acceptance flow:

1. Caller opens the simulator.
2. Existing linked Mon is immediately legible.
3. Caller asks a natural question.
4. A real assistant turn is shown.
5. A state-changing request produces a clear in-progress state.
6. The MCP App result visually confirms the persisted change.
7. A second turn reflects updated state.

### 3. Visual system

Preserve NYC-Mon identity.

Do not clone Alexa proprietary chrome.

Use existing UI primitives before introducing new ones.

Resolve at minimum:

- known contrast defects from #17
- toned Card readability
- overly long creature alt text
- long Mon names
- compact viewport wrapping
- smart-display layout
- narrow/mobile browser fallback
- loading/error hierarchy
- motion/reduced-motion behavior
- WebGPU fallback presentation

### 4. MCP Apps surfaces

Audit the inline card and fullscreen room for:

- information hierarchy
- empty/loading/error states
- visual continuity with the simulator
- keyboard/focus behavior
- screen-reader semantics
- iframe sizing
- fallback behavior without WebGPU
- no duplicated Mon truth

### 5. Demo rehearsal mode

Provide a safe demo route/configuration that uses the same real backend/auth/model path as production judging.

No hidden mock responses.

No fake state fork.

Development-only fixtures must be visibly and technically isolated from production mode.

## File ownership

Primary ownership is expected under:

- `packages/web-sim/**`
- `packages/mcp-server/src/ui/**`
- directly related UI primitives only when required

Shared design-system changes require review because they may affect the mobile/web product.

## Non-goals

- no unrelated mobile redesign
- no new combat/world features
- no replacement backend
- no new animation framework
- no fake Alexa UI clone
- no speculative features absent from the demo

## Verification

Required before this PR can be marked ready:

- focused unit/component tests
- TypeScript clean
- lint clean
- production simulator build
- browser interaction tests
- smart-display-size visual captures
- narrow viewport captures
- WebGPU-disabled pass
- reduced-motion pass
- keyboard/focus pass
- accessibility review
- independent UX critique
- CodeRabbit review and fix cycle
- two consecutive manual demo rehearsals after PR #14 provides the real deployed runtime

## Amazon judging alignment

- Technical Implementation: clear real tool state, resilient browser behavior, no mock leakage
- Design: polished voice-first multimodal UX
- Potential Impact: makes persistent cross-device companion behavior immediately understandable
- Quality of Idea: demonstrates ambient continuity rather than a chat wrapper

## Definition of done

This lane is GREEN only when the judge-facing simulator looks and behaves like a finished NYC-Mon product surface and can survive the full real-runtime demo without developer intervention.
