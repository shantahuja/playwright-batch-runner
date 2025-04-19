// @ts-check
const { defineConfig, devices } = require("@playwright/test");

// Use an environment variable for webhook to avoid leaking sensitive data
const teamsWebhook = process.env.TEAMS_WEBHOOK_URL || "";

module.exports = defineConfig({
  use: {
    baseURL: "http://127.0.0.1",
    headless: false,
    screenshot: "only-on-failure",
    video: { mode: "retain-on-failure" },
    trace: { mode: "retain-on-failure" },
    outputDir: "/srv/test-results",
  },
  testMatch: ["tests/**/*.spec.js"],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["json", { outputFile: "results.json" }]],
  teams: {
    webhook_url: teamsWebhook,
    debug: true,
  },
  timeout: 60000,
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
  ],
});
