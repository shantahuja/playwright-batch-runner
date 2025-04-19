const execa = require("execa");
const fs = require("fs");

let releaseVersion = process.argv[2];
let snapshotVersion = process.argv[3];
let upstreamVersion = process.argv[4];
let newVersionArgument = "";

// 🔍 Raw logs for debugging
console.log("argv[0]: ", process.argv[0]);
console.log("argv[1]: ", process.argv[1]);
console.log("Release (arg 2): ", process.argv[2] || "No argument");
console.log("Snapshot (arg 3): ", process.argv[3] || "No argument");
console.log("Upstream (arg 4): ", process.argv[4] || "No argument\n");

// 🧠 Logic 1: Prefer explicit upstream version if it's a release
if (
  upstreamVersion &&
  !upstreamVersion.includes("SNAPSHOT") &&
  upstreamVersion !== "null" &&
  upstreamVersion !== "--"
) {
  console.log("✅ Using upstream release version:", upstreamVersion);
  newVersionArgument = upstreamVersion;
}

// 🧠 Logic 2: Prefer snapshot if both upstream and snapshot are snapshots
if (
  snapshotVersion &&
  snapshotVersion.includes("SNAPSHOT") &&
  upstreamVersion &&
  upstreamVersion.includes("SNAPSHOT") &&
  snapshotVersion !== "null" &&
  snapshotVersion !== "--"
) {
  console.log("✅ Using upstream snapshot version:", snapshotVersion);
  newVersionArgument = snapshotVersion.replace(/^.*@/, "");
}

// ✂️ Trim all inputs
releaseVersion = releaseVersion?.trim();
snapshotVersion = snapshotVersion?.trim();
newVersionArgument = newVersionArgument?.trim();

// 🧠 Logic 3: Fallback to RELEASE_VERSION if nothing else
if (
  !newVersionArgument &&
  releaseVersion &&
  !releaseVersion.toUpperCase().includes("SNAPSHOT")
) {
  console.log("🔍 Falling back to RELEASE_VERSION:", releaseVersion);
  newVersionArgument = releaseVersion;
} else if (!newVersionArgument) {
  console.log("🚨 No valid version provided. Skipping bump.");
}

// 📦 Build/install flow
if (
  newVersionArgument == "null" ||
  newVersionArgument == "--" ||
  !newVersionArgument
) {
  console.log("📦 No version bump — continuing with install & build");
  execa.sync("pnpm", ["run", "ci:components"], { stdio: "inherit" });
  execa.sync("pnpm", ["run", "build:components"], { stdio: "inherit" });
} else {
  console.log("📦 Bumping components to:", newVersionArgument);

  // Replace this package name with your default validation target if needed
  const { stdout } = execa.sync(
    "npm",
    ["view", "@example/package@" + newVersionArgument],
    { stdio: ["ignore", "pipe", "inherit"] }
  );

  if (!stdout) {
    console.error("❌ Version not found on npm:", newVersionArgument);
    process.exit(1);
  }

  execa.sync("pnpm", ["run", "bumpDependencies", newVersionArgument], {
    stdio: "inherit",
  });
  execa.sync("pnpm", ["run", "install:components"], { stdio: "inherit" });
  execa.sync("pnpm", ["run", "ci:components"], { stdio: "inherit" });
  execa.sync("pnpm", ["run", "build:components"], { stdio: "inherit" });
}

// 📝 Write version to file
if (newVersionArgument) {
  fs.writeFileSync(".version", `BUILD_VERSION=${newVersionArgument}\n`);
  console.log("✅ .version file written.");
} else {
  console.warn("⚠️ No BUILD_VERSION to write.");
}
