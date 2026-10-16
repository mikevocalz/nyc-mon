# Arcade ergonomics: Sega Astro City and Taito Vewlix, and the touch arc for G01

Owner: Lane A, Master Directive v2 §2B and §12 ("research real arcade spacing and geometry separately"). Written 2026-10-15. The physical numbers below come from the sources named with each one; the dp geometry at the end is this lane's design, derived from them and chosen for a thumb on glass. The Rive lane (B) and the layout lane (D) build from the dp table, not from the millimetre tables.

## 1. Button hardware

The cabinet standard is the Sanwa 30 mm snap-in button, OBSF-30.

| Figure | Value | Source |
|---|---|---|
| Mounting hole | φ30 ± 0.1 mm | Sanwa Denshi shop, product OBSF-30: "取付穴寸法：φ30±0.1" https://www.sanwa-d.shop/shopdetail/000000000109/ |
| Panel thickness | 3.9 mm max (Sanwa shop); 3.7 mm max on the TOPS reseller page, a discrepancy left as found | same; https://www.tops-game.jp/products/detail.php?product_id=2634 |
| Overall (rim) diameter | 33 mm | Arcooda product page: "Overall diameter: 33mm" https://www.arcooda.com/buy/Sanwa-Push-Button-OBSF-30-White-20076 |
| Screw-in rims and nuts | tops 33–34 mm, nuts 35–36 mm, so holes need 10–12 mm of panel between them | slagcoin layout page https://www.slagcoin.com/joystick/layout.html |
| Switch | SW-68, operating force 55 g, operating position 0.85 mm, total travel 2.53 mm | Paradise Arcade Shop https://paradisearcadeshop.com/products/sanwa-obsf-30-snap-in-button-red |

The 2.5 mm travel at 55 g is the feel the pressed animation imitates: short, with a definite bottom.

## 2. Spacing conventions

| Figure | Value | Source |
|---|---|---|
| Minimum centre-to-centre, 30 mm screw-ins | 35–36 mm | slagcoin: "the minimum distance between centers is 35mm-36mm" |
| Common standard pitch | 36–36.5 mm | slagcoin: "About 36mm-36.5mm is a common standard spacing between 30mm button centers" |
| Row spacing | 36 mm standard, 39 mm spaced | slagcoin: "About 36mm or 39mm is a common standard spacing between button rows"; JasensCustoms README "Standard rows sit 36 mm apart, spaced rows 39 mm" https://github.com/JasensCustoms/FightStickLayoutProject |
| Stick to first button column | 59, 63 or 95 mm horizontal | slagcoin: "A horizontal distance of about 5.9, 6.3, or 9.5 centimeters between the middle of the joystick and the middle of the leftmost button are common standards" |
| Panel slant | about 10° clockwise, by preference | slagcoin: "Many players prefer a layout slanted a bit clockwise (usually about 10 degrees)" |
| Community restatement | 35–36 mm pitch, 8–10 mm between hole edges | Himura Games https://himuragames.com/30mm-vs-24mm-buttons/ |

## 3. Sega Astro City (player 1) hole centres

slagcoin's page describes its Sega P1 diagram as "a precise diagram of the Sega layout used in Astro City, Blast City (the bottom middle-finger button is .5mm more to the right, and the joystick is in the higher position), Net City, and Versus City cabinets for player 1 or single player." The page gives no coordinate table; the numbers below are from the JasensCustoms trace of that diagram (`svg/sega1_s.svg`, "1 SVG user unit = 1 mm. Origin = joystick shaft centre", every hole r = 15 mm). Treat them as ±0.5 mm: they are a trace of a 72 PPI drawing, not a factory print. x is right of the stick centre, y is positive toward the player.

| Column | Top row (mm) | Bottom row (mm) |
|---|---|---|
| index | (66.0, −24.5) | (59.0, +14.0) |
| middle | (99.0, −38.5) | (92.0, 0.0) |
| ring | (134.5, −32.5) | (128.0, +6.0) |
| pinky (8-button only) | (168.5, −17.5) | (162.0, +21.0) |

