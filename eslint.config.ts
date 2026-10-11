import { fileURLToPath } from 'node:url'

import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import type { Linter } from 'eslint'
import { defineConfig, includeIgnoreFile } from 'eslint/config'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tailwindcss from 'eslint-plugin-tailwindcss'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))
const tailwindCssPath = fileURLToPath(new URL('src/style.css', import.meta.url))

export default defineConfig([
  includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,vue}'],
    plugins: { js },
    extends: ['js/recommended'],
  },
  stylistic.configs.customize({ braceStyle: '1tbs' }),
  // Deliberately no languageOptions.globals: this turns no-undef off for .ts, and the
  // .vue block below does the same, so environments are separated by tsconfig instead.
  tseslint.configs.recommended,
  pluginVue.configs['flat/recommended-error'],
  {
    files: ['src/**/*.vue'],
    // Cast because the plugin types its config with typescript-eslint's types, which defineConfig's types reject; the config itself is valid
    extends: [tailwindcss.configs.recommended as Linter.Config],
    settings: { tailwindcss: { cssConfigPath: tailwindCssPath } },
  },
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    rules: tseslint.configs.eslintRecommended.rules,
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,vue}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
])
