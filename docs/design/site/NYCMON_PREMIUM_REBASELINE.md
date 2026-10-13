# NYC-MON premium site: re-baseline (WEB-01)

Written 2026-10-12 against `main` at **b584018** (`Merge pull request #23`). This is the first deliverable of the premium-site superprompt. It re-checks the 2026-10-07 audit (`PREMIUM_SITE_AUDIT.md`, written at 3f7ccfb) against the code and a real production build, so later work doesn't redo what is already fixed.

## What this proof is and isn't

- **Local build proof only.** `apps/web` was built with `next build` (Next.js 16.3.8, Turbopack) on Node 24.21.0 and served with `next start -p 3100` in a cloud container. No production deployment was opened: the repo records no production URL and none was reachable from here. Nothing below is a production or field measurement.
- **Install workaround (local only, not committed).** `pnpm install` fails here with HTTP 403 for the pinned `kinetrell` tarball on codeload.github.com. The pinned commit `344de51` of `mikevocalz/Kinetrell` was cloned via git, built with `tsdown`, packed, and swapped into the catalog for the install only. `pnpm-workspace.yaml` and `pnpm-lock.yaml` were restored afterwards. CI is unaffected.
- **Browser.** The preinstalled Chromium 141 headless (`/opt/pw-browsers/chromium-1194`), run through the repo's own `tooling/site-qa` scripts with `SITE_QA_BROWSER=system`. Headless here has no WebGPU, so GPU scenes drew their fallbacks.
- **Theme.** The container clock was 23:48 UTC. The layout has no clock-based theme switch (`app/Document.tsx` reads only an `app-theme` cookie), so the captures show the default theme.

## Open PRs checked for overlap

