# NYC-Mon mobile screen research and final permission center

Status: **research and implementation specification**, not an implemented screen. Targets `main` without merging. Owner: mobile design + platform/privacy engineering.

## Source of truth

- Render screen components from `packages/app/features/*`; `apps/mobile/app/*` remains a thin Expo Router route adapter.
- Reuse `@acme/ui`, existing `@acme/theme`, H-Lynk navigation components, `apps/mobile/src/navigation/split-view` and the native reserved-regions Expo module. Never duplicate screens into the Expo route tree.
- Existing notification flow: `packages/app/features/onboarding/NotifyScreen.tsx` and `notify-permission` implement a real OS request and egg-ready scheduling. Preserve and migrate its behavior, including persisted denied/not-now/schedule-failed, rather than request notifications twice.
- `packages/payload/src/payload.config.ts` currently has no shop collections. Inspect the live Payload configuration with Payload MCP **when a Payload MCP connection is made available** before migrating. The current connector toolset here did not expose a Payload MCP action. No catalog or commerce backend is to be invented elsewhere.

## Mobbin reference matrix (research inputs, not copied UI)

| NYC-Mon surface | Repo owner | Reference | Local UX direction |
| --- | --- | --- | --- |
| Account / sign-in | `features/onboarding` + auth features | [Riot Mobile onboarding](https://mobbin.com/flows/9d6c4300-5d9b-48c5-8aa2-7eca96c6766c) | Short, paced stages; age/guardian checks occur before personalized data collection |
| Welcome / Caller creation | `features/onboarding` | [Apple Games onboarding](https://mobbin.com/flows/2de84bab-241f-40be-a344-94bb7eeca3dc) | Player identity is legible at a glance, progress persists |
| Incubate / hatch / meet | `features/egg`, `features/hatch` | [Riot Mobile onboarding](https://mobbin.com/flows/9d6c4300-5d9b-48c5-8aa2-7eca96c6766c) | Character/egg art primary; accessible actions; no hinge clipping |
| Home / companion / feed / rest | `features/companion` | [Finch companion screen](https://mobbin.com/screens/ef6def48-4a50-4003-84c7-df80f8e8f0a3), [Replika](https://mobbin.com/screens/e03cb64b-64b4-42c1-9d51-e47204270ba7) | Mon takes center stage; care/status controls secondary; no fake live state |
| Game landing / continue / leaderboard | `features/game` | [Xbox](https://mobbin.com/screens/feeded9a-9e67-48fc-a690-771f8b0bd952), [PlayStation](https://mobbin.com/screens/701d4f6b-b4a8-478c-8371-9de03bcfb3b4) | Rive leaderboard + angled Continue button that restores persisted map coordinates; game's world render remains separate |
| Drawer / overflow / settings | `apps/mobile/components/DrawerContent.tsx` backed by shared nav definitions | [LinkedIn drawer](https://mobbin.com/screens/30545e57-b441-4373-bf6e-0abf790ca407), [Spotify](https://mobbin.com/screens/5867a8ca-fcc6-4749-b59e-ceccfa7493ff) | Primary 4–5 tabs, overflow grouped under drawer; preserve deep link and back behavior |
| Shop catalog / product / cart / checkout | new `features/shop`, Payload schema | [Under Armour purchase](https://mobbin.com/flows/eab13d90-ca43-4141-80ee-849aabe60726), [eBay purchase](https://mobbin.com/flows/c9666c04-e9d5-409d-a67f-6c9afdf620ab), [Fresha cart/checkout](https://mobbin.com/flows/fe05da38-3010-4914-bb23-c0324ea621a5) | Payload products and variants; typed API, inventory validation, secure payment handoff, accessible order states |

Each implemented screen requires its own research notes, screenshot-based critique, DESIGN.md token mapping, accessible states, Storybook variants and regression checks. Mobbin references are inspiration, not licenses to reproduce branding or assets.

## Onboarding order

Welcome → adult/teen age rules and legally required guardian consent → account identity → Caller identity → egg choice and incubation → meet Mon → **final “Ready for NYC” permissions center** → home/game.

The final screen must be a standard full-page step, not the pre-existing dismissible notification form sheet; keep the latter available for contextual egg alert scheduling. It should not request permissions automatically on mount.

Permission center cards:
1. **Location (foreground / while-in-use):** nearby encounters and city play. Ask only on explicit opt-in, degrade to map/manual city exploration after deny; do not request background location without separate product justification and platform approval.
2. **Camera:** AR and scanning, just-in-time request when player opts in or launches scanner.
3. **Microphone:** voice interaction. Explicitly explain collection; do not enroll voiceprints or retain recordings by default.
4. **Notifications:** egg-ready, quests and optional reminders. Reuse existing permission helper and persisted denial semantics, avoid duplicate prompt and preserve schedule information.
5. **Motion/orientation:** explain AR utility; request native permission only on OS versions that require it.
6. **Photo library (limited selection):** saving/sharing, use system photo picker when sufficient; do not request broad media access unnecessarily.
7. Any extra nearby-device/Bluetooth permission is **conditional** on device pairing feature availability and should not appear as mandatory.

UI state: not requested / granted / denied / unavailable; each row individually accessible with an explicit action. CTA: “Continue” and “Not now”; never block gameplay on optional denial. Provide Open Settings for permanently denied cases, never loop the OS prompt. Keep privacy text localized and plain-language. No all-at-once OS permission modal. Do not mark an item granted based solely on its checkbox preference.

## Adaptive behavior

- Compact phone: bottom navigation, one-column scrolling card list, sticky CTA above safe area and keyboard; dynamic type, RTL and reduced motion.
- Compact-height landscape: avoid bottom controls overlapping content; use adaptive rail when space demands; all touch targets >=44pt.
- Book foldable: primary scene in one safe region, secondary collection/details in another; hinge occlusion and cutouts honored via reserved-region geometry, not a single guessed divider.
- Tabletop posture: scene upper, controls lower, avoid placing actions on hinge.
- Expanded tablet/dual-screen: persistent start rail plus optional closable inspector. Shop product detail and collection inspection can use secondary pane; permission center and checkout stay focused, avoiding unsafe cross-window payment state.
- Test closed/opened rotation, multitasking, split-screen, iOS large text and Android font scale, accessibility focus, RTL, voice over/talkback and keyboard.

Required skills: Anthropic frontend-design, Google stitch-skills, nextlevelbuild ui-ux-pro-max-skill, pbakaus/impeccable, Vercel agent-skills and accessible UI audits, expo/skills, mattpocock/skills, FloWritesCode fwc-swiftui-skills (swiftui-iphone-duo adaptive principles), react-native-arrangement-view research, existing native reserved-regions and foldable skill, coreyhaines31/marketingskills when writing storefront copy, petergyang/no-ai-slop for docs. Use Mobbin for screen-specific reference review. Kinetrell only for new cross-platform animations, and Zustand for shared state.

## Payload commerce research gate

Payload MCP: inspect running collections, permissions, hooks and admin before proposing migration. Implement product categories, products, SKU variants, inventory, prices, images, cart, checkout/order/payment states using Payload ecommerce capabilities **only after version, compatibility and live-schema review**. Store frontends consume typed Payload APIs. Adult/guardian commerce gating and refunds, taxes, fulfillment and provider webhooks require security and finance review. No client-side trusted totals. Tests prove stock reservation, pricing integrity, checkout webhook idempotency, order ownership, expired sessions, returns and restricted-age purchasing.

## PR decomposition / exit criteria

1. Design system + Mobbin screen dossiers with unique references and screen-by-screen redlines.
2. Final onboarding permission center + navigation wiring + native permissions, denial handling, rerun onboarding and E2E validation.
3. Drawer/navigation hierarchy and deeply linked overflow screens.
4. Responsive pass for each existing feature screen, storybook visual coverage, foldable and duo device matrix.
5. Payload commerce schema and migrations, then shop UI and payment implementation with isolated verified PRs.

This PR records research + requirements **only**. It does not claim screens, permissions, shop, payments, device testing or Payload MCP queries have been implemented.
