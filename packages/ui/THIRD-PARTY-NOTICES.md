# Third-party notices

## NeonBlade UI

Several components in this package are ports of, or started from, components
in NeonBlade UI by NeuronRush: https://github.com/vprix21/neonblade-ui

Ported so far:

- `backgrounds/GridFloor`, `GridScene`, `GlyphCity`: prop APIs follow NeonBlade's
  Grid Floor, Grid Scene and Glyph City.
- `backgrounds/CityBlocks`: began as the port of NeonBlade's Hexagons background
  (`packages/registry/components/hexagons`) and was redrawn as a solid NYC
  city-block tiling. It keeps Hexagons' `hoverEffect`, `hoverColor` and
  `overlay` props.
- `neon/`: the colour presets (cyan, pink, green, white, orange, purple, red,
  yellow), the corner-cut geometry (`ccb-clip-*`), the xs to xl size scale and
  the glow intensity presets follow NeonBlade's corner-cut button.
- `charts/`: NeonLineChart, NeonSparkline, NeonBarChart, NeonDonutChart and
  StatCard keep the prop names of NeonBlade's neon-line-chart, neon-sparkline,
  neon-bar-chart, neon-donut-chart and stat-card (data, series, dataKey,
  xAxisKey, area, grid, legend, glowIntensity, barGap, multiColor,
  paddingAngle, cornerRadius, centerLabel, trend, change, sparkData...).
- `DataTable` `variant="neon"`: NeonBlade's neon-table (title, striped,
  compact, grid, corners, pageSize, emptyText, loading, rowHover).
- `Text` `variant="glitch" | "neonGlow" | "outline" | "blur"`: NeonBlade's
  glitch-text, neon-glow, outline-text and blur-text (mode, colorA, colorB,
  intensity, speed, colors, glowColor, glowIntensity, animate, strokeColor,
  fillColor, strokeWidth, hoverStrokeColor, hoverFillColor).
- `nav/NavBar`, `nav/SiteFooter`: NeonBlade's navbar and footer (items with
  dropdown children, position, transparency, navAlign; footer variants
  minimal, columns, centered, mega, linkGroups, socialLinks, newsletter).
- `cursors/`: `PointerCursor` covers NeonBlade's fox-cursor (redrawn as an
  arrow, no fox) and `Crosshair` covers its crosshair (redrawn as a
  rounded-square reticle); both keep hideNativeCursor, disabled,
  containerRef and glowIntensity.

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