Derived from those centres:

- Along a row the pitch is 35.85 / 36.00 / 37.16 mm (top) and 35.85 / 36.50 / 37.16 mm (bottom).
- The arc, both rows: index to middle rises 14 mm, middle to ring falls 6 mm, ring to pinky falls 15 mm. The middle finger's column is the crest.
- Each top button sits 7.0 mm (index, middle) or 6.5 mm (ring, pinky) left of its bottom partner and 38.5 mm above it: the bottom row is shifted right, and the row pitch is 39 mm.
- The stick centre is level with the bottom-row middle button; the stick is 59 mm from the first column (60.6 mm straight-line to the bottom index button, 70.4 mm to the top one).

Sega's player-2 layout (`sega2_s.svg`) is "very close to a non-slanted version of the player 1" (slagcoin): columns vertical, rows exactly 39 mm apart, pitch 36.0–36.6 mm, stick at 63 mm.

## 4. Taito Vewlix hole centres

slagcoin: "This layout takes the arcade layout and shifts the top row a bit to the right. This is the precise layout used in Taito Vewlix cabinets. Note that the bottom index and middle finger buttons are closer than 36mm to one another." JasensCustoms `svg/vewlix_s.svg` (same caveats):

| Column | Top row (mm) | Bottom row (mm) |
|---|---|---|
| index | (66.0, −10.0) | (59.0, +28.0) |
| middle | (99.0, −24.0) | (92.0, +15.0) |
| ring | (135.0, −24.0) | (128.0, +15.0) |
| pinky | (171.0, −24.0) | (164.0, +15.0) (8-button variant) |

Derived: after the index column each row is flat (36.0 mm pitch, no rise or fall); only the index button drops, 14 mm on top and 13 mm on the bottom. The top row sits 7 mm right of the bottom row and 39 mm above it. The tightest pair is bottom index to bottom middle at 35.47 mm, which is why slagcoin warns about screw-in nuts there. Vewlix is flatter than Astro City; "wider" is not supported by the numbers (171 mm versus 168.5 mm to the pinky column).

No Sega or Taito factory drawing was found online. FrancoB's measured DXF set on arcade-projects.com (https://www.arcade-projects.com/threads/arcade-parts-projects-cad-file-repository-added-vewlix-1l7b-cp.3684/) exists and was not downloaded; nothing here rests on it.

## 5. Thumbs on glass

Steven Hoober, "How Do Users Really Hold Mobile Devices?", UXmatters, 18 Feb 2013 (https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php): 1,333 observations, 780 touching the screen; one-handed 49%, cradled 36%, two-handed 15%; of one-handed use, right thumb 67%, left thumb 33%. The article's reach drawings are not used here: in a 2017 comment on the same page Hoober retracted them ("Please, please everyone ignore those drawings"), and his 2017 follow-up (https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php) gives target sizes instead: about 7 mm at the screen centre, about 12 mm at the corners. Bergstrom-Lehtovirta and Oulasvirta, "Modeling the Functional Area of the Thumb on Mobile Touchscreen Surfaces", CHI 2014, DOI 10.1145/2556288.2557354, model the reachable area as a function of surface size, hand size and grip; it gives no single reach figure, and hand size varies, so none is claimed here.

What follows from that for G01: a right-thumb cluster and a left-thumb stick by default; `handedness` mirrors them; `scale` and position are settings, because no fixed geometry fits every hand; and the 33% left-thumb figure is why the mirror is a first-class preset, not an afterthought.

## 6. A touch surface does not keep physical spacing

A cabinet spaces 30 mm buttons 36 mm apart because rims and nuts need panel between them and because four fingers rest on a horizontal plate. On glass none of that holds: there is no rim, the controls are under one thumb, and the screen is 70–90 mm wide in landscape, so a 36 mm pitch would put three buttons across the whole phone. The cluster below keeps three things from the cabinet, the two staggered rows, the subtle rise-and-fall arc with the middle column as the crest, and the right-shifted bottom row, and drops the millimetres. The arc's job on a phone is recognisability and row separation (a staggered row never shares a column with the row above, so a tap that lands between caps is nearer one than the other); equal reach comes from the cluster's position inside the thumb zone and from the scale setting, not from the arc.

