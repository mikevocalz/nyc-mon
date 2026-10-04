// Tailwind v4 as apps/storybook runs it (08-handoff.md P5), then the console
// scope (console-scope.postcss.mjs). Only src/console.css is scoped; Payload's
// stylesheet carries no Tailwind directives and passes through both untouched.
import tailwindcss from '@tailwindcss/postcss';
import consoleScope from './console-scope.postcss.mjs';

const consoleSheet = /[\\/]apps[\\/]admin-vite[\\/]src[\\/]console\.css$/;

export default {
  plugins: [tailwindcss(), consoleScope({ include: (file) => consoleSheet.test(file) })],
};
