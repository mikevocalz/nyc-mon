/**
 * Scheme scopes under Next's CSS pipeline.
 *
 * Next runs apps/web/globals.css through @tailwindcss/postcss, then its own
 * lightningcss pass at its modern browserslist target, which lowers every
 * light-dark() token to
 * `var(--lightningcss-light, A) var(--lightningcss-dark, B)` on :root. A
 * custom property holding var() is substituted where it is declared, so the
 * tokens settle at :root and `scheme-dark` on a descendant flips nothing
 * unless the scope redeclares them (build-css.mjs). These tests compile
 * theme.css the way Next does, render a scope in Chromium and read the
 * resolved tokens and the painted text colour. When apps/web has a
 * `next build` newer than theme.css, its emitted CSS gets the same check.
 *
 * Tooling resolves from the apps that own it (no new deps in @acme/theme):
 * @tailwindcss/postcss, lightningcss and Next's target list from apps/web,
 * playwright from apps/storybook.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { semantic } from './tokens.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const THEME_CSS = join(HERE, 'theme.css');

const fromWeb = createRequire(join(ROOT, 'apps/web/package.json'));
const tailwindPath = fromWeb.resolve('@tailwindcss/postcss');
const postcss = createRequire(tailwindPath)('postcss');
const tailwind = fromWeb('@tailwindcss/postcss');
const lightningcss = createRequire(createRequire(tailwindPath).resolve('@tailwindcss/node'))('lightningcss');
const NEXT_TARGETS: string[] = fromWeb('next/dist/shared/lib/modern-browserslist-target.js');

/** Next's browserslist entries ('safari 16.4') as lightningcss targets. */
function lightningTargets(list: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const entry of list) {
    const [browser, version] = entry.split(' ') as [string, string];
    const [major = 0, minor = 0] = version.split('.').map(Number);
    out[browser] = (major << 16) | (minor << 8);
  }
  return out;
}
const { chromium } = createRequire(join(ROOT, 'apps/storybook/package.json'))('playwright');

const NAMES = Object.keys(semantic) as (keyof typeof semantic)[];

/** theme.css compiled like apps/web/app/globals.css: Tailwind, then Next's lightningcss pass. */
async function compileLikeNext(): Promise<string> {
  const input = [
    "@import 'tailwindcss' source(none) important;",
    `@import '${THEME_CSS}';`,
    '@source inline("text-text bg-surface scheme-dark scheme-light");',
  ].join('\n');
  const result = await postcss([tailwind({ optimize: { minify: true } })]).process(input, {
    // A virtual file beside globals.css, so `tailwindcss` resolves as it does for Next.
    from: join(ROOT, 'apps/web/app/__scheme-scope__.css'),
  });
  return lightningcss
    .transform({ filename: 'scheme-scope.css', code: Buffer.from(result.css), minify: true, targets: lightningTargets(NEXT_TARGETS) })
    .code.toString();
}

const hex = (rgb: string) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  return m ? `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase() : rgb;
};

/**
 * Light page with a scheme-dark scope, dark page with a scheme-light scope.
 * Returns each token as resolved inside the scope, plus the painted colour of
 * a `text-text` paragraph there.
 */
async function renderScopes(css: string) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const probe = async (htmlAttrs: string, scope: string) => {
      await page.setContent(
        `<!doctype html><html ${htmlAttrs}><head><style>${css}</style></head>` +
          `<body class="bg-surface"><div id="scope" class="${scope}"><p id="p" class="text-text">x</p></div></body></html>`,
      );
      return page.evaluate((names: string[]) => {
        const p = document.getElementById('p')!;
        const cs = getComputedStyle(p);
        // A token's value is read by painting it, so lowered var() chains resolve.
        const probeEl = document.createElement('span');
        p.appendChild(probeEl);
        const tokens: Record<string, string> = {};
        for (const n of names) {
          probeEl.style.color = `var(--color-${n})`;
          tokens[n] = getComputedStyle(probeEl).color;
        }
        return { text: cs.color, tokens };
      }, NAMES as string[]);
    };
    return {
      darkInLight: await probe('', 'scheme-dark'),
      lightInDark: await probe("data-theme='dark'", 'scheme-light'),
    };
  } finally {
    await browser.close();
  }
}

const expectHex = (value: string) => value.slice(0, 7).toUpperCase();

function assertScopes(r: Awaited<ReturnType<typeof renderScopes>>) {
  assert.equal(hex(r.darkInLight.text), expectHex(semantic.text.dark), 'text-text inside scheme-dark on a light page');
  assert.equal(hex(r.lightInDark.text), expectHex(semantic.text.light), 'text-text inside scheme-light on a dark page');
  for (const n of NAMES) {
    // Alpha tokens (glow) paint as rgba; compare the rgb part.
    assert.equal(hex(r.darkInLight.tokens[n]!), expectHex(semantic[n].dark), `--color-${n} in scheme-dark`);
    assert.equal(hex(r.lightInDark.tokens[n]!), expectHex(semantic[n].light), `--color-${n} in scheme-light`);
  }
}

test('Tailwind postcss (the Next pipeline) lowers light-dark(), and the scopes still resolve', async () => {
  const css = await compileLikeNext();
  // The bug's precondition: without it this test would prove nothing.
  assert.match(css, /--color-text:var\(--lightningcss-light,/, 'expected lightningcss to lower light-dark() on :root');
  assertScopes(await renderScopes(css));
});

test('apps/web `next build` CSS: scheme scopes resolve to their own scheme', async (t) => {
  const buildId = join(ROOT, 'apps/web/.next/BUILD_ID');
  const chunks = join(ROOT, 'apps/web/.next/static/chunks');
  if (!existsSync(buildId) || statSync(buildId).mtimeMs < statSync(THEME_CSS).mtimeMs) {
    t.skip('no apps/web next build newer than theme.css (run `pnpm --filter web build`)');
    return;
  }
  const css = readdirSync(chunks)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(chunks, f), 'utf8'))
    .join('\n');
  assert.match(css, /\.scheme-dark\{/, 'the build carries no .scheme-dark rule');
  assertScopes(await renderScopes(css));
});
