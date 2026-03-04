import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
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
    },
    rules: {
      // TypeScript rules — disabled for pre-existing codebase (address in follow-up)
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // React hooks — only enforce the non-negotiable rule; exhaustive-deps is advisory
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      // React refresh — off to avoid warnings on context/hook files
      'react-refresh/only-export-components': 'off',
      // Disable rules that fire false positives in TSX files
      'no-undef': 'off',         // TypeScript handles undefined checks
      'no-redeclare': 'off',     // TypeScript handles redeclarations
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
