const { spawn } = require("child_process");

// Get batch number from command line args
const batchNumber = process.argv[2];

if (!batchNumber || isNaN(batchNumber) || parseInt(batchNumber, 10) <= 0) {
  console.error(
    "❌ Please provide a valid positive batch number. Example: pnpm run test:batch 2"
  );
  process.exit(1);
}

const child = spawn("node", ["batchComponents.js"], {
  env: {
    ...process.env,
    IS_BATCH: "BATCH",
    BATCH_NUMBER: batchNumber,
  },
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code);
});
