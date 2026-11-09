import { defineConfig } from 'wxt';

export default defineConfig({
   srcDir: 'src',
   outDir: 'dist',
   modules: ['@wxt-dev/auto-icons'],
   // Point Vite's dependency scanner at the source HTML entrypoints. Without
   // this, Vite 8 also scans the pre-rendered `dist/chrome-mv3-dev` HTML files
   // before WXT writes them and logs a noisy (non-fatal) dep-scan failure.
   vite: () => ({
      optimizeDeps: {
         entries: ['src/entrypoints/options/index.html', 'src/entrypoints/popup/index.html'],
      },
   }),
   manifest: {
      name: 'Takhtabush Extension',
      description: 'Clone Quizlet sets into your Takhtabush account.',
      permissions: ['storage', 'identity'],
      optional_host_permissions: ['http://*/*', 'https://*/*'],
   },
});
