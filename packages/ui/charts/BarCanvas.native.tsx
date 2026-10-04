import BarCanvasSkia, { type BarCanvasProps } from './BarCanvas.skia';

/** Native: Skia is linked in, so the drawing renders directly. */
export function BarCanvas(props: BarCanvasProps) {
  return <BarCanvasSkia {...props} />;
}
