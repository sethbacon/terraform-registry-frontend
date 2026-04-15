import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // React hooks — enforce both rules to prevent stale closures and rule violations
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // React refresh — off to avoid warnings on context/hook files
      'react-refresh/only-export-components': 'off',
      // Disable rules that fire false positives in TSX files
      'no-undef': 'off',         // TypeScript handles undefined checks
      'no-redeclare': 'off',     // TypeScript handles redeclarations
      // Accessibility (jsx-a11y) — recommended rules as warnings to avoid breaking CI
      ...Object.fromEntries(
        Object.entries(jsxA11y.flatConfigs.recommended.rules ?? {}).map(
          ([rule, level]) => [rule, level === 'error' ? 'warn' : level],
        ),
      ),
      // autoFocus is intentional in MUI dialog text fields
      'jsx-a11y/no-autofocus': 'off',
    },
  },
  // Non-TypeScript JS files (vite.config, etc.) — minimal rules
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]
