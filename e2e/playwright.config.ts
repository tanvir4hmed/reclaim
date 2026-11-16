import { defineConfig, devices } from '@playwright/test';

const port = 5173;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // Live 3D in every card is heavy; two workers keep the dev server and GPU emulation responsive.
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'off',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
    {
      name: 'reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],
  webServer: {
    command: 'npm --prefix ../web run dev -- --port 5173 --strictPort',
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
