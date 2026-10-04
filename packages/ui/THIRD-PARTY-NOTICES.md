# Third-party notices

## NeonBlade UI

Several components in this package are ports of, or started from, components
in NeonBlade UI by NeuronRush: https://github.com/vprix21/neonblade-ui

Ported so far:

- `backgrounds/GridFloor`, `GridScene`: prop APIs follow NeonBlade's Grid Floor
  and Grid Scene; both are now drawn as solid street-grid planes.
- `backgrounds/CitySkyline` (also exported as `GlyphCity`): the port of
  NeonBlade's Glyph City (`packages/registry/components/glyph-city`), redrawn
  as solid district skylines. Keeps Glyph City's colour, speed, vehicle and
  light props.
- `backgrounds/SignRain`: port of NeonBlade's ASCII Rain (`ascii-rain`).
- `backgrounds/SubwayLines`: port of NeonBlade's Cyber Circuit (`cyber-circuit`).
- `backgrounds/StreetPulse`: port of NeonBlade's Datalines with Grid
  (`datalines-with-grid`).
- `three/HolographicTerrain` (also exported as `backgrounds/CityHeightfield`):
  port of NeonBlade's Holographic Terrain (`holographic-terrain`), kept a
  three.js scene like the original (WebGPURenderer, FogExp2, a raised
  perspective camera, the pointer raycast onto a horizontal plane) and
  redrawn as solid city blocks. Keeps its prop names. The first, flat port
  stays as `backgrounds/CityHeightfieldFlat`, the fallback.
- `three/NeonTide`: port of NeonBlade's Neon Tide (`neon-tide`), kept a
  three.js scene like the original: the same wave surface, lighting (diffuse,
  fresnel rim, specular), FogExp2, corner shift and tilt, camera and pointer
  bump, reimplemented on WebGPURenderer with the wave as a TypeGPU function.
  Keeps its prop names; the default colours come from the NYC-MON theme.
- `backgrounds/RiverTide`: the first, flat port of Neon Tide, redrawn as the
  river under a district skyline. Also NeonTide's fallback.
- `backgrounds/RainWindow`: port of NeonBlade's Pluviophile (`pluviophile`).
- `backgrounds/CityBlocks`: began as the port of NeonBlade's Hexagons background
  (`packages/registry/components/hexagons`) and was redrawn as a solid NYC
  city-block tiling. It keeps Hexagons' `hoverEffect`, `hoverColor` and
  `overlay` props.
- `neon/`: the colour presets (cyan, pink, green, white, orange, purple, red,
  yellow), the corner-cut geometry (`ccb-clip-*`), the xs to xl size scale and
  the glow intensity presets follow NeonBlade's corner-cut button.
- `elements/AccentFrame`: NeonBlade's Accent Frame (`accent-frame`), redrawn
  with setback and cornice corners. Keeps its colour, corner, hover, mode and
  background props.
- `elements/Timeline`: NeonBlade's Timeline (`timeline`), redrawn as a subway
  line. Keeps its item shape and variant, line, dot, align and animate props.
- `Badge` (`variant="neon"`): NeonBlade's Badge (`badge`). Its solid, outline
  and ghost variants are the `fill` prop; size, shape, dot and glow carry over.
- `Dialog` / `DialogCard` (`variant="neon"`), `ToastCard` and `Toast`
  (`appearance="neon"`), `notify` (`variant: 'neon'`): NeonBlade's Neon Modal
  (`neon-modal`), redrawn as a building facade; keeps its size, animation,
  glow, footer-align, close-button, backdrop, label, dividers, border beam
  (a window marquee), scrollable body, Escape and header props. `notify.modal`
  opens the same facade through the sonner toasters.
- `progress/ProgressBar`, `RainLoader`, `ArrowLoader`, `CircularProgress`,
  `TurbineLoader`: NeonBlade's Progress Bar, Rain Loader, Arrow Loader,
  Circular Progress and Turbine Loader, redrawn as a building skyline, window
  lights, subway chevrons, a segmented token ring and a rooftop water tower
  with a fan. Each keeps the original props that still apply.
- `Button` and `IconButton` `variant="cornerCut"`: port of NeonBlade's
  corner-cut button (`corner-cut-button`).
- `Card` `variant="notch"`, `"cornerCut"` and `"beam"`: ports of NeonBlade's
  notch card, neon glow corner-cut card and border beam corner-cut card. The
  notch geometry in `cards/notch.ts` follows the notch card's clip path, and
  the props keep NeonBlade's names (`notchSides`, `notchSize`, `notchWidth`,
  `notchWidthV`, `notchSkew`, `corner`, `cornerSize`, `duration`).
- `TextField`, `Textarea`, `Select`, `Checkbox` and `Switch` `variant="neon"`:
  ports of NeonBlade's neon input, neon select, neon checkbox and neon toggle.
- `cards/CardSlider`: port of NeonBlade's card slider (`visibleCount`, `gap`,
  `showButtons`, `buttonPosition`, `buttonVisibility`, `prevButtonCorner`,
  `nextButtonCorner`, `enableSwipe`, `swipeThreshold`, `showProgress`,
  `progressStyle`, `loop`, `autoPlay`, `autoPlayInterval`, `showEdgeFades`,
  `edgeFadeColor`, `showCornerAccents`, `cornerAccentStyle`, `scanLines`).
