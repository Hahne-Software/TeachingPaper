import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src-tauri'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['docs/agents/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // The Worksheet reducer is pure model code: no UI, no Block Type modules.
    files: ['src/worksheet/reducer*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['react', 'react-dom', '**/blocks/**', '**/components/**'],
        },
      ],
    },
  },
);
