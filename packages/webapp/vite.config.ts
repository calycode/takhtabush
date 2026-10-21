import { fileURLToPath } from 'node:url';

import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Vite aliases must be absolute paths. Non-absolute values ("preact/compat")
// are passed to esbuild's optimizer as relative paths and fail.
const preactEntry = (specifier: string) => fileURLToPath(import.meta.resolve(specifier));
const srcDir = fileURLToPath(new URL('./src', import.meta.url));

const API_TARGET = 'http://127.0.0.1:8787';

export default defineConfig({
   plugins: [
      // The preset's built-in React aliases are non-absolute, so disable them and
      // declare the full absolute set below. RegExps keep "react" from matching
      // "react/jsx-runtime".
      preact({ reactAliasesEnabled: false }),
      tailwindcss(),
   ],
   base: './',
   build: {
      outDir: 'dist/client',
      emptyOutDir: true,
   },
   server: {
      port: 5173,
      strictPort: true,
      proxy: {
         '/api': { target: API_TARGET, changeOrigin: true },
         '/media': { target: API_TARGET, changeOrigin: true },
         '/mcp': { target: API_TARGET, changeOrigin: true },
         '/mcp-apps': { target: API_TARGET, changeOrigin: true },
      },
   },
   define: {
      'process.env.IS_PREACT': JSON.stringify('true'),
   },
   resolve: {
      alias: [
         { find: '@', replacement: srcDir },
         { find: /^react$/, replacement: preactEntry('preact/compat') },
         { find: /^react-dom$/, replacement: preactEntry('preact/compat') },
         { find: /^react-dom\/client$/, replacement: preactEntry('preact/compat/client') },
         { find: /^react\/jsx-runtime$/, replacement: preactEntry('preact/jsx-runtime') },
         { find: /^react\/jsx-dev-runtime$/, replacement: preactEntry('preact/jsx-dev-runtime') },
      ],
   },
});
