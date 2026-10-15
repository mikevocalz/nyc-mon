/**
 * The final setup form belongs to ONE physical display region, even when
 * Android WindowManager / iPhone Duo reserved regions report two or more.
 * This is intentionally a pure geometry decision: no window globals and no
 * device-name heuristics. Unknown hinges fall back to the current window.
 */
export interface PermissionDivision {
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  active?: boolean;
  separating?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export interface PermissionViewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

function split(viewport: PermissionViewport, division: PermissionDivision): PermissionViewport[] {
  const vertical = division.orientation
    ? division.orientation === 'vertical'
    : division.height >= division.width;
  if (vertical) {
    if (division.x <= viewport.left || division.x >= viewport.left + viewport.width) return [viewport];
    const end = Math.min(viewport.left + viewport.width, division.x + Math.max(0, division.width));
    const pieces: PermissionViewport[] = [
      { ...viewport, width: division.x - viewport.left },
    ];
    if (end < viewport.left + viewport.width) {
      pieces.push({ ...viewport, left: end, width: viewport.left + viewport.width - end });
    }
    return pieces;
  }
  if (division.y <= viewport.top || division.y >= viewport.top + viewport.height) return [viewport];
  const end = Math.min(viewport.top + viewport.height, division.y + Math.max(0, division.height));
  const pieces: PermissionViewport[] = [
    { ...viewport, height: division.y - viewport.top },
  ];
  if (end < viewport.top + viewport.height) {
    pieces.push({ ...viewport, top: end, height: viewport.top + viewport.height - end });
  }
  return pieces;
}

/**
 * On a separating fold, choose the largest available segment and scroll
 * inside it. For a tabletop tie, prefer the lower half for reachability.
 * For side-by-side ties, prefer the leading physical segment.
 */
export function permissionViewport(
  width: number,
  height: number,
  regions: readonly PermissionDivision[],
): PermissionViewport {
  const whole: PermissionViewport = {
    left: 0,
    top: 0,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
  const divisions = regions.filter(
    (region) => region.kind === 'division' && (region.separating ?? region.active),
  );
  if (divisions.length === 0) return whole;
  const segments = divisions.reduce<PermissionViewport[]>(
    (current, division) => current.flatMap((part) => split(part, division)),
    [whole],
  ).filter((part) => part.width > 0 && part.height > 0);
  if (segments.length === 0) return whole;
  segments.sort(
    (a, b) =>
      b.width * b.height - a.width * a.height ||
      b.top - a.top ||
      a.left - b.left,
  );
  return segments[0]!;
}
