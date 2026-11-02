// A synthetic v2 tile for tests. Not a shipped NYC map: invented metres
// around a point in Harlem, sized to exercise every feature kind.
export function syntheticTileV2() {
  return {
    version: 2, id: 'test-tile', origin: [-73.95, 40.81], extentMeters: 200,
    source: { url: 'https://www.openstreetmap.org/copyright', attribution: 'Test only', license: 'ODbL-1.0', retrievedAt: '2026-10-15T00:00:00Z' },
    notes: ['synthetic'],
    buildings: [
      { id: 'b:1', p: [0, 0, 20, 0, 20, -15, 0, -15], h: 14, c: 'brownstone', e: 2 },
      { id: 'b:2', p: [40, 0, 60, 0, 60, -30, 40, -30], h: 60, c: 'glass', e: 0, n: 'Tower' },
    ],
    roads: [{ id: 'r:1', c: 'residential', w: 9, s: 4.5, p: [-50, 10, 100, 10] }],
    areas: [{ id: 'a:1', k: 'park', p: [-50, 30, 0, 30, 0, 80, -50, 80] }],
    trees: { osm: [-20, 50], fill: [10, 15] },
    landmarks: [{ key: 'apollo-theater', name: 'Apollo Theater', buildingId: 'b:1', x: 10, z: -7.5 }],
  };
}

// The same invented corner in v3 shape: record flags on the wire `e` (set =
// a named record supplied the field), the Valdrada building fields on b:1,
// and the new road, transit and furniture collections.
export function syntheticTileV3() {
  return {
    version: 3, id: 'test-tile-v3', origin: [-73.95, 40.81], extentMeters: 200,
    sources: [
      { url: 'https://www.openstreetmap.org/copyright', attribution: 'Test only', license: 'ODbL-1.0', retrievedAt: '2026-10-15T00:00:00Z' },
      {
        url: 'https://huggingface.co/datasets/mehmetkeremturkcan/valdrada', attribution: 'Valdrada test only', license: 'ODbL-1.0',
        licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/', retrievedAt: '2026-10-17T00:00:00Z',
      },
    ],
    notes: ['synthetic'],
    buildings: [
      { id: 'b:1', p: [0, 0, 20, 0, 20, -15, 0, -15], h: 14, c: 'brownstone', e: 5, f: 4, fh: 3.5, vs: 5, sh: 0, ww: 1.75, fi: 0, d: 67 },
      { id: 'b:2', p: [40, 0, 60, 0, 60, -30, 40, -30], h: 60, c: 'glass', e: 1, n: 'Tower' },
    ],
    roads: [{ id: 'cscl:1', c: 'residential', w: 9, s: 4.5, p: [-50, 10, 100, 10], l: 2, ow: 1, sp: 25, sid: 7 }],
    areas: [{ id: 'a:1', k: 'park', p: [-50, 30, 0, 30, 0, 80, -50, 80] }],
    trees: { census: [-20, 50], fill: [10, 15] },
    landmarks: [{ key: 'apollo-theater', name: 'Apollo Theater', buildingId: 'b:1', x: 10, z: -7.5 }],
    transit: { subway: [5, 5], shelters: [15, 15] },
    furniture: { hydrant: [1, 2, 0.5], linknyc: [], bikeRack: [3, 4, 1.2, 6, 7, 0] },
  };
}
