/** Vertical field of view of the preview camera, in degrees. */
export const PREVIEW_FOV = 40;
/** Share of the frame's height the model fills. */
const FILL = 0.65;

/**
 * Camera for one model on the preview stage: level with the model's middle, far enough back that
 * the model fills FILL of the frame whatever its size, so a 15 cm egg reads as large as a 1.8 m Max.
 */
export function previewCamera(heightMeters: number | null | undefined, scale: number) {
  const height = Math.max(0.01, (heightMeters ?? 1) * scale);
  const distance = height / FILL / (2 * Math.tan((PREVIEW_FOV * Math.PI) / 360));
  const middle = height / 2;
  return {
    position: [0, middle, distance] as [number, number, number],
    focalPoint: [0, middle, 0] as [number, number, number],
  };
}
