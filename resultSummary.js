const fs = require("fs");
const path = require("path");

function summarizeResults(resultsPath = "./final_results.json") {
  if (!fs.existsSync(resultsPath)) {
    console.error(`❌ Results file not found at ${resultsPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(resultsPath, "utf-8");
  const results = JSON.parse(rawData);

  console.log("\n\ud83d\udccb TEST SUMMARY\n-----------------------------");

  const suiteStatsMap = new Map();

  results.suites.forEach((suite) => {
    processSuite(suite, suiteStatsMap);
  });

  for (const [suiteName, stats] of suiteStatsMap.entries()) {
    const hasFailures = stats.failed > 0 || stats.timedOut > 0;
    const hasSkips = stats.skipped > 0;
    const hasPasses = stats.passed > 0 && !hasFailures && !hasSkips;
    const hasRetries = stats.retries.length > 0;
    const hasOther = stats.otherStatuses.length > 0;

    if (hasFailures || hasRetries || hasSkips || hasOther || hasPasses) {
      console.log(
        `${
          hasFailures ? "❌" : hasPasses ? "✅" : hasSkips ? "⏭️" : "🚧"
        } ${suiteName}`
      );
    }

    stats.failures.forEach((failure) => {
      const symbol = failure.status === "timedOut" ? "⏳" : "❌";
      console.log(`    ↳ ${symbol} [${failure.project}] ${failure.error}`);
    });

    stats.retries.forEach((retry) => {
      console.log(
        `    ↳ 🔄 [${retry.project}] Retried ${retry.attempts} times (Final Status: ${retry.finalStatus})`
      );
    });

    stats.skippedTests.forEach((testName) => {
      console.log(`    ↳ ⏭️ ${testName}`);
    });

    stats.otherStatuses.forEach((other) => {
      console.log(`    ↳ 🚧 [${other.status}] ${other.testName}`);
    });
  }

  console.log("-----------------------------\n");
}

function processSuite(suite, suiteStatsMap) {
  if (suite.suites) {
    suite.suites.forEach((childSuite) => {
      const suiteTitle = childSuite.title || "Unnamed Suite";

      if (!suiteStatsMap.has(suiteTitle)) {
        suiteStatsMap.set(suiteTitle, {
          passed: 0,
          failed: 0,
          timedOut: 0,
          skipped: 0,
          passedTests: [],
          skippedTests: [],
          failures: [],
          retries: [],
          otherStatuses: [],
        });
      }

      const stats = suiteStatsMap.get(suiteTitle);

      if (childSuite.specs) {
        childSuite.specs.forEach((spec) => {
          spec.tests.forEach((test) => {
            const attempts = test.results.length;
            const lastResult = test.results[attempts - 1];

            if (lastResult.status === "passed") {
              stats.passed++;
              stats.passedTests.push(spec.title);
            } else if (lastResult.status === "timedOut") {
              stats.failed++;
              stats.timedOut++;
              stats.failures.push({
                project: test.projectName || "Unknown",
                status: "timedOut",
                error:
                  lastResult.error?.message ||
                  lastResult.errors?.[0]?.message ||
                  "Unknown timeout error",
              });
            } else if (lastResult.status === "failed") {
              stats.failed++;
              stats.failures.push({
                project: test.projectName || "Unknown",
                status: "failed",
                error:
                  lastResult.error?.message ||
                  lastResult.errors?.[0]?.message ||
                  "Unknown failure",
              });
            } else if (lastResult.status === "skipped") {
              stats.skipped++;
              stats.skippedTests.push(spec.title);
            } else {
              stats.otherStatuses.push({
                testName: spec.title,
                status: lastResult.status || "unknown",
              });
            }

            // Handle retries (flaky tests)
            if (attempts > 1) {
              stats.retries.push({
                project: test.projectName || "Unknown",
                attempts,
                finalStatus: lastResult.status,
              });
            }
          });
        });
      }

      if (childSuite.suites) {
        processSuite(childSuite, suiteStatsMap);
      }
    });
  }
}

// If called directly
if (require.main === module) {
  const resultsFile = process.argv[2] || "./final_results.json";
  summarizeResults(resultsFile);
}

module.exports = { summarizeResults };
