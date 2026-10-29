// Axis-aligned box faces for the procedural actors (box cars, peds, signal
// heads). Plain arrays, no three import, so the worklet runtime can build them.

export function pushBox(pos: number[], nrm: number[], idx: number[], cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): void {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const faces: [number, number, number, number[]][] = [
    // normal, the four corners (ccw seen from outside)
    [1, 0, 0, [hx, hy, -hz, hx, hy, hz, hx, -hy, hz, hx, -hy, -hz]],
    [-1, 0, 0, [-hx, hy, hz, -hx, hy, -hz, -hx, -hy, -hz, -hx, -hy, hz]],
    [0, 1, 0, [-hx, hy, hz, hx, hy, hz, hx, hy, -hz, -hx, hy, -hz]],
    [0, -1, 0, [-hx, -hy, -hz, hx, -hy, -hz, hx, -hy, hz, -hx, -hy, hz]],
    [0, 0, 1, [-hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz]],
    [0, 0, -1, [hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz]],
  ];
  for (const [nx, ny, nz, c] of faces) {
    const base = pos.length / 3;
    for (let i = 0; i < 4; i++) {
      pos.push(cx + c[i * 3]!, cy + c[i * 3 + 1]!, cz + c[i * 3 + 2]!);
      nrm.push(nx, ny, nz);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}
