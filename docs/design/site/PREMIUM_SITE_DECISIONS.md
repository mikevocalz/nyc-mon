# Premium site decisions (ADR log)

One entry per non-trivial decision on the W01 premium redesign. Format: context, decision, alternatives, consequences. Dispositions follow the build / strike / defer rule: build only on real data end to end, strike when the surface's precondition failed, defer when the blocker is a decision someone else owns.

PS-001 to PS-007 answer `PREMIUM_SITE_AUDIT.md` §17, decided 2026-10-07 after Phase 1.

---

## PS-001 — Waitlist capture is `POST /v1/waitlist` in apps/admin-vite

**Disposition:** BUILD (Phase 6). Interim: the fake confirmation must not reach production.

**Context.** `/get` (`apps/web/components/get/GetPage.tsx`) checks the email with a regex, sets `useState`, and says "You're on the list" without sending or storing anything. ADR 0003 moved Payload, Better Auth and the `/v1` API to `apps/admin-vite`; `docs/REPO_MAP.md:66` says `apps/web` holds no database or auth secrets. admin-vite already serves an unauthenticated, pre-account POST in this shape: `apps/admin-vite/src/routes/v1/guardian-consents.ts` hands the request to `handleCreateGuardianConsent` in `@acme/payload`.

**Decision.**
- New Payload collection `waitlist` (email unique, district, source, createdAt) and handler in `@acme/payload`, mounted at `apps/admin-vite/src/routes/v1/waitlist.ts` following the guardian-consents route.
- Validation, honeypot and rate limit run server-side in the handler. A repeat email returns the same success ("You're already on the list"), so the endpoint doesn't reveal who has signed up.
- Age: the form asks "Are you 13 or older?". A "no" stores nothing and shows the guardian path from ADR 0001; no under-13 email is collected.
- `apps/web` calls it from a server action. The admin base URL is a server-only env var; the browser never sees it. The form uses `useActionState` (contract §12) on `@acme/ui/html` `Form` / `Label` / `Input` / `Output`, with every state announced.
- Until the endpoint ships, the confirmation copy is not shown as success. First change of Phase 2: either gate `/get` and its CTAs off in production, or replace the confirmation with an honest "Sign-ups open soon" state. No form may claim a signup it didn't store.

**Alternatives.** A server action in `apps/web` with its own DB secret breaks ADR 0003's boundary. A third-party list (Resend audience, Mailchimp) adds a vendor and a second store of minors' data. Payload already holds consent records, so this keeps one store.

**Consequences.** Phase 6 depends on admin-vite being deployed with a URL the web server can reach. Deploy checklist gains the env var, the collection migration and a rollback.

---

## PS-002 — H-Lynk Core colour is red

**Disposition:** decided by Mike, 2026-10-07: red.

**Context.** Decision #16 (`docs/canon/DECISIONS.md:242`) gives the Core a matte red body. Page copy says "a red handheld". `device-scene.ts:176-177` renders `#1D4ED8`. Commit 727428d (Mike, 2026-10-04) made it blue on purpose: "Blue shell variant; hlynk.core token stays red for canon".

**Decision.** Red on the marketing page, and the static capture is regenerated in red. It's the canon Core, the copy already says red, and red is the contract's hardware accent. Blue can stay as a variant inside the product if wanted.

**Consequences.** Phase 4 changes the body material in `device-scene.ts` to the `hlynk.core` token and regenerates `/home/h-lynk-core.png`.

---

## PS-003 — Header CTA is "Join the waitlist"; "Log in" leaves the site nav

**Disposition:** decided. STRIKE "Log in" from the marketing nav.

**Context.** `apps/web/components/site/nav.ts:14` sets `NAV_CTA` to "Log in", the header's only filled button. `SiteChrome.tsx:26-27` says the product site carries no auth (ADR 0003). The contract's copy law is one CTA string site-wide, and the app isn't available to the public, so no visitor has an account to log in to.

**Decision.** `NAV_CTA` becomes "Join the waitlist" → `/get`, sourced from the same copy constant as the hero and hatch CTAs. The `/sign-in` route stays where it is; only the nav entry goes.

**Return condition.** "Log in" comes back as a secondary text link when the app is publicly available.

---

## PS-004 — DeviceStage label is "H-Lynk Core", from copy.ts

**Disposition:** decided.

