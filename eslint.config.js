// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'node_modules/*'],
  },
  {
    files: ['src/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react-native',
                'react-native/*',
                'expo',
                'expo-*',
                '@expo/*',
                'react',
                'react/*',
              ],
              message:
                'src/engine must stay pure. No React, React Native, or Expo imports allowed here — the engine is the portable, testable core with zero platform dependencies.',
            },
          ],
        },
      ],
    },
  },
]);