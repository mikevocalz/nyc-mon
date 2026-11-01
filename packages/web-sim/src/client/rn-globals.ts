// The globals React Native packages read at module load, as Storybook sets them
// (apps/storybook/.storybook/preview-head.html and vitest.setup.ts). Imported
// first by main.tsx, so it runs before any kit module; a module, not an inline
// script, so the production page CSP needs no 'unsafe-inline' for scripts.
const g = globalThis as Record<string, unknown> & { process?: { env?: Record<string, string | undefined> } };
g.global ??= globalThis;
g.process ??= { env: {} };
g.process.env ??= {};
g.__DEV__ ??= import.meta.env.DEV;
