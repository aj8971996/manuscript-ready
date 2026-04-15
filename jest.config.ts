import type { Config } from 'jest';

const tsJestTransform = {
  '^.+\\.tsx?$': [
    'ts-jest',
    {
      tsconfig: {
        target: 'ES2022',
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        strict: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        noFallthroughCasesInSwitch: true,
        skipLibCheck: true,
        types: ['jest', 'node'],
      },
    },
  ],
};

const config: Config = {
  projects: [
    {
      displayName: 'engine',
      testEnvironment: 'node',
      roots: ['<rootDir>/src/engine'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      transform: tsJestTransform,
    },
    {
      displayName: 'validation',
      testEnvironment: 'node',
      roots: ['<rootDir>/src/validation'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      transform: tsJestTransform,
    },
    {
      displayName: 'app-pure',
      testEnvironment: 'node',
      roots: ['<rootDir>/app', '<rootDir>/src/app-lib'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      transform: tsJestTransform,
    },
    {
      displayName: 'app-rn',
      preset: 'jest-expo',
      roots: ['<rootDir>/app', '<rootDir>/src/app-lib/ui'],
      testMatch: ['**/__tests__/**/*.test.tsx'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop))',
      ],
    },
  ],
};

export default config;