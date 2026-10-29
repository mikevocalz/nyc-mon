import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { withKitWeb } from '@acme/config/vite/kit-web.mjs';

const root = dirname(fileURLToPath(import.meta.url));
// Preserve the existing simulator; the NVIDIA page reuses its auth and agent loop in the same package.
export default defineConfig(async () => withKitWeb({
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: true,
    rollupOptions: { input: { main: resolve(root,'index.html'), nvidia: resolve(root,'nvidia.html') } } },
  server: { fs: { allow: ['..','../..'] } },
}, { appRoot: root, react: react() }));
