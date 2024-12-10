import globals from 'globals';
import pluginJs from '@eslint/js';
import stylisticJs from '@stylistic/eslint-plugin-js';

export default [
  pluginJs.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
      ecmaVersion: 'latest',
    },
    plugins: {
      '@stylistic/js': stylisticJs,
    },
    rules: {
      eqeqeq: 'error',
      'arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/js/linebreak-style': ['error', 'unix'],
      'object-curly-spacing': ['error', 'always'],
      '@stylistic/js/semi': ['error', 'always'],
      'no-trailing-spaces': 'error',
    },
  },
];
