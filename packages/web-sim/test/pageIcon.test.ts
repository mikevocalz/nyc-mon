import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Browsers ask for /favicon.ico when a page names no icon. Without one the
// hosted companion logged a 404 on every load, which reads as a broken page.
const root = resolve(__dirname, '..');

describe('page icon', () => {
  it('ships /favicon.ico from public/, so the build copies it to dist/', () => {
    const icon = resolve(root, 'public/favicon.ico');
    expect(existsSync(icon)).toBe(true);
    expect(statSync(icon).size).toBeGreaterThan(0);
  });

  it.each(['nvidia.html', 'index.html'])('%s names the icon', (page) => {
    const html = readFileSync(resolve(root, page), 'utf8');
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.ico" ?\/>/);
  });
});
