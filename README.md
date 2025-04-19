# Playwright Functional Test Runner

A dynamically batched Playwright runner optimized for multi-component integration testing in CI environments.

- Runs isolated Playwright tests across multiple components with dynamic port management
- Designed for pipelines using Docker and Jenkins, but flexible for any modern CI setup
- Built from scratch with no proprietary dependencies — safe for public and private use

---

## ⚙️ Key Features

- 🔍 **Auto-generated batches** – Components in `components/batchX/` are detected dynamically
- 🔄 **Dynamic port mapping** – Components are assigned ports starting at `8081`, reused per batch
- 🧪 **Supports Chromium, Firefox, and WebKit**
- 🧼 **Clean teardown** – Ensures ports and processes are fully stopped before next batch
- 📄 **Rich reporting** – JSON test results, per-suite stats, flaky/slow test tracking
- 💬 **Optional Teams integration** – Send Adaptive Card reports with `report.js`
- ✅ **Safe for public use** – No internal URLs, secrets, or tokens
- 🐳 **Docker + Jenkins-ready** – Works cleanly in CI pipelines using the official Playwright Docker image

---

## 📁 Folder Structure

```
components/
├── batch1/
│   ├── file-upload/
│   └── http-effect/
├── batch2/
│   └── recursive-action-handler/

tests/
├── batch1/
│   ├── file-upload.spec.js
│   └── http-effect.spec.js
├── batch2/
│   └── recursive-action-handler.spec.js

pages/
├── batch1/
│   ├── file-upload-page.js
│   └── http-effect-page.js
├── batch2/
│   └── recursive-action-handler-page.js
```

> Each component lives in its own folder. Tests and page objects follow the same batch layout.

---

## 🧪 Running Tests

Ensure the following are installed:

- `node`, `pnpm`, `playwright`, and `lerna` (globally or via Docker)
- Components must support `pnpm run start` with a `PORT` env

Then run:

```bash
pnpm run test
```

What it does:

- Spawns each batch in parallel (with port isolation)
- Runs Playwright tests in all 3 browsers
- Merges all JSON reports
- Zips artifacts (screenshots, videos) if found

---

## 🔧 Configuration

You can configure test runs with:

- `.env` (optional, not required)
- `playwright.config.js` – customize base URL, retries, headless mode, webhook
- `setup.js` – injects version metadata and artifacts into test runs

Common env variables:

```bash
RELEASE_VERSION=1.2.3
BUILD_VERSION=1.2.3
BUILD_NUMBER=44
BUILD_CAUSE=Push
```

---

## 📤 Reports

After the run, you'll get:

- `results_batchX.json` — raw test result for that batch
- `final_results.json` — all batch results merged
- A clean test summary is also generated using `resultSummary.js`.
- `test-results/` — individual screenshots, videos, zipped
- `test-results-<version>-<build>.zip` — uploaded via Jenkins artifact archiving

✅ Adaptive Card reports are supported via `report.js`:

- Includes commit info, test durations, flaky/slow failures, and a clickable summary
- No secrets or internal references included

---

## 🤖 Jenkins + Docker Integration

This project includes a prebuilt Jenkinsfile that runs Playwright tests inside Docker.

- Installs dependencies
- Runs tests through `pnpm run test:jenkins` or `pnpm run test:jenkins:report`
- Archives screenshots, videos, and test result reports automatically

✅ Designed for Jenkins pipelines without needing native Playwright installation. All browser dependencies are handled by the official Playwright Docker image.

---

## 🧠 How It Works

- `batchGenerate.js` – builds batch definitions dynamically
- `batchComponents.js` – handles test orchestration, retries, and cleanup
- `batchLauncher.js` – starts each batch component cleanly before tests
- `resultSummary.js` – generates a clean stats summary after the test run
- `report.js` – formats results into Teams-compatible Adaptive Cards
- `pages/utils.js` – helper functions for dynamic page object handling
- `Dockerfile` – preconfigured for CI with isolated build/test logic

---

## 📌 Notes

- Current batch limit: **4 components max per batch** (adjust if needed)
- Component names and test files must match exactly
- Ports reset to `8081+` per batch; no overlap
- Tests are run with `xvfb` in CI mode if needed
- Only failed, flaky, and slow tests are included in reports

---

## 📦 Running a Single Batch

To run just **one batch** manually (for example, batch 2):

```bash
pnpm run test:batch 2
```

- Replace `2` with the batch number you want to run
- Runs only that batch's components and tests
- Useful for debugging individual sets without launching everything

> Note: This uses `batchLauncher.js` under the hood.

---

## 📣 Contributing

Contributions welcome! You can:

- Add Slack/HTML/email reporters
- Improve port scheduling logic
- Hook into a test dashboard with the merged JSON

---

## 🛠️ License

MIT — free to use and modify. No internal IP, code, or dependencies.

---

## 🔼 Bumping Internal Dependencies

Need to update internal packages (like `@your-scope/ui-*`) across all component folders? Use the provided helper:

```bash
node bumpDependencies.js <new_version> <dependency_prefix>
```

### 🔹 Example

Update all `@my-org/ui-*` dependencies to version `2.1.0`:

```bash
node bumpDependencies.js 2.1.0 @my-org/ui-
```

This will:

- Scan all `components/batch*/` folders
- Find `package.json` files
- Update matching `dependencies` and `devDependencies` to the new version

You'll see output like:

```
📦 Components in batch1: [ 'file-upload', 'http-effect' ]
🔧 Updated components/batch1/file-upload/package.json:
  @my-org/ui-button: 2.1.0
  @my-org/ui-dialog: 2.1.0
```

> Prefix matching is strict — make sure it matches the actual package names used.
