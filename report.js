// report.js
const fs = require("fs");
const path = require("path");

const config = require("./playwright.config");
const Reporter = require("./reporter");

const resultsPath = path.resolve(__dirname, "./final_results.json");

async function sendResults() {
  if (!fs.existsSync(resultsPath)) {
    throw new Error(`❌ File not found: ${resultsPath}`);
  }

  const rawData = fs.readFileSync(resultsPath, "utf8");
  const results = JSON.parse(rawData);

  const reporter = new Reporter({
    webhook_url: config.teams.webhook_url,
    debug: config.teams.debug,
  });

  await reporter.sendTestResults(results);
}

sendResults().catch((err) => {
  console.error("❌ Error in sendResults:", err);
  process.exit(1);
});
