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
    files: ['docs/agents/**/*.mjs', 'scripts/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // WebDriver key codes (Enter is \uE007) live in the Unicode private-use area, where an editor or
    // a copy drops them without a trace: write them as escapes.
    files: ['docs/agents/**/*.mjs'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[raw=/[\\uE000-\\uF8FF]/]',
          message:
            'Write private-use characters (WebDriver key codes) as \\uXXXX escapes.',
        },
        {
          selector: 'TemplateElement[value.raw=/[\\uE000-\\uF8FF]/]',
          message:
            'Write private-use characters (WebDriver key codes) as \\uXXXX escapes.',
        },
      ],
    },
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
