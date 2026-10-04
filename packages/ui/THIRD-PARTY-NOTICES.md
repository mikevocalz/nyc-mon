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
