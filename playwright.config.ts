import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/studio',
    reuseExistingServer: false,
    env: { SVG_STUDIO_FAKE: '1' },
    timeout: 120_000,
  },
})
