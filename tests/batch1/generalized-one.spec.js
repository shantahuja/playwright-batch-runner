// generalized-one.spec.js
// A simplified example for batch test spec
const { test, expect, webkit } = require("@playwright/test");
const {
  GenericBatchPageOne,
} = require("../../pages/batch1/generic-batch-page-one.js");

test.describe("@batchTemplate generic-batch", () => {
  test("Validates batch/unbatch/nobatch responses", async ({ page }) => {
    const browser = await webkit.launch();
    const batchPage = new GenericBatchPageOne(page);

    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 200, body: "{}" })
    );

    await batchPage.goto("example-path");
    await batchPage.checkPageObjects();

    const modes = ["batched", "unbatched", "nobatched"];
    for (const mode of modes) {
      let responses = [];
      const { button, checkSuccess, expectedUrl, expectedCount } =
        batchPage.getModeConfig(mode);

      page.on("response", (res) => responses.push(res.url()));

      await button.click();
      await page.waitForResponse(expectedUrl);
      await checkSuccess();

      const correctCount =
        responses.filter((r) => r.includes(expectedUrl)).length ===
        expectedCount;
      await expect(correctCount).toBeTruthy();

      await page.reload();
    }

    await browser.close();
  });
});
