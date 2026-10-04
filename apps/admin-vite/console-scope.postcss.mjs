/**
 * Confines the console stylesheet (src/console.css) to `.nycmon-console`, so
 * `@acme/theme` and Tailwind v4 can share one document with Payload's admin
 * (docs/design/admin/08-handoff.md P2).
 *
 * Payload 4 declares `--color-bg`, `--color-text`, `--color-border` and ~200
 * more `--color-*` on `:root` and `[data-theme]`, and styles bare elements, all
 * inside `@layer payload-default`. `@acme/theme` declares its own `--color-*`
 * on `:root`, and Tailwind's preflight resets bare elements. Loaded as they
 * are, each would repaint the other. After this plugin:
 *
 * - every rule in the sheet matches only the console root or its descendants:
 *   `:root`/`:host`/`html` become `.nycmon-console`, `*` and bare pseudo-
 *   elements are re-rooted under it, and every other selector gains
 *   `:where(.nycmon-console, .nycmon-console *)` on its subject (zero added
 *   specificity, so the kit's own cascade is unchanged);
 * - `[data-theme='dark']` from `@acme/theme` keys off Payload's `<html
 *   data-theme>` and sets `color-scheme` on the console root only, so the
 *   console follows Payload's theme switch and Payload's `<html>` keeps its
 *   own color-scheme;
 * - everything lands in `@layer nycmon-console`, declared after
 *   `payload-default` whatever order the sheets load in, so inside the console
 *   the kit's preflight beats Payload's element rules, and outside it nothing
 *   matches.
 *
 * `@property`, `@font-face` and `@keyframes` stay global: they style nothing
 * on their own. Kit components that portal out of the console root (Dialog,
 * BottomSheet, Toaster, Menu) need a `.nycmon-console` portal container; none
 * is rendered yet.
 *
 * SOT: https://tailwindcss.com/docs/preflight
 *      https://developer.mozilla.org/en-US/docs/Web/CSS/@layer (layer order, !important reversal)
 *      node_modules/@payloadcms/ui/dist/styles.css (`@layer payload-default`)
 */
export const CONSOLE_ROOT = '.nycmon-console';
export const CONSOLE_LAYER = 'nycmon-console';
const SUBJECT = `:where(${CONSOLE_ROOT}, ${CONSOLE_ROOT} *)`;
const GLOBAL_AT_RULES = new Set(['property', 'font-face', 'keyframes', 'charset', 'import']);

/** Index of the first unescaped `::` (a pseudo-element), or -1. */
function pseudoElementIndex(selector) {
  for (let index = 0; index < selector.length - 1; index += 1) {
    if (selector[index] === '\\') {
      index += 1;
      continue;
    }
    if (selector[index] === ':' && selector[index + 1] === ':') return index;
  }
  return -1;
}

/** Rewrites one complex selector (no top-level commas). */
export function scopeSelector(raw) {
  const selector = raw.trim();
  if (selector === ':root' || selector === ':host' || selector === 'html' || selector === 'html, :host') {
    return [CONSOLE_ROOT];
  }
  // @acme/theme's scheme switch: Payload owns <html data-theme>, the console
  // root follows it.
  const theme = /^\[data-theme=['"]?(light|dark|system)['"]?\]$/.exec(selector);
  if (theme) return [`:root[data-theme='${theme[1]}'] ${CONSOLE_ROOT}`];
  if (selector === '*') return [CONSOLE_ROOT, `${CONSOLE_ROOT} *`];
  if (selector.startsWith('::')) return [`${CONSOLE_ROOT}${selector}`, `${CONSOLE_ROOT} *${selector}`];
  if (selector === 'body') return [CONSOLE_ROOT];
  const pseudo = pseudoElementIndex(selector);
  if (pseudo === -1) return [`${selector}${SUBJECT}`];
  return [`${selector.slice(0, pseudo)}${SUBJECT}${selector.slice(pseudo)}`];
}

function insideKeyframes(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && /keyframes$/.test(parent.name)) return true;
  }
  return false;
}

/**
 * @param {{ include: (file: string) => boolean }} options which source files to scope
 * @returns {import('postcss').Plugin}
 */
export default function consoleScope({ include }) {
  return {
    postcssPlugin: 'nycmon-console-scope',
    OnceExit(root, { AtRule }) {
      const file = root.source?.input.file;
      if (!file || !include(file)) return;

      root.walkRules((rule) => {
        if (insideKeyframes(rule)) return;
        const scoped = rule.selectors.flatMap(scopeSelector);
        rule.selectors = [...new Set(scoped)];
      });

      const layer = new AtRule({ name: 'layer', params: CONSOLE_LAYER });
      const order = new AtRule({ name: 'layer', params: `payload-default, ${CONSOLE_LAYER}` });
      for (const node of [...root.nodes]) {
        if (node.type === 'atrule' && GLOBAL_AT_RULES.has(node.name)) continue;
        if (node.type === 'comment') continue;
        layer.append(node.remove());
      }
      root.prepend(order);
      root.append(layer);
    },
  };
}
consoleScope.postcss = true;
