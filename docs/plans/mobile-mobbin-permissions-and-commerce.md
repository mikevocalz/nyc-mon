# NYC-Mon mobile screen research and final permission center

Status: research and implementation specification. Re-checked against `main` (`311ab58`, 2026-10-15). The permissions track (PR 1 below) is being implemented by PR #37 (`feat/onboarding-permission-center-notifications`, draft). Owner: mobile design + platform/privacy engineering.

## Source of truth (verified on `main`)

- Screen components live in `packages/app/features/*`; `apps/mobile/app/*` is a thin Expo Router route adapter. Verified: `apps/mobile/app/(onboarding)/{welcome,caller,meet,incubate,notify}.tsx`, `(auth)/{age,sign-in,consent}.tsx`, `(home)/*`, `(drawer)/(tabs)/{game,notifications,profile}.tsx`.
- Reuse `@acme/ui`, `@acme/theme`, the H-Lynk navigation components, `apps/mobile/src/navigation/split-view` and the native reserved-regions Expo module (`apps/mobile/modules/reserved-regions`, iOS and Android; hooks in `packages/ui/reserved-regions*.ts`). Never duplicate screens into the Expo route tree.
- Existing notification flow: `packages/app/features/onboarding/NotifyScreen.tsx` (M06, a form sheet declared in `(onboarding)/_layout.tsx` with `presentation: 'formSheet'`) and `notify-permission.native.ts` run the real OS request and schedule the one egg-ready notification per egg. `onboarding.store.ts` persists `NotifyOffState = 'not-now' | 'denied' | 'schedule-failed'`, and `notify-status.ts` maps each to its follow-up action (re-ask or Open Settings). Preserve and reuse this; never request notifications twice.
- `packages/payload/src/payload.config.ts` registers Users, Media, AuditEvents, CareStates, Eggs, GuardianConsents, IdempotencyRecords, IntegrityRuns, MonInstances, LanguageLexicon and Waitlist. No product, cart, order or payment collection exists. Inspect the live Payload configuration before any commerce migration; this plan makes no claim about the live schema. No catalog or commerce backend is to be invented elsewhere.

## Mobbin reference matrix (research inputs, not copied UI)

