# NYC-Tron

NYC-Tron is the UI kit NYC-MON is built on. It lives in `packages/ui` and is
published inside the monorepo as `@acme/ui`. One set of components runs on web
(Next.js, Storybook) and native (Expo), styled with Tailwind 4 through Uniwind,
with Skia and three.js for the backgrounds and charts. Colours come from the
NYC-MON palette in `@acme/theme`: night background, orange, royal and carolina.

## Import

```tsx
import { Button, Card, TextField, GridFloor } from '@acme/ui';
import { HolographicTerrain, NeonTide } from '@acme/ui/three';
import { View, Text } from '@acme/ui/tw';
```

Other entry points: `@acme/ui/primitives`, `@acme/ui/neon`,
`@acme/ui/elements`, `@acme/ui/progress`, `@acme/ui/gpu`, `@acme/ui/icons`,
`@acme/ui/haptics`. See `package.json` for the full `exports` map.

## Storybook

```sh
pnpm --filter storybook dev
```

Storybook runs on http://localhost:6006. Stories sit next to their components
in this folder. Start at **NeonBlade/Index**, which lists every NeonBlade
component next to its NYC-Tron port, then **Foundation** for colours, type and
spacing.

## Inspired by NeonBlade UI

NYC-Tron would not look the way it does without
[NeonBlade UI](https://neonbladeui.neuronrush.com) by
[vprix21](https://github.com/vprix21/neonblade-ui), an MIT-licensed set of
neon, sci-fi React components. Thank you, vprix21, for building it and for
releasing it openly.

NeonBlade shaped the kit in these ways:

- **Component set.** Every one of NeonBlade's 41 components has a counterpart
  here. `neonblade/catalog.ts` maps each one to its NYC-Tron name and story,
  and the NeonBlade/Index story shows them side by side with links to the
  NeonBlade demos. Most ports keep NeonBlade's prop names, so its docs still
  describe how they behave.
- **Three.js backgrounds.** `HolographicTerrain` and `NeonTide` are faithful
  ports of NeonBlade's Holographic Terrain and Neon Tide: the same three.js
  scenes, camera, fog, lighting and pointer response, drawn in NYC-MON's
  royal, carolina and orange.
- **Shape.** The corner-cut buttons and cards, the notch card geometry, the
  neon colour presets and glow intensities all follow NeonBlade. So does the
  square-by-default look: components have no rounded corners unless asked.
- **Grid Floor.** NeonBlade's Grid Floor background became `GridFloor` and
  `GridScene`, the street-grid ground plane behind most NYC-MON screens.
- **Cursors.** The `cursors/` components follow NeonBlade's fox cursor: a
  drawn cursor that chases the pointer, hides the native one, and takes the
  same `hideNativeCursor`, `disabled`, `containerRef` and `glowIntensity`
  props. Ours is a city mouse instead of a fox.

NYC-Tron reimplements these components; it does not depend on the NeonBlade
package. Each port was rebuilt for React Native and web and redrawn around New
York, so circuit traces became subway lines, Glyph City became district
skylines, and the modal became a building facade. Credit for the original
designs belongs to NeonBlade.

The per-component list of ports and NeonBlade's MIT licence text are in
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