**Context.** `DeviceStage.tsx:60` has `aria-label="H-Lynk device"` as a JSX literal. Screen-reader users hear it, so it falls under the rule that UI never calls the H-Lynk "the device" (COPY_DECK Law 9, contract §4).

**Decision.** The label is "H-Lynk Core" and lives in `copy.ts`. The `"The device"` eyebrow (`copy.ts:23`) becomes "H-Lynk" in the same change.

---

## PS-005 — Mon pronouns

**Disposition:** decided by Mike, 2026-10-07: the player's Mon's gender is unstated in Phase 1 (answers canon Q14, `docs/canon/OPEN_QUESTIONS.md:60`).

**Context.** v11 says Mons have genders (¶54). v7 calls the rat line "he" and the cat line "she", and gives nothing for Yotes. Nothing says whether the player's own Mon has a fixed gender, a chosen one, or none stated in Phase 1. The current copy uses "it" for a Mon.

**Decision.** Marketing copy doesn't use a pronoun for an individual Mon. It says "your Mon", names the starter, or restructures the sentence. This avoids both "it" (which canon's genders argue against) and guessing a gender.

**Reopen when** a later phase of the game states a gender.

---

## PS-006 — Strike "its own weather" from World copy

**Disposition:** STRIKE.

**Context.** `copy.ts:20` says each district has "its own weather". A search for "weather" across `docs/canon`, `packages/content` and `packages/spatial` finds nothing. Canon Law 1: don't invent canon.

**Decision.** Phase 3 drops the phrase. World copy uses what canon has: the four districts and their real streets.

**Return condition.** Canon adds per-district weather.

---

## PS-007 — Final art: build the slots, wait for the assets

**Disposition:** DEFER the art; BUILD the art map.

**Context.** `packages/assets` holds the logo, wordmark, two fonts and NYC photos only. No Mon, egg or H-Lynk render exists in the repo (file search for the starter, Baby and egg names found nothing). The audit's main finding is that no creature appears on the page.

**Decision.** Phase 2's `art.ts` defines every slot as an exhaustive union with aspect ratio, pixel sizes per breakpoint, alt ownership and mobile crop. Sections compose so they hold up without the creature art: type and photography, no stand-in creature and no placeholder text in the DOM (contract §14). Real art replaces slot contents without layout change.

**Assets.** Mike confirmed on 2026-10-07 that he has or will produce all four sets: Baby-form renders for the three starters, three egg key art images (Metro, Corner, Prism), a red H-Lynk Core capture (after PS-002), and street-level photography of each district at the slot aspects.

---

## PS-008 — Rendering boundaries: server sections, small client islands

**Disposition:** decided (Phase 2).

**Context.** `HomeHero.tsx` is a whole-file client component because it reads `useDistrictStore`, renders `SegmentedControl`, and lazy-loads `CityBlocks` with `next/dynamic` (`ssr: false`). Phase 1 measured 1.4 s JS bootup and 664 KiB unused JS on the home route. Marquee, World, H-Lynk, Starters, Care and Hatch have no directive but render `View` from `@acme/ui/tw`, a client module.

**Decision.** Section shells are server components built from `@acme/ui/html`. The hero splits: headline, support line, CTA, seal and photo are server HTML; a client island holds the district selector and the city canvas. `DeviceStage` stays the H-Lynk island. Phase 3 applies this to the hero; Phases 4–6 keep it for their sections.

**Alternatives.** Keeping the hero client-side is simpler but ships its copy in the client bundle and ties first paint to hydration.

**Consequences.** Server sections can't read the district store; anything that follows the picked district (the divider tint, hero city) stays inside the island or reads the store in its own small client component.

---

## PS-009 — One motion clock: `gsap.ticker` drives Lenis

**Disposition:** decided and implemented (Phase 2).

**Context.** `MotionRoot.tsx` ran `ReactLenis` with `autoRaf: true` and `connectGsapLenis(lenis, { clock: 'external' })`. In Kinetrell 0.1.0-alpha.1 `'external'` only subscribes `ScrollTrigger.update` to Lenis scroll (`gsap-lenis.mjs:15-20`), so Lenis and `gsap.ticker` each ran a RAF loop.

**Decision.** `autoRaf: false` and `clock: 'kinetrell'`, which adds `lenis.raf` to `gsap.ticker`. Reduced motion still renders without Lenis.

