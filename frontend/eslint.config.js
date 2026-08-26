import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // Los .ts/.tsx quedaban FUERA del linter: eslint los saltaba con "File
  // ignored because no matching configuration was supplied". Por eso un
  // <Package /> sin importar en CheckoutModal.tsx no lo vio nadie hasta que
  // reventó en el navegador con la pantalla en blanco.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // El de TypeScript entiende los tipos; el de base da falsos positivos.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Este es el que atrapa el icono sin importar.
      'no-undef': 'error',
      // Los `any` que ya estaban son estilo, no errores. Encenderlos ahora
      // agrega 19 quejas que tapan las que si importan y terminan haciendo
      // que nadie mire la salida del linter.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
