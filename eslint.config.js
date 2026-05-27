import path from 'node:path'
import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import svelteConfig from './svelte.config.js'

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore')

export default defineConfig([
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  svelte.configs.recommended,

  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },

  {
    files: ['**/*.svelte', '**/*.svelte.js'],
    languageOptions: { parserOptions: { svelteConfig } }
  },

  {
    files: ['**/*.svelte'],
    rules: {
      'no-useless-assignment': 'off',
      // Every post links out to its source Wikipedia article; this rule targets
      // internal SvelteKit navigation, which this client-only app doesn't use.
      'svelte/no-navigation-without-resolve': 'off'
    }
  },

  {
    // Override or add rule settings here, such as:
    // 'svelte/button-has-type': 'error'
    rules: {
      'no-param-reassign': 'off',
      'no-void': 'off',
      'no-nested-ternary': 'off',
      'max-classes-per-file': 'off',

      'import/first': 'off',
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'import/no-extraneous-dependencies': 'off',
      'import/prefer-default-export': 'off',

      'prefer-promise-reject-errors': 'off',

      // allow debugger during development only
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'object-curly-spacing': ['error', 'always'],
      'no-trailing-spaces': 'error',
      'indent': ['error', 2, { SwitchCase: 1 }],
      'operator-linebreak': ['error', 'before'],
      'no-underscore-dangle': 'off',
      'no-continue': 'off',
      'no-console': 'error',
      'linebreak-style': ['off', 'error', 'windows'],
      'curly': 'off',
      'func-names': ['error', 'never'],
      'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
      'comma-dangle': [2, 'never'],
      'semi': ['error', 'never'],
      // 'space-before-function-paren': ['error', 'always'],
      'prefer-template': 'off',
      'max-len': ['error', { code: 150 }],
      'nonblock-statement-body-position': ['error', 'below'],
      'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: true }],
      'no-plusplus': 'off',
      'radix': ['error', 'as-needed'],
      'quote-props': ['error', 'consistent'],
      // 'prefer-const': 'error',
      'no-prototype-builtins': 'error',
      'arrow-parens': ['error', 'as-needed', { requireForBlockBody: true }],
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1, maxBOF: 0 }],
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'no-restricted-globals': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ForInStatement',
          message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want.Use Object.{keys,values,entries}'
            + 'and iterate over the resulting array.'
        },
        {
          selector: 'ForOfStatement',
          message: 'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them.'
            + 'Separately, loops should be avoided in favor of array iterations.'
        },
        {
          selector: 'LabeledStatement',
          message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.'
        },
        {
          selector: 'WithStatement',
          message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.'
        }
      ]
    }
  }
])