**Alternatives.** Lenis as the clock with GSAP's ticker driven from it (`gsap.ticker.remove(gsap.updateRoot)` + manual updates): not supported by the Kinetrell API, so it would be a second abstraction beside it (contract §10).

**Consequences.** `site-qa:motion` asserts one motion clock. If Kinetrell changes the clock semantics, that check fails first.

---

## PS-010 — Canvases loop only while visible; three's internal loop is stopped

**Disposition:** decided and implemented (Phase 2).

**Context.** Phase 1 found 3 RAF loops idle and 5 with the H-Lynk stage on screen. The hero `CityBlocks` ignored `SceneSection`'s `paused` (the component had no such prop), and three's `Renderer.init()` starts `Animation.start()`, a RAF loop that runs until dispose even when `ThreeCanvas` has stopped drawing (`three/src/renderers/common/Animation.js`, r186).

**Decision.** `CityBlocks` gains a `paused` prop forwarded to `GpuCanvas`; the hero passes `SceneSection`'s value. `ThreeCanvas` calls `renderer._animation.stop()` after `init()` and advances `renderer._nodes.nodeFrame` in its own `draw()`. Both are private three members, wrapped in two guarded helpers with a comment naming the source; a rename turns them into no-ops and `site-qa:motion` catches the returning loop.

**Alternatives.** A global canvas coordinator store that grants one canvas at a time: unnecessary while the two canvases are a full section apart and each pauses offscreen. Revisit if two canvases ever share a viewport.

**Consequences.** One live canvas loop at most; none when neither is on screen.

---

## PS-011 — Art map: typed slots, local assets, swap without layout change

**Disposition:** decided and implemented (Phase 2).

**Context.** `art.ts` exported `TEMP_*` constants of NYC photos, and photo titles/places rendered as captions. Final Mon, egg and H-Lynk art is coming (PS-007).

**Decision.** `art(slot)` over an exhaustive `ArtSlot` union with dimensions, `sizes`, and alt or a decorative reason; a unit test enforces it. Details in `PREMIUM_SITE_ARCHITECTURE.md` §5.

**Consequences.** Final art is a source swap per slot. The slot list and final-asset specs live in `PREMIUM_SITE_HANDOFF.md`.

---

## PS-012 — District selector is a radio group, fixed in the kit

**Disposition:** decided and implemented (Phase 2).

**Context.** `SegmentedControl.web.tsx` rendered `role="tablist"`/`role="tab"` with no tab panel and no arrow keys inside a fieldset with a legend, and overflowed its panel at 390 and 320 (WCAG 4.1.2, 1.4.10).

**Decision.** Radio-group semantics with roving tabindex and arrow/Home/End keys, wrapping to two rows in narrow containers. Fixed in `packages/ui` so every caller gets it.

**Consequences.** Every `SegmentedControl` in the product now announces as a radio group; callers that relied on tab semantics were checked when the change landed.

---

## PS-013 — Hero: server HTML, two client islands, LCP is server-rendered content

**Disposition:** decided and implemented (Phase 3).

**Context.** `HomeHero.tsx` was a whole-file client component: copy, CTA, seal and photo hydrated with the district control. It imported `useDistrictStore` from the `@acme/spatial` barrel, which also exports the Viro and Rive scenes, so `/` shipped a 446,558-byte chunk (`StudioSceneNavigator`, Viro, Rive) that only `/spatial` needs. PS-008 set the boundary; this applies it.

