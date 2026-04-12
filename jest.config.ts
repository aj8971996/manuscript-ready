import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'engine',
      testEnvironment: 'node',
      roots: ['<rootDir>/src/engine'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      transform: {
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
      },
    },
  ],
};

export default config;