# Slop New York — MIT notice

Rendering techniques in the Game world's physical mode (`EXPO_PUBLIC_WORLD_PHYSICAL`) are adapted from **Slop New York** by Mr.doob: https://github.com/mrdoob/slop-newyork, commit `be65d0a` (2026-10-26). Lane F2, 2026-10-27. The text below is copied from that commit's `LICENSE` file, checked against the local clone at `~/src/slop-newyork`.

Each ported file opens with `Adapted from mrdoob/slop-newyork @ be65d0a, js/<file> <function> (MIT, © 2026 Mr.doob)`. Where Slop credits a three.js addon it adapted (its `actor-models.js` header names `LoftGeometry` and `CarGenerator`; its interior mapping comments cite `three/addons/generators/city/SkyscraperGenerator.js`), the ported file names that source too. three.js is MIT; nyc-mon already depends on `three@0.186.1`.

The Settings credit row reads "Rendering techniques adapted from Slop New York by Mr.doob (MIT)" (`docs/COPY_DECK.md`, `settings.legal.software.slop.*`) and links to the repository.

## Data: nothing from Slop's geodata

Slop's README says its geographic data comes from NYC Open Data and © OpenStreetMap contributors (ODbL). nyc-mon imports none of it: no Slop geodata, Overpass cache, building list, road network, landmark table or Manhattan bounds. Slop's code also hard-codes Manhattan facts (for example `CENTRAL_PARK_BOUNDS` from `city-config.js`, read by `canyonSkyAONode`); those constants are not carried over. The Harlem tile stays the Valdrada-backed `harlem-apollo-20261017`, whose own data notices are in `provenance-2026-10-17.md` and `docs/implementation/city-world.md`. Slop's ODbL notice therefore does not carry over to nyc-mon. Only the code licence below applies.

## Licence text

```
MIT License

Copyright (c) 2026 Mr.doob

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
