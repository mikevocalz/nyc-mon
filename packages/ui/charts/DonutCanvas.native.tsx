import DonutCanvasSkia, { type DonutCanvasProps } from './DonutCanvas.skia';

/** Native: Skia is linked in, so the drawing renders directly. */
export function DonutCanvas(props: DonutCanvasProps) {
  return <DonutCanvasSkia {...props} />;
}
