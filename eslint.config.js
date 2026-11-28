import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/mocks/*', '**/mocks/*'],
          message: 'Solo src/app/services.ts puede importar el backend simulado.'
        }]
      }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Los manejadores de eventos de React aceptan funciones asíncronas.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }]
    }
  },
  {
    files: ['src/app/services.ts', 'src/mocks/**', 'src/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' }
  },
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: { ...globals.node } }
  },
  {
    files: ['vite.config.ts'],
    languageOptions: { globals: { ...globals.node } }
  }
)
