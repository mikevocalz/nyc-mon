import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { withKitWeb } from '@acme/config/vite/kit-web.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const appTsconfig = fileURLToPath(new URL('./tsconfig.json', import.meta.url));
// Preserve the existing simulator; the NVIDIA page reuses its auth and agent loop in the same package.
export default defineConfig(async () => withKitWeb({
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: true,
    rollupOptions: { input: { main: resolve(root,'index.html'), nvidia: resolve(root,'nvidia.html') } } },
  server: { fs: { allow: ['..','../..'] } },
  resolve: {
    // Same root-tsconfig trap as apps/admin-vite: tsconfig paths discovery
    // walks up to the repo-root tsconfig.json, which extends
    // `expo/tsconfig.base` (installed only under apps/mobile), and the build
    // fails with "Tsconfig not found expo/tsconfig.base".
    tsconfigPaths: false,
  },
  // Pin the transform's tsconfig to this app's own so rolldown never walks
  // up to the repo-root one above.
  tsconfig: appTsconfig,
}, { appRoot: root, react: react() }));
