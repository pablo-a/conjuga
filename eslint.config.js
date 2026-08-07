import js from '@eslint/js'
import prettier from '@vue/eslint-config-prettier'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default defineConfigWithVueTs(
  { ignores: ['dist/**', 'dev-dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Le moteur de conjugaison manipule des unions de chaînes exhaustives ; une variable
      // inutilisée y est presque toujours un vrai oubli, sauf préfixée par _.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'vue/multi-word-component-names': 'off',
    },
  },
  prettier,
)
