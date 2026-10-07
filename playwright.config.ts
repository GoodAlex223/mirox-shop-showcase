import { defineConfig, devices } from "@playwright/test";

const IS_CI = !!process.env.CI;
const PORT = process.env.PORT || (IS_CI ? 3000 : 3001);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: require.resolve("./tests/global-setup"),
  fullyParallel: IS_CI,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 1 : 2,
  // In CI, "github" annotates failures inline on the PR but writes nothing to
  // disk — so the ci.yml "Upload Playwright report" step had no fresh output to
  // collect. Pair it with the html reporter so that artifact is a real report of
  // the run. `open: "never"` keeps it from trying to launch a browser on the runner.
  reporter: IS_CI ? [["github"], ["html", { open: "never" }]] : "html",
  timeout: IS_CI ? 30000 : 60000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: IS_CI ? 15000 : 45000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],
  webServer: {
    // CI: app is already built in previous CI step, just start the server
    // Local: start dev server with HMR
    command: IS_CI ? `npm run start -- --port ${PORT}` : `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: IS_CI ? 180 * 1000 : 120 * 1000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
