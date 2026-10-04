/**
 * Storybook story ids, computed the way Storybook computes them, so the
 * NeonBlade index links stay right when a story file is retitled.
 *   id = sanitize(title) + '--' + sanitize(startCase(exportName))
 */
export function sanitize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/** Storybook's storyNameFromExport: "NavBarStory" -> "Nav Bar Story". */
export function storyNameFromExport(key: string): string {
  return key
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export function storyId(title: string, exportName: string, metaId?: string): string {
  return `${sanitize(metaId ?? title)}--${sanitize(storyNameFromExport(exportName))}`;
}

/** Manager URL for a story (opened from inside the preview iframe with target _top). */
export function storyHref(id: string): string {
  return `/?path=/story/${id}`;
}
