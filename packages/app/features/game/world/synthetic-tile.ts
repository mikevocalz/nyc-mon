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
