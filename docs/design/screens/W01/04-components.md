# W01 Home: components

Skill: `design:design-system`. Kit inventory: `docs/REPO_MAP.md` §5, `packages/ui/index.ts`.

| Part | Component | Notes |
|---|---|---|
| Landmarks | `Main`, `Section`, `Heading`, `List`, `ListItem`, `Figure`, `Figcaption`, `Paragraph` from `@acme/ui/html` | One h1; h2 per section; `section aria-labelledby` |
| Hero background | `SceneSection` + `CityBlocks` (`paused` forwarded) | The page's one strong background (per the backgrounds agent) |
| Hero plate | `SolidPanel` | Daylit plate: page tone in light, ink in dark |
| Seal | `BrandLogo` | The repo's file, unedited |
| District selector | `SegmentedControl` | Bound to `useDistrictStore` from `@acme/spatial` |
| Primary CTA | **NEW `LinkButton`** with `variant="cta"` | `Button variant="cta"` renders a `<button>`; a CTA that navigates has to be an `<a>`. `LinkButton` draws the same corner-cut face inside a link. Story first: `packages/ui/LinkButton.stories.tsx` |
| Section dividers | `SkylineDivider` | District follows the selector; seeds differ |
| H-Lynk | `apps/web/components/DeviceStage.tsx` on the kit's `ThreeCanvas` | Path and `model` prop fixed by §5. Scene module loads on demand |
| Starter cards | `Card` + `Badge` | Data from `@acme/content` (`eggs`, `starterBloodlines`, `bloodlineLabel`) |
| Care meters | `ProgressBar` | Illustrative values, labelled as an example |
| Hatch band | `Section` with `scheme-dark` | Night tokens resolve inside it |
| Header, footer | `SiteNavBar`, `SiteFooterBar` (shared) | `nav.ts` stops hiding them on `/` |

## Token diffs

None. Every colour comes from `packages/theme`. DeviceStage reads `hlynk.core` and `brand` from `@acme/theme` for its materials.

## Data

`apps/web` adds `@acme/content` as a workspace dependency (link only; no install run).
