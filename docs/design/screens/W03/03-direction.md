Source baseline: `b4080307965d541069ac2544ae03a818961d32f9` (PR #28). Local-only continuation, 2026-10-13. Home composition and its choreography are outside this slice.

# W03 City: direction

Spatial thesis: a district atlas, led by the Downtown skyline photograph, with Midtown and Harlem supporting it. Mega City remains a full-width, quieter closing district statement. Four modules total; the cast remains a separate semantic list.

Small screens: one column in existing district order (Downtown, Midtown, Harlem, Mega City). From `md`, 12 CSS grid columns: Downtown spans seven columns and two rows; Midtown and Harlem each occupy five columns. Mega City spans the final row. No DOM reordering, masonry measurement or new layout package.

Motion thesis: the three photographic crops settle into their atlas frames in one short authored sequence; copy and controls stay stationary and readable. It runs once when the district group enters view, with one Kinetrell/GSAP-owned timeline. No parallax, pinning, smooth-scroll replacement or continuous page loop. Reduced motion has the final still composition. StreetPulse keeps its existing independent canvas/pause ownership.
