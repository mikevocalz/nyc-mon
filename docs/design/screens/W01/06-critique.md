# W01 Home: critique

Skill: `design:design-critique`. Scored against §0C (Awwwards: Design 40, Usability 30, Creativity 20, Content 10) on the plan in 03–05, before build. Re-scored after build in `10-verification.md` terms at the end of this file.

## Current page (before)

| Row | Score | Why |
|---|---|---|
| Design | 4 | One night slab over a night city; heading orange on ink; the runtime card and four repeated district cards add noise |
| Usability | 4 | No header or footer on `/`; the only CTA opens a 3D view; nothing says what the app is |
| Creativity | 6 | The district city and the seal are strong and specific to New York |
| Content | 3 | No starters, no care loop, no hatch; copy promises headsets |

## Plan (03–05)

| Row | Score | Notes |
|---|---|---|
| Design | 8 | Daylit plate over the city keeps the seal and city, fixes the balance; one dark band |
| Usability | 8 | Shared nav and footer, one CTA, starters named above the fold |
| Creativity | 8 | Seal over the live district, then the red H-Lynk turning in its own band |
| Content | 8 | All copy traced to canon or decisions |

## Blockers (must clear before build)

1. **CTA target.** `/get` (W05) does not exist yet. Cleared by building the link now and flagging it; W05 belongs to the site-pages agent. Until it ships, the CTA lands on the site's 404.
2. **"device" in the figure label.** §5 fixes `aria-label="H-Lynk device"`; Law 9 bars "device" in UI copy. Kept as the spec says, flagged for Mike. Visible copy never says "device".
3. **Header and footer hidden on `/`.** `apps/web/components/site/nav.ts` `showsSiteChrome` excludes `/`. W01 needs both (§5). Changing that one line is required.

## Non-blocking

- The 3D H-Lynk is a placeholder at Decision #16's proportions until the real model lands (`model="h-lynk-entry"`).
- Meters show example levels; marked as such on the page.
