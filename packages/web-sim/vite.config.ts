import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { withKitWeb } from '@acme/config/vite/kit-web.mjs';

const root = dirname(fileURLToPath(import.meta.url));

// The kit's web pipeline, shared with apps/storybook (packages/config/vite/kit-web.mjs).
export default defineConfig(async () =>
  withKitWeb(
    {
      build: { outDir: 'dist', emptyOutDir: true, sourcemap: true },
      server: { fs: { allow: ['..', '../..'] } },
    },
    { appRoot: root, react: react() },
  ),
);
