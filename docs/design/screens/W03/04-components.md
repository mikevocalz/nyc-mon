Source baseline: `b4080307965d541069ac2544ae03a818961d32f9` (PR #28). Local-only continuation, 2026-10-13. Home composition and its choreography are outside this slice.

# W03 City: components

Reuse `Image`, `SolidPanel`, semantic `Section`, `List`, `ListItem`, `Article`, `Heading`, `Paragraph`, `Figure` and `Figcaption` from the existing kit. Use existing theme type/space/color/motion tokens; add no design-system primitives or dependencies.

Files owned by this slice: `components/city/CityPage.tsx`, a city art mapping with pure metadata contract, and city-only lazy motion/controller modules and tests. Route source remains a server component; only the invisible motion binder is a client island.

Keep `StreetGridBand.tsx`, home components/motion/styles, shared GPU renderers, waitlist form, native app and canon unchanged. Separate Pages URL repairs have their own tests and must be reported separately.
