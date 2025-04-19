const fs = require("fs");
const path = require("path");

function findPortForComponent(name) {
  const componentsDir = path.join(__dirname, "../components");
  const batchFolders = fs.readdirSync(componentsDir);

  for (const batchName of batchFolders) {
    const batchPath = path.join(componentsDir, batchName);
    const stat = fs.statSync(batchPath);
    if (!stat.isDirectory()) continue;

    const components = fs.readdirSync(batchPath).sort(); // sort for consistent port indexing
    const index = components.indexOf(name);
    if (index !== -1) {
      return 8081 + index;
    }
  }

  // for error handling
  const allComponents = batchFolders.flatMap((batchName) => {
    const batchPath = path.join(componentsDir, batchName);
    try {
      return fs.readdirSync(batchPath).filter((f) => {
        return fs.statSync(path.join(batchPath, f)).isDirectory();
      });
    } catch {
      return [];
    }
  });

  throw new Error(
    `Component "${name}" not found. Valid options: ${allComponents.join(", ")}`
  );
}

async function goto(
  page,
  componentName,
  timeout = process.env.CI ? 45000 : 30000
) {
  const browserType = page.context().browser().browserType().name();

  const port = findPortForComponent(componentName);
  const url = `http://localhost:${port}/`;

  if (!browserType) throw new Error("Browser type is not defined!");

  try {
    await page.goto(url, { timeout });
    await page.waitForLoadState("load", { timeout });

    if (browserType === "webkit" && page.url() === "about:blank") {
      console.log("Retrying due to about:blank in WebKit...");
      await page.waitForTimeout(5000);
      await page.goto(url, { timeout });
      await page.waitForLoadState("load", { timeout });
    }
  } catch (err) {
    console.log(`Error loading page: ${err.message}`);
    throw err;
  }
}

module.exports = goto;
