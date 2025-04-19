const { resolve } = require("path");
const fs = require("fs");

function getDirectories(path) {
  return fs.readdirSync(path).filter((file) => {
    return fs.statSync(`${path}/${file}`).isDirectory();
  });
}

const batchDirectories = getDirectories(`./components`);
const targetVersion = process.argv[2];
const targetPrefix = process.argv[3]; // e.g. '@your-scope/ui-' or 'ui-'

if (!targetVersion || !targetPrefix) {
  console.error("\n❌ Usage: node bumpDependencies.js <version> <prefix>\n");
  process.exit(1);
}

function updateDepsSection(section, newVersion) {
  if (!section) return section;
  return Object.fromEntries(
    Object.entries(section).map(([dep, version]) => [
      dep,
      dep.startsWith(targetPrefix) ? newVersion : version,
    ])
  );
}

function updatePackageJson(newVersion, packagePath) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const originalDeps = pkg.dependencies || {};
  const originalDevDeps = pkg.devDependencies || {};

  const updatedDeps = updateDepsSection(originalDeps, newVersion);
  const updatedDevDeps = updateDepsSection(originalDevDeps, newVersion);

  const updatedPackage = {
    ...pkg,
    dependencies: updatedDeps,
    devDependencies: updatedDevDeps,
  };

  fs.writeFileSync(packagePath, JSON.stringify(updatedPackage, null, 2) + "\n");

  const allUpdated = { ...updatedDeps, ...updatedDevDeps };
  const updatedList = Object.entries(allUpdated)
    .filter(([dep]) => dep.startsWith(targetPrefix))
    .map(([dep, ver]) => `  ${dep}: ${ver}`)
    .join("\n");

  console.log(`\n🔧 Updated ${packagePath}:\n${updatedList || "None"}\n`);
}

batchDirectories.forEach((batch) => {
  const components = getDirectories(`./components/${batch}`);
  console.log(`📦 Components in ${batch}:`, components);

  components.forEach((component) => {
    const packageJsonPath = resolve(
      `components/${batch}/${component}`,
      "package.json"
    );

    if (!fs.existsSync(packageJsonPath)) {
      console.warn(`⚠️ Skipping ${component} (no package.json)`);
      return;
    }

    updatePackageJson(targetVersion, packageJsonPath);
  });
});