- `charts/`: NeonLineChart, NeonSparkline, NeonBarChart, NeonDonutChart and
  StatCard keep the prop names of NeonBlade's neon-line-chart, neon-sparkline,
  neon-bar-chart, neon-donut-chart and stat-card (data, series, dataKey,
  xAxisKey, area, grid, legend, glowIntensity, barGap, radius, multiColor,
  dots, curve, paddingAngle, cornerRadius, centerLabel, color, tooltip,
  trend, change, sparkData, background...).
- `DataTable` `variant="neon"`: NeonBlade's neon-table (title, striped,
  compact, grid, corners, pageSize, emptyText, loading, rowHover).
- `Text` `variant="glitch" | "neonGlow" | "outline" | "blur"`: NeonBlade's
  glitch-text, neon-glow, outline-text and blur-text (mode, colorA, colorB,
  intensity, speed, colors, glowColor, glowIntensity, animate, strokeColor,
  fillColor, strokeWidth, hoverStrokeColor, hoverFillColor).
- `nav/NavBar`, `nav/SiteFooter`: NeonBlade's navbar and footer (items with
  dropdown children, position, transparency, navAlign; footer variants
  minimal, columns, centered, mega, linkGroups, socialLinks, newsletter).
- `cursors/`: `MouseCursor` covers NeonBlade's fox-cursor, redrawn as an
  animated city mouse that chases the pointer (no fox); `PointerCursor` is
  a separate NYC-MON arrow; `Crosshair` covers its crosshair (redrawn as a
  rounded-square reticle). All keep hideNativeCursor, disabled,
  containerRef and glowIntensity.
- `NeonBlade.stories.tsx` and `neonblade/catalog.ts`: an index of all 41
  NeonBlade components and their ports, with links to the NeonBlade site.

NeonBlade UI is distributed under the MIT License:

```
MIT License

Copyright (c) 2026 NeuronRush

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Port agents: add each newly ported component to the list above.

## react-native-graph

`charts/LinePlot.native.tsx` draws with react-native-graph by Margelo
(https://github.com/margelo/react-native-graph), MIT License, Copyright (c)
2026 Marc Rousavy. It is patched (`patches/react-native-graph@1.4.0.patch`) to
build paths with react-native-skia v3's SkPathBuilder.

## NYC photos (packages/assets/photos)

Ten photos from Wikimedia Commons, bundled as 1200x800 WebP crops (resized, cropped and recompressed; no other changes). Used by the image cards in the card slider. CC0 and public-domain files need no credit; they are listed for provenance.

- `downtown-one-wtc.webp`: "One World Trade Center(Freedom Tower)" by Mkdasher64. CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). Source: https://commons.wikimedia.org/wiki/File:One_World_Trade_Center(Freedom_Tower).jpg
- `downtown-nyse.webp`: "New York Stock Exchange Entrance" by Balon Greyjoy. CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). Source: https://commons.wikimedia.org/wiki/File:New_York_Stock_Exchange_Entrance.jpg
- `midtown-empire-sunset.webp`: "Empire State Building during sunset" by Michael Discenza. CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). Source: https://commons.wikimedia.org/wiki/File:Empire_State_Building_during_sunset.jpg
- `midtown-times-square.webp`: "Sunset at Times Square, New York City (2017)" by Luca Bravo. CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). Source: https://commons.wikimedia.org/wiki/File:Sunset_at_Times_Square,_New_York_City_(2017).jpg
- `midtown-chrysler-spire.webp`: "Chrysler Building spire, Manhattan, by Carol Highsmith (LOC highsm.04444)" by Carol M. Highsmith. Public domain (Library of Congress, Carol M. Highsmith Archive). Source: https://commons.wikimedia.org/wiki/File:Chrysler_Building_spire,_Manhattan,_by_Carol_Highsmith_(LOC_highsm.04444).jpg
- `harlem-apollo.webp`: "Apollo Theater (6279250673)" by Erik Drost. CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/). Source: https://commons.wikimedia.org/wiki/File:Apollo_Theater_(6279250673).jpg
- `harlem-brownstone-stoops.webp`: "Harlem, New York brownstones" by Paul Lowry. CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Source: https://commons.wikimedia.org/wiki/File:Harlem,_New_York_brownstones.jpg
- `harlem-lenox-rowhouses.webp`: "Lenox 123 rowhouses jeh" by Jim.henderson. CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). Source: https://commons.wikimedia.org/wiki/File:Lenox_123_rowhouses_jeh.jpg
- `megacity-brooklyn-bridge-night.webp`: "Brooklyn Bridge at night" by Kai Pilger. CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). Source: https://commons.wikimedia.org/wiki/File:Brooklyn_Bridge_at_night.jpg
- `megacity-bridge-deck.webp`: "Brooklyn Bridge, New York" by Pierre Blaché. CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). Source: https://commons.wikimedia.org/wiki/File:Brooklyn_Bridge,_New_York.jpg
