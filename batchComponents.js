const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const stoppedPorts = new Set();
const { batchGenerate } = require("./batchGenerate");
const { summarizeResults } = require("./resultSummary");
const batches = batchGenerate();
const isBatch = process.env.IS_BATCH;
const batchNumber = process.env.BATCH_NUMBER;

function waitForService(url, retries = 30, delay = 1000) {
  console.log(`⏳ Waiting for service at ${url} to be available...`);
  return new Promise((resolve, reject) => {
    (async function check(attempt = 1) {
      try {
        console.log(`Checking service status at ${url}, attempt ${attempt}`);
        execSync(`curl -s --head --request GET ${url} | grep "200 OK"`, {
          stdio: "ignore",
        });
        console.log(`✅ Service at ${url} is responding.`);
        resolve();
      } catch {
        if (attempt < retries) {
          console.log(
            `⏳ Waiting for service ${url}... (${attempt}/${retries})`
          );
          setTimeout(() => check(attempt + 1), delay);
        } else {
          console.error(
            `❌ Service at ${url} did not become available in time.`
          );
          reject(
            new Error(`❌ Service at ${url} did not become available in time.`)
          );
        }
      }
    })();
  });
}

async function stopBatch(ports) {
  const newPorts = ports.filter((port) => !stoppedPorts.has(port));
  if (newPorts.length === 0) {
    console.log("♻️ All specified ports already stopped. Skipping cleanup.");
    return;
  }

  console.log(`🔪 Stopping processes on ports: ${newPorts.join(", ")}...`);

  const isCI = process.env.CI;

  newPorts.forEach((port) => {
    try {
      console.log(`🛠 Checking if port ${port} is in use...`);

      const command = isCI
        ? `ss -tulnp | grep ":${port} " | awk '{print $7}' | cut -d',' -f2 | cut -d'=' -f2`
        : `lsof -ti :${port} || true`;

      const pids = execSync(command, { encoding: "utf8" })
        .split("\n")
        .filter(Boolean);

      if (pids.length > 0) {
        console.log(`🔴 Found processes on port ${port}: ${pids.join(", ")}`);
        execSync(`kill -9 ${pids.join(" ")}`, { stdio: "inherit" });
      } else {
        console.log(`✅ No processes found on port ${port}.`);
      }
    } catch (error) {
      console.warn(
        `⚠️ Failed to check or kill process on port ${port}: ${error.message}`
      );
    }
  });

  console.log("⏳ Waiting for ports to be completely released...");
  let retries = 10;
  while (retries > 0) {
    const inUsePorts = newPorts.filter((port) => {
      try {
        return execSync(
          isCI
            ? `ss -tulnp 2>/dev/null | grep ":${port} " || true`
            : `lsof -i :${port} || true`
        )
          .toString()
          .trim();
      } catch {
        return false;
      }
    });

    if (inUsePorts.length === 0) {
      console.log(`✅ All ports are now fully free.`);
      break;
    }

    console.log(
      `⏳ Ports still in use: ${inUsePorts.join(", ")}... retrying in 1 second.`
    );
    retries--;
    execSync("sleep 1");
  }

  if (retries === 0) {
    console.warn(
      `⚠️ Some ports are still in use after waiting. This may cause issues.`
    );
  }

  newPorts.forEach((port) => stoppedPorts.add(port)); // ✅ mark as stopped

  console.log(
    "⏳ **Waiting 5 seconds before starting the next batch to ensure full cleanup...**"
  );
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

async function startBatch(batchNumber, components, ports) {
  console.log(
    `🔹 Starting batch: ${batchNumber} - Components: ${components.join(", ")}`
  );

  const processes = components.map((component, index) => {
    const port = ports[index]; // get corresponding port

    console.log(`🚀 Starting component: ${component} on port ${port}`);

    const proc = spawn(
      "npx",
      [
        "lerna",
        "exec",
        "--stream",
        "--scope",
        component,
        "--",
        // inject PORT into the command
        `PORT=${port}`,
        "pnpm",
        "run",
        "start",
      ],
      { shell: true }
    );

    return new Promise((resolve, reject) => {
      let logBuffer = "";

      const startTimeout = setTimeout(() => {
        console.error(`❌ ${component} timed out after 90 seconds`);
        proc.kill();
        reject(new Error(`${component} timed out and was killed.`));
      }, 90000);

      proc.stdout.on("data", (data) => {
        const output = data.toString();
        logBuffer += output;
        console.log(`[${component} LOG] ${output.trim()}`);

        if (
          logBuffer.includes("[webpack.Progress] 100%") ||
          logBuffer.includes("compiled successfully")
        ) {
          clearTimeout(startTimeout);
          console.log(`✅ ${component} is fully ready!`);
          resolve();
        }
      });

      proc.stderr.on("data", (data) => {
        const errorOutput = data.toString();
        if (
          errorOutput.includes("Error") ||
          errorOutput.includes("failed") ||
          errorOutput.includes("exception")
        ) {
          console.error(`❌ [${component} ERROR] ${errorOutput.trim()}`);
        } else {
          console.log(`[${component} LOG] ${errorOutput.trim()}`);
        }
      });

      proc.on("exit", (code) => {
        if (
          !logBuffer.includes("[webpack.Progress] 100%") &&
          !logBuffer.includes("compiled successfully")
        ) {
          console.error(
            `❌ ${component} exited unexpectedly with code ${code}`
          );
          reject(new Error(`${component} failed to fully start`));
        }
        console.log(`🛑 ${component} process fully exited.`);
      });
    });
  });

  await Promise.all(processes);

  // Reintroduce waiting for the services to be available
  await Promise.all(
    ports.map((port) => waitForService(`http://localhost:${port}`))
  );
}

async function runTestsAsync(batchNumber, batch) {
  console.log(
    `🚀 Running Playwright tests for ${batch.tag} across all browsers...`
  );

  const isCI = process.env.CI;
  const xvfbPrefix = isCI ? "xvfb-run --auto-servernum " : "";
  const headedFlag = !isCI ? "--headed" : "";
  const resultsFilePath = `results_${batchNumber}.json`;
  let hasTestFailures = false;

  const command = `${xvfbPrefix}npx playwright test --grep ${batch.tag} \
--project=chromium --project=firefox --project=webkit \
${headedFlag} --workers=3 --reporter=json \
--output=test-results/${batchNumber}`.trim();

  try {
    console.log(`🧪 Running command: ${command}`);
    const testResult = execSync(command, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    fs.writeFileSync(resultsFilePath, testResult);
    console.log(`✅ Test results saved to ${resultsFilePath}`);
  } catch (error) {
    console.error(`❌ Test execution failed for ${batch.tag}:`, error.message);

    if (error.stdout) {
      console.log("🔍 Full Playwright Output (stdout):\n", error.stdout);

      try {
        if (error.stdout && error.stdout.trim().startsWith("{")) {
          fs.writeFileSync(resultsFilePath, error.stdout);
        } else {
          console.warn(`⚠️ stdout is not valid JSON. Skipping write.`);
        }
        console.log(
          `⚠️ Partial test results saved to ${resultsFilePath} despite failure.`
        );
      } catch (writeError) {
        console.error("🚨 Failed to write test results:", writeError.message);
      }

      try {
        const resultData = JSON.parse(error.stdout);
        if (resultData.stats && resultData.stats.unexpected > 0) {
          console.log(
            "🔴 Actual test failure detected. Merging results before marking build as failed."
          );
          hasTestFailures = true;
        } else {
          console.log(
            "⚠️ No actual test failures detected. Likely a non-test error, continuing..."
          );
        }
      } catch (parseError) {
        console.log("⚠️ Failed to parse test results, continuing execution...");
      }
    } else {
      console.log("🚨 No output from Playwright. Possible hard failure.");
      hasTestFailures = true;
    }
  }

  return hasTestFailures;
}

async function runAllBatches() {
  let overallTestFailures = false;

  for (const batchKey of Object.keys(batches)) {
    const batch = batches[batchKey];

    console.log(`🟢 Starting ${batchKey} components...`);
    const ports = batch.components.map((_, i) => 8081 + i);
    await startBatch(batchKey, batch.components, ports);

    const batchFailure = await runTestsAsync(batchKey, batch);
    if (batchFailure) {
      overallTestFailures = true;
    }
    await stopBatch(ports);
  }

  return overallTestFailures;
}

async function runSingularBatch() {
  let overallTestFailures = false;
  const batchKey = `batch${batchNumber}`; // 🔥 Translate "2" -> "batch2"

  if (!batches[batchKey]) {
    console.error(`❌ Batch ${batchKey} not found in batch definitions.`);
    console.log(`📦 Available batches: ${Object.keys(batches).join(", ")}`);
    process.exit(1);
  }

  const batch = batches[batchKey];
  const ports = batch.components.map((_, i) => 8081 + i);

  console.log(`🟢 Starting singular batch: ${batchKey} components...`);
  await startBatch(batchKey, batch.components, ports);

  const batchFailure = await runTestsAsync(batchKey, batch);
  if (batchFailure) {
    overallTestFailures = true;
  }

  await stopBatch(ports);

  return overallTestFailures;
}

function mergeResults() {
  try {
    const resultFiles = fs
      .readdirSync(".")
      .filter(
        (file) => file.startsWith("results_batch") && file.endsWith(".json")
      );

    if (resultFiles.length === 0) {
      console.warn(
        "⚠️ No test result files found. Skipping final_results.json generation."
      );
      return;
    }

    console.log(`🔍 Found test result files: ${resultFiles.join(", ")}`);

    let mergedResults = {
      config: {},
      suites: [],
      stats: {
        expected: 0,
        skipped: 0,
        unexpected: 0,
        flaky: 0,
        duration: 0,
        startTime: Date.now(),
      },
    };

    resultFiles.forEach((file, index) => {
      try {
        const rawData = fs.readFileSync(file, "utf8").trim();
        if (!rawData) {
          console.warn(`⚠️ Skipping empty test result file: ${file}`);
          return;
        }

        const parsedData = JSON.parse(rawData);
        console.log(`🔍 Merging results from: ${file}`);

        // Merge the config section only from the first file
        if (index === 0 && parsedData.config) {
          mergedResults.config = { ...parsedData.config };
        }

        // Merge suites
        if (parsedData.suites && Array.isArray(parsedData.suites)) {
          mergedResults.suites.push(...parsedData.suites);
        }

        // Merge stats
        if (parsedData.stats) {
          mergedResults.stats.expected += parsedData.stats.expected || 0;
          mergedResults.stats.skipped += parsedData.stats.skipped || 0;
          mergedResults.stats.unexpected += parsedData.stats.unexpected || 0;
          mergedResults.stats.flaky += parsedData.stats.flaky || 0;
          mergedResults.stats.duration += parsedData.stats.duration || 0;

          // Take the earliest start time
          if (
            index === 0 ||
            parsedData.stats.startTime < mergedResults.stats.startTime
          ) {
            mergedResults.stats.startTime = parsedData.stats.startTime;
          }
        }
      } catch (error) {
        console.error(`⚠️ Failed to process ${file}:`, error);
      }
    });

    // Check if suites array is populated correctly before calling map
    if (mergedResults.suites.length === 0) {
      console.warn("⚠️ No suites found in the merged results.");
    }

    // Save merged results to a final file
    fs.writeFileSync(
      "final_results.json",
      JSON.stringify(mergedResults, null, 2)
    );
    console.log("✅ Merged results saved to final_results.json");
  } catch (error) {
    console.error("⚠️ Failed to merge test results:", error);
  }
}

(async () => {
  let hasTestFailures = false;

  try {
    if (isBatch === "BATCH") {
      hasTestFailures = await runSingularBatch();
    } else {
      hasTestFailures = await runAllBatches();
    }
  } catch (error) {
    console.error(`❌ Critical error encountered:`, error);
    hasTestFailures = true;
  } finally {
    const allPorts = Object.values(batches).flatMap((batch) =>
      batch.components.map((_, i) => 8081 + i)
    );
    await stopBatch(allPorts);
    mergeResults();
    summarizeResults();
    if (hasTestFailures) {
      console.log("❌ Some tests failed.");
    } else {
      console.log("✅ All tests passed.");
    }
    process.exit(hasTestFailures ? 1 : 0);
  }
})();
