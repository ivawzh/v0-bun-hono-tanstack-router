/**
 * stylistic replaced the following three:
 * - eslint: Built-in stylistic rules for JavaScript
 * - @typescript-eslint/eslint-plugin: Stylistic rules for TypeScript
 * - eslint-plugin-react: Framework-agnostic JSX rules
 */
// import react from '@eslint-react/eslint-plugin'
// import js from "@eslint/js";
// import tseslint from 'typescript-eslint'
import pluginQuery from '@tanstack/eslint-plugin-query'
import pluginRouter from '@tanstack/eslint-plugin-router'
import { configs as reactHooksConfigs } from 'eslint-plugin-react-hooks'
import tsParser from '@typescript-eslint/parser'
import stylistic from '@stylistic/eslint-plugin'
import markdown from '@eslint/markdown'
import { defineConfig } from 'eslint/config'
import wrap from '@seahax/eslint-plugin-wrap'

const ignores = [
  'lib-docs/**',
  'wiki/**',
  'drizzle/**',
  '.drizzle/**',
  '.sst/**',
  '.tanstack-start/**',
  'node_modules/**',
  'public/**',
  '.vscode/**',
  'dist',
  '.wrangler',
  '.vercel',
  '.netlify',
  '.output',
  'build/',
]

export default defineConfig(
  {
    language: 'markdown/gfm',
    ignores,
    files: ['**/*.{md}'],
    extends: [
      markdown.configs.recommended,
    ],
  },
  {
    ignores,
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@stylistic': stylistic,
    },
    extends: [
      /**
       * stylistic replaced the following three:
       * - eslint: Built-in stylistic rules for JavaScript
       * - @typescript-eslint/eslint-plugin: Stylistic rules for TypeScript
       * - eslint-plugin-react: Framework-agnostic JSX rules
       */
      // js.configs.recommended,
      // tseslint.configs.recommended,
      // react.configs["recommended-type-checked"],
      pluginQuery.configs['flat/recommended'],
      pluginRouter.configs['flat/recommended'],
      reactHooksConfigs['recommended-latest'],
      wrap.config({
        maxLen: 90,
        tabWidth: 2,
        autoFix: true,
        severity: 'warn',
      }),
      stylistic.configs.customize({
        indent: 2,
        quotes: 'single',
        semi: false,
        commaDangle: 'always-multiline',
        arrowParens: true,
        braceStyle: '1tbs',
        blockSpacing: true,
        quoteProps: 'as-needed',
      }),
    ],
    rules: {
      'react-hooks/react-compiler': 'warn',
      'no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'none',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
          reportUsedIgnorePattern: false,
        },
      ],
      'no-useless-rename': [
        'error',
        {
          ignoreDestructuring: false,
          ignoreImport: false,
          ignoreExport: false,
        },
      ],
      'no-else-return': 'error',
      'object-shorthand': ['error', 'properties'],
      '@stylistic/max-statements-per-line': ['error', { max: 2 }],
    },
  },
  // Add a separate config for spec files
  {
    files: ['**/*.spec.ts'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
)