## 7. The G01 cluster at reference scale 1.0 (dp)

Rules it meets: every cap is at least 44 pt (`layout.minTargetIosPt`) at the smallest permitted `scale` (0.8 × 56 = 44.8 dp) and 48 dp (`layout.minTargetAndroidDp`) at 1.0; a cap is round (the repo's "physically round" exception); adjacent caps are 8 dp apart edge to edge so WCAG 2.5.8 holds even at 0.8.

Origin: the cluster's bounding box top-left, x right, y down (layout coordinates). Cap diameter 56. Pitch along a row 64 (8 dp gap). Row pitch 62. Bottom row shifted 8 dp right. Arc: index column 0, middle column +10 dp (crest), ring column +4 dp, measured as a rise from the index column's centre, so y decreases toward the crest.

| Button | Row | Centre (x, y) | Cabinet analogue |
|---|---|---|---|
| X | top, index | (28, 38) | Sega top index |
| Y | top, middle | (92, 28) | Sega top middle, the crest |
| Z | top, ring | (156, 34) | Sega top ring |
| A | bottom, index | (36, 100) | Sega bottom index |
| B | bottom, middle | (100, 90) | Sega bottom middle |
| C | bottom, ring | (164, 96) | Sega bottom ring |

Bounding box 192 × 128 dp. Edge-to-edge minimums: 8 dp along a row; the closest cross-row pair is Y to B (same column, 62 dp centre-to-centre, 6 dp gap) and X to B (diagonal, 94.0 dp). The arc ratios against Sega P1: rise index→middle 10 dp versus 14 mm, fall middle→ring 4 dp versus 6 mm (both about 70% of the cabinet's proportion once 36 mm is taken as 64 dp), bottom-row shift 8 dp versus 7 mm, row pitch 62 dp versus 39 mm (compressed on purpose: a thumb spans rows more easily than four fingers do).

Left-handed mirror: `x' = 192 − x`, so X becomes (164, 38), Y (100, 28), Z (36, 34), A (156, 100), B (92, 90), C (28, 96). Labels stay on the same buttons; only positions mirror.

Scale `s` (0.8…1.4, `ControllerProfile.scale`): multiply every centre and the diameter by `s`. At 1.4 the box is 268.8 × 179.2 dp, which is why tablets and landscape get the larger default (`08-handoff.md` § Layout).

## 8. The stick and the pill at reference scale 1.0 (dp)

- Stick housing: round, 128 dp diameter; the recessed well is 112; the thumbpad 56. Full deflection at 56 dp of finger travel from the pad's rest centre (`DEFAULT_CONTROLLER_PROFILE.stick.clampRadiusDp = 56`); the radial dead zone is 0.15 of that, 8.4 dp. The pad may travel past the well's edge visually by up to 8 dp so a full push reads as a full push. In D-pad mode eight indicators sit on a 96 dp circle at 45° steps; the four cardinals are the lit set by default, the diagonals light when `stick/mode` is `dpad` and the reading is diagonal.
- Stick to cluster: in phone landscape the stick's centre and the cluster's bottom-row index button (A) sit on the same baseline, as Sega's stick is level with its bottom middle button. The horizontal distance is whatever the window leaves after each group takes its grip zone; it is never fixed, because the stick and the cluster anchor to opposite edges.
- Pill: 120 × 44 dp, corner-cut (`CornerCutFrame corner="all" cut={8}`), top-centre of the controller region, 16 dp below the safe top inset in portrait and 12 dp in landscape. It is the one corner-cut shape on the overlay; the stick and the caps are round because the real parts are.

## 9. What the Rive lane needs from this file

Six circle centres and one diameter (§7), the mirror rule, the stick radii (§8), and the rule that the artboard's pixel size at 1.0 is the dp table times the device scale. Nothing else in this document is an artboard dimension.
