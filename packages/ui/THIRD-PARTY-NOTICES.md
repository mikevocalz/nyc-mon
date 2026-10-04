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
- `backgrounds/CityHeightfield`: port of NeonBlade's Holographic Terrain
  (`holographic-terrain`).
- `backgrounds/RiverTide`: port of NeonBlade's Neon Tide (`neon-tide`).
- `backgrounds/RainWindow`: port of NeonBlade's Pluviophile (`pluviophile`).
- `backgrounds/CityBlocks`: began as the port of NeonBlade's Hexagons background
  (`packages/registry/components/hexagons`) and was redrawn as a solid NYC
  city-block tiling. It keeps Hexagons' `hoverEffect`, `hoverColor` and
  `overlay` props.
- `neon/`: the colour presets (cyan, pink, green, white, orange, purple, red,
  yellow), the corner-cut geometry (`ccb-clip-*`), the xs to xl size scale and
  the glow intensity presets follow NeonBlade's corner-cut button.

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