13 open PRs (#12–#20, #24–#27). They cover Alexa+, Quest/XR presence, native gameplay planning, kit issues and foldable-skill docs. **None touches `apps/web` marketing routes**, so this work doesn't duplicate an open premium-site stack. The earlier premium-site work (`feat/premium-home-redesign`) is already on `main`.

## Automated results on b584018 (lab, local)

| Check | Command | Result |
|---|---|---|
| Screenshots, 9 viewports × 2 motion modes | `site-qa:shots` | 168 captures. **Horizontal overflow 0 px** and **console errors 0** at 390, 430, 768, 884, 1024, 1280, 1440, 1728 and 844×390, in both normal and reduced motion |
| axe-core 4.11, WCAG 2.0–2.2 A/AA, all 9 sections | `site-qa:axe` at 390 / 768 / 1280 × 2 motion modes | **0 violations** |
| Banned-word copy lint on `/` and `/get` | `site-qa:copy-lint` | clean |
| Back navigation and motion re-mount | `site-qa:backnav` | 12/12 pass |
| Frame loops | `site-qa:motion` | pass. 1 RAF owner (GSAP ticker) plus ScrollTrigger keep-alive, and 0 owners under reduced motion. One hero canvas is active only during the 4.5 s settle on mobile. 1 page error was recorded in the normal-motion runs (detail in `tooling/site-qa/out/motion/motion.json`, not yet triaged) |
| Secondary routes, 390 and 1440 | `scratchpad/routes.mjs` (Playwright) | All 200, 0 px overflow, 0 console errors. Unknown route → 404 with `noindex` |
| Lighthouse, 5-run median | `site-qa:lhci` | see "Lighthouse" below |

Captures are under `docs/design/site/rebaseline-2026-10-12/before/` (home sections plus `routes/`). The full 168-shot set is in the git-ignored `tooling/site-qa/out/shots/` and can be regenerated with the commands above.

## What changed since the 2026-10-07 audit

Each item was checked against the current code. Full citations are in the integrator's lane notes; the main file is given here.

| Audit item | Status at b584018 | Evidence |
|---|---|---|
| W1 waitlist stored nothing | **Fixed** | `get/actions.ts` → `lib/waitlist.ts` → `POST /v1/waitlist` (admin-vite → Payload `Waitlist`). The form says "joined" only on HTTP 200 with `status:'joined'` |
| W2 blue H-Lynk | **Fixed** | `device-scene.ts` uses the `hlynk.core` red tokens. The capture is red |
| W3 no creature on the page | **Partly fixed** | Starters and the hatch show creature art. **The hero and World still have no Mon** |
| W5 one split template everywhere | Fixed | Bento (H-Lynk), triptych (Starters), full-width window (Hatch) |
| W6–W9 eyebrow, white box, `bg-orange`, tabs clipping | Fixed | See the lane notes |
| W10 Care reads like a dashboard | Partly | The meters are labelled "Example levels, not a live reading" and the SR label is "example level". The `care` art slot is still unrendered |
| W11 World section without Mons | **Still present** | `art.ts` world slots are landmark photos |
| W12 slogan repeated / marquee | Mostly fixed | `SignageBoard` replaced the marquee |
| "Log in" header CTA | Fixed | `nav.ts` header CTA is "Join the waitlist" |
| Second RAF clock | Fixed | `site-qa:motion` shows one owner |
| One live canvas at a time (PS-010) | **Regressed in code** | `GridBand` is a continuously drawn canvas and is undocumented. It wasn't caught drawing in the motion run's sampled windows, so this needs a targeted trace |
| LCP < 2.5 s | Re-measured below | |

## Verified defects and opportunities

Priority: **P0** blocks a premium launch or breaks a project law. **P1** is a major quality or trust gap. **P2** is polish.

| Page | Current state | Verified defect or opportunity | Source | Owner (lane) | Priority | Acceptance test |
|---|---|---|---|---|---|---|
| `/` hero | Night-navy isometric city canvas behind the headline, then a Chrysler photo and the seal | **Night palette in the default hero.** Canon makes daylit the default and keeps night for the hatch (Decision #4, D8, PS-024) | `before/1440-no-preference-hero.jpg`; `HeroDistrictIsland.tsx` `CityBlocks` | webgpu-stage-director | P0 | Hero reads as daylight at 390 and 1440 in WebGPU, the fallback and no-JS; text contrast stays AA; axe is clean |
| `/` hero | Headline, egg line, CTA, district picker | **No Mon or H-Lynk above the fold.** The visitor has to read to learn it's a creature game | same capture; `art.ts` hero slot | creative-director + headline director | P0 (needs creator approval) | Three hero directions in an internal review, with the creator's choice recorded. Until then the public headline stays as it is |
| all routes | Only `title`/`description` metadata | **No `metadataBase`, Open Graph, Twitter card, canonical, robots or sitemap.** Shared links have no preview | `app/layout.tsx` | site-rsc-architect | P1 | `/robots.txt` and `/sitemap.xml` return 200 with only marketing routes; OG image renders; each page has a canonical |
| `/profile`, `/settings`, `/schedule`, `/notifications`, `/explore` | Template app screens with demo data, for example "Nina Alvarez", "1.2k Followers", "24 Projects" | **Fake data on public, indexable URLs.** The brief forbids invented people and counts | `before/routes/1440_profile.jpg` | site-rsc-architect + content-and-proof-editor | **P0** | In production these routes return 404 (or a truthful "in the app" state), are `noindex`, and are absent from the sitemap |
| `/sign-in` | M03 sign-in with a brand panel. Two `<h1>` ("Get NYC-MON" and "Make your account") | Two H1s. Strings are JSX literals, not copy tables. The site has no working auth to offer | route capture | site-rsc-architect | P1 | One H1, and honest copy about where accounts live |
| `/get` and `/` waitlist | One "I'm 13 or older" checkbox. With JS on, an unticked box shows "Check the box to confirm you're 13 or older." | **Not a neutral age screen.** The error tells a child which answer gets them in, and the server's `under13` path is reachable only with JS off | `WaitlistForm.tsx`, `waitlist/copy.ts` | privacy-and-auth-reviewer | **P0 (COPPA)** | The age question gives no hint of the passing answer. Under 13 → 422, nothing stored, kind non-coaching copy, no instant retry. Unit tests cover it. Legal review is recorded as required |
| `/` starters | "Mons are people in this city. They think, they choose and they can say no." | **Possible canon tension.** Decision #14: a Mon "never rejects the Caller". The same line is approved app copy (M02 `m02.p3.body.a`), so this is not changed unilaterally | `components/home/copy.ts:84` | canon-guardian → **creator** | P1 | `TODO(canon)`: the creator confirms "can say no" covers choices in general, not rejecting the Caller, or supplies new copy |
| `/` World | Harlem rowhouses and NYSE photos | No Mon in the world it describes (W11) | `before/1440-no-preference-world.jpg` | image-asset-curator | P1 (asset-blocked) | An approved Mon-in-NYC asset per slot, or the slot kept as photo with an asset-blocker record |
| `/` H-Lynk | Red Core capture and 3D stage | Correct colour. There is no GLB; the stage is procedural (`device-scene.ts`) | `before/1440-no-preference-hlynk.jpg` | webgpu-stage-director | P2 (asset-blocked) | When the GLB lands, it replaces the procedural model at the same slot |
| `/` care | Feed / Rest / Play with example meters | Truthful, labelled as examples. The `care` art slot isn't used | `before/1440-no-preference-care.jpg` | creative-director | P2 | Keep the example label; add a Mon reaction asset when approved |
| `/` (proof) | No social-proof section | **Correctly** none: no verified quotes, press, player counts or hackathon results exist (canon-guardian sweep). There is room for a factual "proof of craft" section | canon-guardian report | content-and-proof-editor | P2 | A proof section built only from real repo artifacts, each labelled concept, prototype or render |
| `/` GridBand | Full-height animated grid floor with a pause button | Undocumented second animated canvas (PS-010) | `GridBand.tsx` | kinetrell-motion-director | P2 | It settles to a still frame like the hero, or is removed by decision; `site-qa:motion` still passes |
| `/story` | H1 "We killed them." on a daylit page | Strong, on-canon lore opener. No art yet | `before/routes/1440_story.jpg` | creative-director | P2 | — |
| `components/site/WebVitals.tsx` | Never mounted | Dead code that the site-qa README describes as live | site-rsc-architect | docs-cleanup-maintainer | P2 | Mounted and reporting, or deleted with the README fixed |

## Lighthouse

The 5-run median comes from `site-qa:lhci` against the local build. It's in the "Lighthouse (lab)" table appended below. These are **lab** numbers from a shared, CPU-contended cloud container, not field data. The 2026-10-07 audit measured a mobile Performance of 76 and LCP of 5.2 s, and Phase 7 later recorded an LCP of 3540 ms.

## Skills and lanes used for this baseline

| Lane / skill | How it was used | Status |
|---|---|---|
| canon-guardian (subagent) | Read canon, copy deck and content packages; produced the citations above | Done |
| site-rsc-architect (subagent) | Route inventory, waitlist trace, re-check of each audit defect | Done |
| browser-e2e-qa (subagent, then integrator) | The subagent was blocked by the kinetrell 403. The integrator finished the install and ran every `site-qa` script | Done (local lab) |
| mobbin-ux-researcher (subagent) with Mobbin MCP `search_sections` | 10 searches, 14 new cards; see `research/MOBBIN_2026-10_ADDENDUM.md` | Done. The Lightship `a5fa6838` section was not found |
| `NYC_MON_MANDATORY_SKILL_PACK.md` | Named by the superprompt | **Not available**: it wasn't supplied with the prompt and isn't in the repo |
| Appllama, MotionSites.ai, CodeRabbit, Argent agent-device, expo/mattpocock/margelo skills | Named by the superprompt | **Not installed in this session**. Nothing is claimed for them |
| Real-user 5-second tests | Required by the brief | **Not run**. No participants exist |

### Lighthouse (lab), b584018, 2026-10-12

Settings: `site-qa:lhci`, Lighthouse 13.5.0, mobile simulate (RTT 150 ms, 1.6 Mbps, CPU ×4), headless Chromium 141 `--no-sandbox`, 4-vCPU Xeon container. Benchmark index 1600–2120. Other agents' dev servers were running at the same time, so CPU was contended.

| Metric | Median of 5 | Target | Result |
|---|---|---|---|
| Performance | 59 | ≥ 90 | **Fail** |
| Accessibility / Best practices / SEO | 100 / 100 / 100 | ≥ 95 | Pass |
| FCP | 1059 ms | — | |
| LCP | 3575 ms (range 2237–3738) | ≤ 2500 | **Fail** |
| CLS | 0 | ≤ 0.05 | Pass |
| TBT | 17 142 ms | — | Very high |
| INP | not measured (navigation mode) | ≤ 200 ms field | Unverified |

**LCP element is the hero body paragraph `#mfx-hero-body`**, with an inline `transform` from the motion reveal. TTFB is 14 ms and render delay in the observed trace is 150 ms. Under simulated throttling the paragraph's paint is held back behind main-thread work. TBT this large in a headless container with no GPU points at software-rendered canvas work (the WebGPU → CanvasKit fallback) plus JS boot. That is a hypothesis to profile, not a finding. Next step for web-performance-profiler: trace with the hero canvas disabled to isolate its share, and keep the LCP text out of any entrance animation.

## Creator decision, 2026-10-13: keep the current home page

Mike reviewed the three hero directions (A canon-first, B companion-first, C city-first) and chose none of them: **"leave the old home page."** The home page stays exactly as it is on `main` at b584018. That covers the night hero city, the section order without a proof section, and the hero entrance motion. The work below was built, then removed from this branch:

- the internal `/review/hero` route with directions A, B and C;
- the daylit `CityBlocks` hero and header skyline;
- the "Inside NYC-MON" proof-of-craft section;
- the hero LCP motion change (PS-035) and the grid band settle (PS-036).

Creator direction outranks canon in the authority order. So the P0 rows above for the **night hero** and for **no Mon above the fold** are closed as **won't change (creator decision)**, not left open. Changes off the home page stay on this branch: the neutral waitlist age screen, the production 404 for template screens and `/sign-in`, and SEO metadata. The lab findings still stand if the home page is revisited: about 99% of TBT comes from the hero city's CanvasKit fallback, and LCP is held back by script chunks.
