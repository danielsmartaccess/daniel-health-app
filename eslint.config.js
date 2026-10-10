import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    // Legado do health app (single-file) fica fora do lint do monorepo.
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'sw.js', 'saude-app.html'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['server/**/*.ts', 'shared/**/*.ts', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['client/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // O domínio puro não pode depender de relógio nem de React (tempo entra como parâmetro).
    files: ['shared/src/**/*.ts'],
    ignores: ['shared/src/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Domínio puro: receba `now` como parâmetro, não use Date.now().',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Domínio puro: receba `now` como parâmetro, não use new Date() sem argumento.',
        },
      ],
      'no-restricted-imports': ['error', { patterns: ['react', 'react-dom', 'react/*'] }],
    },
  },
  prettier,
);
