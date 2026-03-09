import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import neostandard from 'neostandard'
import nextVitals from 'eslint-config-next/core-web-vitals'
import tseslint from 'typescript-eslint'

const configDirectory = dirname(fileURLToPath(import.meta.url))

export default [
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'node_modules/**',
      'scripts/**',
      'convex/_generated/**',
      'eslint.config.mjs'
    ]
  },
  ...neostandard(),
  ...nextVitals,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: tseslint.configs.disableTypeChecked.languageOptions,
    rules: tseslint.configs.disableTypeChecked.rules
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: configDirectory
      }
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-void': ['error', { allowAsStatement: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/require-await': 'error',
      // Allow numbers in template expressions — ${count} and ${score.toFixed(1)} are idiomatic
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // These three rules require strictNullChecks in tsconfig to function correctly
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
      '@typescript-eslint/no-useless-default-assignment': 'off'
    }
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off'
    }
  },
  {
    // Convex generated API types (api.*, internal.*) cannot be resolved by the
    // TypeScript ESLint parser, producing false-positive unsafe-* errors.
    // Also applies to src/server/** and the client-side Convex boundary files
    // that directly import from convex/_generated/api.
    files: [
      'convex/**/*.ts',
      'src/server/**/*.ts',
      'src/features/**/server/**/*.ts',
      'src/features/shift/client/convex-api.ts',
      'src/features/landing/client/LiveLandingLeaderboard.tsx',
      'src/features/report/client/ContactForm.tsx'
    ],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off'
    }
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: ['@/server/convex/*']
      }]
    }
  },
  {
    files: ['src/features/**/client/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: ['@/server/*']
      }]
    }
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          'convex',
          'convex/*',
          'next',
          'next/*',
          'react',
          'react-dom'
        ]
      }]
    }
  },
  {
    // policy-vm.ts runs user-submitted JS inside a QuickJS sandbox.
    // QuickJS's vm.dump() and vm.evalCode() return `any` by design — the
    // values cross the JS/WASM boundary and have no static type. These
    // suppression rules are scoped here rather than broadening the Convex block.
    files: ['src/core/engine/policy-vm.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off'
    }
  }
]
