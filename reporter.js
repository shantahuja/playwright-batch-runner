const axios = require("axios");
const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");

class Reporter {
  constructor(options = {}) {
    this.webhook_url = options.webhook_url;
    this.channel = options.channel;
    this.debug = options.debug || false;
  }

  async sendTestResults(testResults) {
    if (this.debug) {
      console.log(
        "Reporting version:",
        process.env.BUILD_VERSION ||
          (await this.getVersionFromPom()) ||
          "Unknown version"
      );
    }
    const results = this.processTestResults(testResults);
    const duration = this.formatDuration(results.totalDuration || 0);
    const successRate = ((results.passed / results.total) * 100).toFixed(2);
    const hasUnresolvedFailures = results.retriedTests.some(
      (test) => test.finalStatus !== "passed"
    );
    const status =
      results.failed > 0 || hasUnresolvedFailures ? "❌ FAILED" : "✅ PASSED";
    const timestamp = new Date().toLocaleString("en-US");

    const version =
      process.env.BUILD_VERSION ||
      (await this.getVersionFromPom()) ||
      "Unknown version";
    const buildUrl = process.env.BUILD_URL
      ? decodeURIComponent(process.env.BUILD_URL)
      : "https://env-build-url-unresolved.com";
    const isBatch = process.env.IS_BATCH
      ? `Batch ${process.env.BATCH_NUMBER} run`
      : "";
    const upstreamBranch = process.env.UPSTREAM_BRANCH || "N/A";
    const buildNumberUp = process.env.BUILD_NUMBER_UP || "Unknown";
    const buildNumberDown = process.env.BUILD_NUMBER_DOWN || "Unknown";
    const buildCause = process.env.BUILD_CAUSE || "Unknown";
    const commitAuthor = process.env.COMMIT_AUTHOR || "Unknown";
    const commitEmail = process.env.COMMIT_EMAIL || "Unknown";
    const commitMessage = process.env.COMMIT_MESSAGE || "Unknown";
    const nodeVersion = process.version;
    const opsys = `${process.platform} ${process.arch}`;
    const workers = testResults.config.workers || "Unknown";
    const projects = testResults.config.projects
      ? testResults.config.projects.map((p) => p.name).join(", ")
      : "Unknown";

    // Handle slow tests
    const slowTestsDetails = results.slowTests.map((test) => {
      const projectName = test.projectName || "Unknown Project";

      return {
        type: "TextBlock",
        text: `**${test.title}** (${this.formatDuration(
          test.duration
        )}) - Project: ${projectName}`,
        size: "Small",
        wrap: true,
      };
    });

    const skippedTestsDetails = results.skippedTests.map((test) => ({
      type: "TextBlock",
      text: `*${test.title}* - Project: ${test.project}`,
      size: "Small",
      wrap: true,
    }));

    // Handle per-suite grouped failures
    const suitesSummary = Array.from(results.suites.entries()).map(
      ([suiteName, stats]) => {
        const hasFailures = stats.failed > 0;

        const items = [
          {
            type: "TextBlock",
            text: `**${suiteName}** ${hasFailures ? "❌" : "✅"}`,
          },
          ...(Array.isArray(stats.failures) ? stats.failures : []).map(
            (failure) => ({
              type: "TextBlock",
              text: `↳ ❌[${failure.project}] ${this.truncateText(
                failure.error
              )}`,
              size: "Small",
              weight: "Default",
              wrap: true,
            })
          ),
          ...(Array.isArray(stats.retries) ? stats.retries : []).map(
            (retry) => ({
              type: "TextBlock",
              text: `↳ 🔄[${retry.project}] Retried ${retry.attempts} times`,
              size: "Small",
              weight: "Default",
              wrap: true,
            })
          ),
        ];

        return {
          type: "Container",
          items,
        };
      }
    );

    const message = {
      channel: this.channel,
      username: "Reporter",
      text: "Seismic Master Test Report",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            type: "AdaptiveCard",
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            version: "1.4",
            body: [
              {
                type: "Container",
                items: [
                  {
                    type: "TextBlock",
                    text: `Seismic Master Test Report #${buildNumberDown} - ${status} *${isBatch}*`,
                    weight: "Bolder",
                    size: "Medium",
                  },
                  {
                    type: "TextBlock",
                    text: `Version: ${version}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Duration: ${duration}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: "### Test Statistics",
                    weight: "Bolder",
                    size: "Medium",
                  },
                  {
                    type: "TextBlock",
                    text: `Total Tests: ${results.total} 📜`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Passed: ${results.passed} ✅`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Failed: ${results.failed} ❌`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Skipped: ${results.skipped} ⏭️`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Flaky: ${results.flaky} 🔄`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Success Rate: ${successRate}%`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: "### Summary",
                    weight: "Bolder",
                    size: "Medium",
                  },
                  {
                    type: "TextBlock",
                    text: `Build Cause: ${buildCause}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Commit Author: @${commitAuthor}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Commit Email: ${commitEmail}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Commit Message: ${commitMessage}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Upstream Build Number: ${buildNumberUp}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Upstream Branch: ${upstreamBranch}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Timestamp: ${timestamp}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: "### Environment",
                    weight: "Bolder",
                    size: "Medium",
                  },
                  {
                    type: "TextBlock",
                    text: `Node Version: ${nodeVersion}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Operating System: ${opsys}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Workers: ${workers}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `Projects: ${projects}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: "### Skipped Tests",
                    weight: "Bolder",
                    size: "Medium",
                  },
                  ...skippedTestsDetails,
                  {
                    type: "TextBlock",
                    text: "### Slow Tests",
                    weight: "Bolder",
                    size: "Medium",
                  },
                  ...slowTestsDetails,
                  {
                    type: "TextBlock",
                    text: "### Suites Summary",
                    weight: "Bolder",
                    size: "Medium",
                  },
                  ...suitesSummary,
                ],
              },
            ],
            actions: [
              {
                type: "Action.OpenUrl",
                title: "View Full Report",
                url: buildUrl,
              },
            ],
          },
        },
      ],
    };

    try {
      await axios.post(this.webhook_url, message);
      console.log("Successfully sent message to Teams");
    } catch (error) {
      console.error("Failed to send message to Teams:", error);
    }

    // Adjust the failure check for more control over the exit logic
    if (results.failed > 0 || hasUnresolvedFailures) {
      console.error(`❌ Build failed: ${results.failed} test failures.`);
      setTimeout(() => process.exit(1), 5000); // This forces an exit with failure code if there are failures or unresolved retries
    } else {
      console.log(`✅ All tests passed.`);
      process.exit(0); // Exit successfully if no test failures and no unresolved retries
    }
  }

  processTestResults(results) {
    const processedResults = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
      failedTests: [],
      skippedTests: [],
      slowTests: [],
      retriedTests: [],
      suites: new Map(),
      totalDuration: 0,
    };

    const processSuite = (suite) => {
      const suiteTitle = suite.title;
      let suiteName = "Unnamed Suite";

      if (suiteTitle) {
        const parts = suiteTitle.split(" → ");
        if (parts.length === 2) {
          const batchName = parts[0].trim();
          const testName = path.basename(parts[1], ".spec.js").trim();
          suiteName = `${batchName} → ${testName}`;
        } else {
          suiteName = path.basename(suiteTitle, ".spec.js");
        }
      }

      suite.specs?.forEach((spec) => {
        spec.tests?.forEach((test) => {
          processedResults.total++;
          const lastResult = test.results[test.results.length - 1];
          processedResults.totalDuration += lastResult.duration;

          const projectName = test.projectName || "Unknown Project";

          // Ensure projectName is included in processed results
          if (!processedResults.suites.has(suiteName)) {
            processedResults.suites.set(suiteName, {
              total: 0,
              passed: 0,
              failed: 0,
              skipped: 0,
              retried: 0,
            });
          }

          const suiteStats = processedResults.suites.get(suiteName);
          suiteStats.total++;

          if (lastResult.status === "passed") {
            processedResults.passed++;
            suiteStats.passed++;
          } else if (
            lastResult.status === "failed" ||
            lastResult.status === "timedOut"
          ) {
            processedResults.failed++;
            suiteStats.failed++;
            suiteStats.failures = suiteStats.failures || [];
            suiteStats.failures.push({
              project: projectName,
              title: spec.title,
              error: lastResult.error?.message || "No error message provided",
              file: spec.file || "unknown",
              line: lastResult.error?.location?.line || 0,
              status: lastResult.status,
            });
          } else if (lastResult.status === "skipped") {
            processedResults.skipped++;
            suiteStats.skipped++;

            processedResults.skippedTests.push({
              title: spec.title,
              project: projectName,
              file: spec.file || "unknown",
              line: spec.line || 0,
            });
          }

          // Handle retries (flaky tests)
          if (test.results.length > 1) {
            processedResults.flaky++;
            suiteStats.retried++;

            if (!suiteStats.retries) {
              suiteStats.retries = [];
            }
            suiteStats.retries.push({
              project: projectName,
              title: spec.title,
              attempts: test.results.length,
              finalStatus: lastResult.status,
              file: spec.file || "unknown",
              line: spec.line || 0,
            });

            processedResults.retriedTests.push({
              title: spec.title,
              attempts: test.results.length,
              finalStatus: lastResult.status,
              location: { file: spec.file, line: spec.line },
              projectName: projectName,
            });
          }

          // Handle slow tests
          if (lastResult.duration > 5000) {
            processedResults.slowTests.push({
              title: suite.title,
              duration: lastResult.duration,
              location: { file: spec.file, line: spec.line },
              projectName: projectName,
            });
          }
        });
      });

      suite.suites?.forEach((childSuite) => processSuite(childSuite));
    };

    results.suites.forEach((suite) => processSuite(suite));
    return processedResults;
  }

  async getVersionFromPom() {
    const pomPath = path.resolve(__dirname, "pom.xml");
    if (fs.existsSync(pomPath)) {
      const pomData = fs.readFileSync(pomPath, "utf8");
      return new Promise((resolve, reject) => {
        xml2js.parseString(pomData, (err, result) => {
          if (err) return reject("Unknown version");
          resolve(result.project.version[0]);
        });
      });
    }
    return "Unknown version";
  }

  formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  truncateText(text, maxLength = 400) {
    if (!text) return "";
    return text.length > maxLength
      ? text.slice(0, maxLength) + " ...[truncated]"
      : text;
  }
}

module.exports = Reporter;