**Decision.**
- `HomeHero.tsx` is a server component. Headline, support line, CTA, photograph, seal and caption are server HTML from `@acme/ui/html` and `@acme/ui`.
- `HeroDistrictIsland.tsx` ('use client') holds the two pieces that read the store: `HeroCity` (the `SceneSection` that draws `CityBlocks` behind the server children, still `next/dynamic` with `ssr: false` and `paused` forwarded) and `HeroDistrictPicker` (the radio group).
- The store is imported by module path, `@acme/spatial/district` (new export in `packages/spatial/package.json`), from the island and `DistrictDivider`. The Viro chunk no longer loads on `/` (checked in the served HTML's script list).
- The photograph keeps `loading="eager"`, `fetchPriority="high"` and a `<link rel="preload" as="image">` rendered in the tree (React hoists it). `ReactDOM.preload()` from the server component reached only the flight payload, not the HTML, so the element stays.
- LCP: on Lighthouse's mobile viewport (412×823) the measured LCP element is the support paragraph `#mfx-hero-body`, because the photograph now sits below the copy on phones. Both are server HTML with fixed boxes, so neither waits for hydration or the canvas. The canvas is never LCP: it mounts after hydration behind content that already reserves the section's height. CLS stays 0.

**Alternatives.** Keep the photo above the copy on phones so it stays LCP: rejected, the headline has to be the first read and the CTA has to fit in the first 844px. Keep the hero client-side: rejected by PS-008.

**Consequences.** Simulated LCP did not improve (5192 → 5486 ms median) because Lighthouse's simulated paint waits on main-thread JS, and the heavy JS on `/` is layout-level, loaded on every route (see QA §Phase 3 Perf). Those chains are outside the home sections and are the next perf step.

---

## PS-014 — Signage: a static district board replaces the slogan marquee

**Disposition:** decided and implemented (Phase 3).

**Context.** `MarqueeBand.tsx` repeated "Every block has a legend" six times with ✦ separators directly under the H1, cut words at 390, and was `aria-hidden`. The audit (§8, W12) and the art brief (§10 signage logic) call for a destination board.

**Decision.** `SignageBoard.tsx`: a signage-black band with an `h2` ("Four districts") and a list of four stops in route order, Harlem → Midtown → Downtown → Mega City. Each stop is the district name at `display-board` with one real cross street under it (`DISTRICT_COPY[d].streets`, the corners of the bundled photographs) and a disc in the district tone sitting on one silver route line. Vertical on phones, one row from `lg`. Static; server-rendered; readable by screen readers. The kit's `SignagePlate` (single line, truncates, `role="text"`) and `SignageBand` (console alert with a live region) don't fit a four-stop list, so the board composes the same tokens (`signage-black`, `signage-white`) instead.

**Alternatives.** A slow ticker: rejected, a moving band of place names reads as a crypto ticker and adds a motion owner with no purpose. Keeping the marquee static: rejected, it repeats the H1.

**Consequences.** The slogan is now defined once (`HOME_COPY.tagline`) and printed by the H1 and the seal artwork only.

---

## PS-015 — WORLD is the first bento: one dominant photograph, three modules

**Disposition:** decided and implemented (Phase 3).

**Context.** WorldSection had four equal-weight landmark photos with numbered 01–04 captions under a binary-contrast headline. ARCHITECTURE §4 allows a bento here: one dominant module, at most four, DOM order equal to mobile order.

**Decision.** 12-column grid from `md`: `world.primary` (Lenox Ave rowhouses) spans 7 columns and both rows; the story tile (h2, two short paragraphs) takes 5 columns in row 1; `world.secondary` (Wall Street) takes 5 columns in row 2. DOM order is photo → story → photo, which is the phone order. Two of three modules are photographs and they cover more than half the area. Captions are signage plates naming the district and cross streets (`PlaceCaption.tsx`). Hard 2px ink frames, no rounding, no numbers. The two image layers drift on desktop within `parallax.mid`/`parallax.near` inside fixed frames.

The optional fourth tile was left out: the brief's candidates were a third photograph or a text proof, and neither carried information the other three don't. `world.detail` stays in the art map, reserved for the Mon-in-district art (PS-007). `world.extra` was removed from the union.

**Consequences.** When creature art lands, `world.detail` becomes the fourth module (a Mon placed on a district street), which the art brief requires of World.

---

## PS-016 — NavBar collapse breakpoint is a prop; the site collapses below `lg`

**Disposition:** decided and implemented (Phase 3), fixed in the kit.

**Context.** At 768 the site header's links ran into the 198px wordmark (audit W9), and the waitlist CTA made the bar longer than "Log in" did. A review also found a keyboard trap: an open phone menu rotated past the breakpoint kept its Tab handler, but the toggle and links were `display: none`, so Tab never moved.

**Decision.** `NavBar` takes `collapseBelow: 'md' | 'lg'` (default `md`, so other callers are unchanged); the site passes `lg`. The focus ring is built from rendered elements only (`visibleRing` in `focus-cycle.ts`, unit-tested), an empty ring leaves Tab alone, and the sheet closes when the collapse breakpoint's media query starts matching. The site wordmark drops from 66 to 40px on a landscape phone (`short:` variant).

**Consequences.** Tablets from 768 to 1023 get the menu button instead of a crowded bar.
