# Skill packs

`skills/` is the repo copy of the skill packs the arcade-control directive (§6) requires, so an agent working in this checkout can load them without a network or a user profile. `~/.claude/skills` is the user copy on one machine; it can drift, and nothing here reads from it. When the two differ, the repo copy is the one a lane cites.

Each pack carries the upstream LICENSE and a `SOURCE.md` with the repo URL, the commit copied, the date, and the subpaths taken. Re-copying a pack means repeating that record. Lanes are the directive §15 subagents: A research and design, B Rive motion, C native input, D adaptive layout, E game systems and persistence, F verification and accessibility.

| Pack | Source | Commit | What it is for | Lanes |
| --- | --- | --- | --- | --- |
| `no-ai-slop/` | https://github.com/petergyang/no-ai-slop | `000650b` | Edit and audit prose: READMEs, comments, PR bodies, story docs | B, F, every lane that writes prose |
| `impeccable/` | https://github.com/pbakaus/impeccable | `abf5779` | Design context, layout, motion, adaptation and audit passes on UI (`/impeccable <command>`) | A, D |
| `mattpocock/` | https://github.com/mattpocock/skills | `49dd158` | Type-level API craft, domain modeling, specs, bug diagnosis, code review (grouped as upstream: engineering, productivity, misc, in-progress) | C, E |
| `gesture-handler-3-migration/` | https://github.com/software-mansion/react-native-gesture-handler | `66a032a` | Hook-based RNGH 3 gesture code checked against the installed type definitions | C |
| `swiftui-iphone-duo/` | https://github.com/FloWritesCode/fwc-swiftui-skills | `3a6c74b` | Hinge-safe and multi-display principles; the SwiftUI APIs apply to Apple targets only | D |
| `marketingskills/` | https://github.com/coreyhaines31/marketingskills | `55ff469` | Announcement and launch copy. Never drives controller engineering | none by default |
| `agent-device/` | https://github.com/callstackincubator/agent-device | `22ae872` | Scripted device gestures, screenshots and repeated scenarios as evidence | F |
| `callstack-react-native-best-practices/` | https://github.com/callstackincubator/agent-skills | `59e9d17` | Measured optimization reports mapped to FPS and TTI, before and after | C, E, F |
| `callstack-create-react-native-library/` | https://github.com/callstackincubator/agent-skills | `59e9d17` | Scaffolding a native library. Listed under Margelo in the directive; Callstack ships it | C, E |
| `callstack-react-native-testing/` | https://github.com/callstack/react-native-testing-library | `5678d04` | React Native Testing Library v13/v14 tests. The directive's "Expo testing skill"; expo/skills ships none | C, E, F |
| `margelo/api-design`, `cpp`, `swift`, `kotlin`, `build-nitro-modules` | https://github.com/margelo/react-native-skills | `1e9e17b` | Public API review for every `@acme/*` surface (repo law R5), native boundary design, Nitro HybridObjects for any C++ | C, E |
| `expo/expo-overview`, `expo-animation`, `expo-native-ui`, `expo-router` | https://github.com/expo/skills | `d4f4840` | Expo-correct native UI, routing and animation patterns, cited to the installed SDK | D |
| `mikevocalz-foldable-layouts/` | Michael's 2026-10-15 copy (upstream https://github.com/mikevocalz/universal-spatial-starter `256a97b`) | blob `d60f539` | The tailored foldable, dual-screen, tablet and Inspector layout rules AGENTS.md pins; adds §9 Arrangement View (see SOURCE.md) | A, D, every UI lane |
| `nyc-mon-companion/` | this repo | n/a | The project's own skill; not a pack | all |

## Not copied

- **WorldFlowAI everything-claude-code** (https://github.com/WorldFlowAI/everything-claude-code) is installed as the `ecc:*` plugin, so its agents, skills and commands load from the plugin, not from this folder. Lanes E and F use it for subagent coordination and the review loop.
- **CodeRabbit** (https://github.com/coderabbitai) publishes no skill pack. Its part in the directive is a workflow: an independent review of each PR, fixes for every finding, then a retest before the PR is re-requested. Lane F runs it.
- **Margelo `native-module-helper`** does not exist in margelo/react-native-skills and has no verified upstream, so nothing was copied. Use `margelo/build-nitro-modules` and `callstack-create-react-native-library` instead.
- **Impeccable** ships only the built skill here (`plugin/skills/impeccable`, 2.2 MB of 86 MB). Its `scripts/impeccable` launcher downloads the engine binary into `~/.impeccable/bin/` on first run; no binary is committed.

## Loading a pack

Point the agent at the SKILL.md inside the pack, for example `skills/margelo/api-design/SKILL.md`. Read a pack's own instructions before using it; several (Impeccable, agent-device, react-native-best-practices) expect a tool on PATH and say so in their first lines.
