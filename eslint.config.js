import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
   {
      ignores: [
         '**/node_modules/**',
         '**/dist/**',
         '**/.wrangler/**',
         '**/.turbo/**',
         '**/coverage/**',
         '**/worker-configuration.d.ts',
         '**/.artifacts/**',
         '**/.state/**',
      ],
   },
   js.configs.recommended,
   ...tseslint.configs.recommended,
   {
      files: ['**/*.mjs'],
      languageOptions: {
         // The e2e server script runs on Node and talks to the local Worker.
         globals: {
            console: 'readonly',
            process: 'readonly',
            setTimeout: 'readonly',
         },
      },
   },
   {
      rules: {
         '@typescript-eslint/no-unused-vars': [
            'warn',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
         ],
      },
   },
);
