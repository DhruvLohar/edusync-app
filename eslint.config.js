/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'modules/**/*', 'android/**/*', 'ios/**/*'],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
]);
