import { defineConfig } from '@playwright/test';

// Both projects use the same site pipeline. Resource tests exercise the existing
// local save adapter; account tests additionally need an isolated MySQL/API.
const origin = process.env.GARDEN_E2E_ORIGIN ?? 'http://localhost:5194';
const resourceOrigin = process.env.RESOURCE_TEST_ORIGIN ?? origin;
const external = !!(process.env.GARDEN_E2E_ORIGIN || process.env.RESOURCE_TEST_ORIGIN);
const productionOrigin = process.env.RESOURCE_PRODUCTION_ORIGIN ?? 'http://localhost:5195';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 60000,
  reporter: 'list',
  outputDir:
    process.env.GARDEN_E2E_OUTPUT ?? process.env.RESOURCE_TEST_OUTPUT ?? '../.workbench/e2e',
  use: {
    headless: true,
    launchOptions: process.env.GARDEN_CHROMIUM_PATH
      ? { executablePath: process.env.GARDEN_CHROMIUM_PATH }
      : {},
  },
  webServer: [
    ...(process.env.GARDEN_E2E_PREVIEW_START === '1'
      ? [
          {
            command: 'npm run preview:garden-site -w web -- --host localhost --port 5195',
            cwd: '..',
            url: productionOrigin,
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
          },
        ]
      : []),
    ...(!external
      ? [
          {
            command: 'npm run dev -w web -- --host localhost --port 5194',
            cwd: '..',
            url: origin,
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
          },
        ]
      : []),
    ...(process.env.GARDEN_E2E_START === '1'
      ? [
          {
            command: 'npm run start:garden-site -w server',
            cwd: '..',
            url: 'http://localhost:3009/api/ready',
            reuseExistingServer: !process.env.CI,
            env: { PUBLIC_ORIGIN: origin },
          },
        ]
      : []),
  ],
  projects: [
    { name: 'accounts', testMatch: 'garden.spec.ts', use: { baseURL: origin } },
    {
      name: 'resources',
      testMatch: [
        'resources.spec.ts',
        'loading-presentation.spec.ts',
        'dew.spec.ts',
        'refactor.spec.ts',
      ],
      use: { baseURL: resourceOrigin },
    },
  ],
});
