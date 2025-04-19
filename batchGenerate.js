const fs = require("fs");
const path = require("path");

function batchGenerate() {
  const baseDir = path.join(__dirname, "components");
  const batchDirs = fs
    .readdirSync(baseDir)
    .filter((name) => {
      const fullPath = path.join(baseDir, name);
      return name.startsWith("batch") && fs.statSync(fullPath).isDirectory();
    })
    .sort();

  const batches = {};

  for (const batchName of batchDirs) {
    const batchPath = path.join(baseDir, batchName);
    const components = fs
      .readdirSync(batchPath)
      .filter((entry) => fs.statSync(path.join(batchPath, entry)).isDirectory())
      .sort(); // alphabetical order, guarantees stable port mapping

    batches[batchName] = {
      components,
      tag: `@${batchName}`,
      resultsFile: `results_${batchName}.json`,
    };
  }

  return batches;
}

module.exports = { batchGenerate };
