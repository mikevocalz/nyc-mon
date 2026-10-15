Source baseline: `b4080307965d541069ac2544ae03a818961d32f9` (PR #28). Local-only continuation, 2026-10-13. Home composition and its choreography are outside this slice.

# W03 City: research

The published [City page](https://mikevocalz.github.io/nyc-mon/city/) has four equal text panels, then StreetPulse and a three-item cast section. Its existing content is complete; the user requested finishing non-home Kinetrell motion and selective Bento upgrades while preserving home.

The task is a marketing setting page, not native world rendering, a map, or a geographical dataset. Reuse `@acme/ui`, `@acme/assets/photos`, existing `DISTRICTS` / `DISTRICT_COPY` and `W03_COPY`. No canon or art generation.

The [premium architecture](https://github.com/mikevocalz/nyc-mon/blob/b4080307965d541069ac2544ae03a818961d32f9/docs/design/site/PREMIUM_SITE_ARCHITECTURE.md) is W01-specific. This folder establishes a separate, bounded W03 contract rather than claiming that home approval covered every screen. Installed Kinetrell 0.1.0-alpha.1 adapters are the API authority.

## Jobs, risks and research questions

Job: understand the four existing districts and who shares their streets, then use the existing navigation to learn about the Mons. Risks: mistaking the marketing atlas for a playable map; mapping fictional Mega City to a new location; motion delaying reading or fighting native scroll.

Three usability questions for a later human session (not yet tested):
1. Can a visitor name the four districts and distinguish the setting page from a playable map?
2. At phone width, is the district sequence and transition into the cast clear?
3. Can a reduced-motion or keyboard visitor reach the same content and pause the existing StreetPulse without delay?