| NYC-Mon surface | Repo owner today | Reference | Local UX direction |
| --- | --- | --- | --- |
| Account / sign-in | `features/onboarding` (`SignInScreen`, `AgeGateScreen`, `ConsentScreen`) | [Riot Mobile onboarding](https://mobbin.com/flows/9d6c4300-5d9b-48c5-8aa2-7eca96c6766c) | Short, paced stages; the birth-year gate and guardian consent run before any personal data collection |
| Welcome / Caller creation | `features/onboarding` (`WelcomeScreen`, `CallerNameScreen`) | [Apple Games onboarding](https://mobbin.com/flows/2de84bab-241f-40be-a344-94bb7eeca3dc) | Caller identity is legible at a glance, progress persists |
| Egg choice / incubate / hatch | `features/egg` (`MeetScreen`, `IncubateScreen`), `features/hatch` | [Riot Mobile onboarding](https://mobbin.com/flows/9d6c4300-5d9b-48c5-8aa2-7eca96c6766c) | Egg and creature art primary; accessible actions; no hinge clipping |
| Home / companion / feed / rest | `features/companion` | [Finch companion screen](https://mobbin.com/screens/ef6def48-4a50-4003-84c7-df80f8e8f0a3), [Replika](https://mobbin.com/screens/e03cb64b-64b4-42c1-9d51-e47204270ba7) | The Mon takes center stage; care and status controls secondary; no fake live state |
| Game tab / lobby / leaderboard | `features/game` (`GameScreen.tsx`, the city renderer from PRs #30, #33, #34); the Rive lobby with START/resume and a leaderboard panel is in flight under the arcade-controller directive (design: `docs/design/screens/G02-game-lobby`) | [Xbox](https://mobbin.com/screens/feeded9a-9e67-48fc-a690-771f8b0bd952), [PlayStation](https://mobbin.com/screens/701d4f6b-b4a8-478c-8371-9de03bcfb3b4) | One START that resumes the saved world position; the leaderboard shows `unavailable` until a server ranking authority exists; the world renderer stays separate |
| Drawer / overflow / settings | `apps/mobile/components/DrawerContent.tsx` (hard-coded `MAIN_ITEMS`: Home, Notifications, Profile, Settings); tabs on `main` are Game, Alerts, Profile. The canon five-tab shell (HOME · GAME · H-LYNK · MONS · CALLER, Decision #23) is PR 1 of `docs/implementation/MOBILE_WORLD_PR_PACK.md` and has not landed | [LinkedIn drawer](https://mobbin.com/screens/30545e57-b441-4373-bf6e-0abf790ca407), [Spotify](https://mobbin.com/screens/5867a8ca-fcc6-4749-b59e-ceccfa7493ff) | Primary tabs from one shared nav definition, overflow grouped under the drawer; preserve deep links and back behavior |
| Shop catalog / product / cart / checkout | none; would be a new `features/shop` plus Payload schema | [Under Armour purchase](https://mobbin.com/flows/eab13d90-ca43-4141-80ee-849aabe60726), [eBay purchase](https://mobbin.com/flows/c9666c04-e9d5-409d-a67f-6c9afdf620ab), [Fresha cart/checkout](https://mobbin.com/flows/fe05da38-3010-4914-bb23-c0324ea621a5) | Payload products and variants; typed API, inventory validation, secure payment handoff, accessible order states |

Each implemented screen needs its own research notes, screenshot-based critique, `docs/DESIGN_SYSTEM.md` token mapping, accessible states, Storybook variants and regression checks. Mobbin references are inspiration, not licenses to reproduce branding or assets.

## Onboarding order

As `main` runs it (`packages/app/features/onboarding/boot.ts`, `packages/core/sim/onboarding.ts`): Welcome (M02) → birth-year gate (M04, `/(auth)/age`) → create account or sign in (M03) → guardian consent when under 13 (M05) → Caller name (M07) → egg choice (M08, `/(onboarding)/meet`) → incubation start (M10, `/incubate`) → home (M11 incubating). The hatch (M12) and the naming ceremony (M09) happen later, at home, once incubation ends.

The final permissions center slots in after M10 and before home. PR #37 does this: M10 writes a persisted `permissions-pending` marker and advances to a full-page `/(onboarding)/permissions` route; a cold restart with a pending marker and a valid new egg resumes there; installs without the marker are untouched. PR #35 (`feat/mobile-final-permissions-20261015`, draft) is a second implementation of the same slot, named M24 in its handoff, with a notifications-only prompt; one of the two has to be chosen before either leaves draft.

The final screen is a standard full-page step, not the M06 form sheet; M06 stays available for contextual egg-alert scheduling. It never requests a permission on mount.

Permission center cards:
1. Location (foreground / while-in-use): nearby encounters and city play. Ask only on explicit opt-in, degrade to map and manual city exploration after deny; never request background location without separate product justification and platform approval.
2. Camera: AR and scanning, requested just in time when the Caller opts in or opens the scanner.
3. Microphone: voice interaction. Say what is collected; no voiceprint enrollment and no retained recordings by default (PR #16's ADR 0019 must land first for anything more).
4. Notifications: egg-ready, quests and optional reminders. Reuse the existing helper and the persisted `NotifyOffState`; no duplicate prompt; keep the schedule information.
5. Motion and orientation: explain the AR use; request the native permission only on OS versions that need it.
6. Photo library (limited selection): saving and sharing; use the system picker where it is enough; never request broad media access without a reason.
7. Nearby-device or Bluetooth permission is conditional on a device-pairing feature existing and never appears as mandatory.

PR #37 implements cards 1 to 6 with Notifications as the only default-on toggle (`permission-center-model.ts`: `DEFAULT_SELECTED_PERMISSIONS = ['notifications']`), one native request at a time, and a Not now path that makes no OS request. Card 7 is not implemented anywhere.

UI state per row: not requested / granted / denied / blocked (Open Settings) / unavailable; each row individually accessible with an explicit action. CTAs: Continue and Not now; gameplay never blocks on an optional denial. Open Settings for permanently denied cases, never a loop back to the OS prompt. Privacy text is localized plain language. No all-at-once OS permission modal. A toggle records interest; it never marks an item granted.

## Adaptive behavior

- Compact phone: bottom navigation, one-column scrolling card list, sticky CTA above the safe area and keyboard; dynamic type, RTL and reduced motion.
- Compact-height landscape: keep bottom controls off the content; use the adaptive rail when space demands; all touch targets at least 44 pt.
- Book foldable: primary scene in one safe region, secondary collection or details in another; hinge occlusion and cutouts honored through reserved-region geometry, never a guessed divider.
- Tabletop posture: scene upper, controls lower, no actions on the hinge.
- Expanded tablet and dual-screen: persistent start rail plus an optional closable inspector. Shop product detail and collection inspection may use the secondary pane; the permission center and checkout stay single-pane so payment state never crosses windows.
- Test closed and open rotation, multitasking, split-screen, iOS large text and Android font scale, accessibility focus, RTL, VoiceOver and TalkBack, and hardware keyboard.

Skills: the repo requires the pinned `mikevocalz-foldable-layouts` skill (`AGENTS.md`). Lanes also draw on Anthropic frontend-design, Google stitch-skills, nextlevelbuild ui-ux-pro-max-skill, pbakaus/impeccable, Vercel agent-skills and accessible UI audits, expo/skills, mattpocock/skills, FloWritesCode fwc-swiftui-skills (swiftui-iphone-duo adaptive principles), the react-native-arrangement-view research (rejected for the controller, `docs/design/research/arrangement-view-verdict.md`), coreyhaines31/marketingskills for storefront copy and no-ai-slop for docs. Mobbin for screen-specific reference review. Kinetrell only for new cross-platform animations; Zustand for shared state.

## Payload commerce research gate

Inspect the running collections, permissions, hooks and admin before proposing a migration. Implement product categories, products, SKU variants, inventory, prices, images, cart, checkout, order and payment states with Payload ecommerce capabilities only after a version, compatibility and live-schema review. Store frontends consume typed Payload APIs. Adult and guardian commerce gating, refunds, taxes, fulfillment and provider webhooks need security and finance review. No client-side trusted totals. Tests prove stock reservation, pricing integrity, checkout webhook idempotency, order ownership, expired sessions, returns and restricted-age purchasing.

## PR decomposition / exit criteria

1. Final onboarding permission center, navigation wiring, native permissions, denial handling, rerun onboarding and E2E validation. In progress: PR #37 (code committed; lockfile regeneration, typecheck, lint, tests, prebuild and real iOS/Android runs still open per its body). PR #35 overlaps.
2. Design system + Mobbin screen dossiers with unique references and screen-by-screen redlines. Open.
3. Drawer and navigation hierarchy, deep-linked overflow screens, the canon five-tab shell. Open (PR 1 of the PR pack).
4. Responsive pass for each feature screen, Storybook visual coverage, foldable and Duo device matrix. Open.
5. Payload commerce schema and migrations, then shop UI and payment, as isolated verified PRs. Open.

This document records research and requirements. Of the five PRs above, only the permission center has an implementation PR, and that PR has not been run on a device. Nothing here claims shipped screens, shop, payments, device testing or a live Payload schema read.
