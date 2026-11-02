/** Source-space face direction. Exact zero only: thin legitimate faces are retained before final quantization. */
export function carLodFace(positions, triangle) {
  const [a, b, c] = triangle.map((vertex) => vertex * 3);
  const gx = (positions[b + 1] - positions[a + 1]) * (positions[c + 2] - positions[a + 2]) - (positions[b + 2] - positions[a + 2]) * (positions[c + 1] - positions[a + 1]);
  const gy = (positions[b + 2] - positions[a + 2]) * (positions[c] - positions[a]) - (positions[b] - positions[a]) * (positions[c + 2] - positions[a + 2]);
  const gz = (positions[b] - positions[a]) * (positions[c + 1] - positions[a + 1]) - (positions[b + 1] - positions[a + 1]) * (positions[c] - positions[a]);
  const length = Math.hypot(gx, gy, gz);
  return length === 0 ? null : { gx, gy, gz, length };
}
