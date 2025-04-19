// generic-batch-page-one.js
const { expect } = require("@playwright/test");
const goto = require("../utils");

exports.GenericBatchPageOne = class GenericBatchPageOne {
  constructor(page) {
    this.page = page;

    this.pageTitle = page.locator("h1");
    this.sectionHeader = page.locator("h3");

    this.startButtons = {
      batched: page.getByRole("button", { name: /batch/i }),
      unbatched: page.getByRole("button", { name: /unbatch/i }),
      nobatched: page.getByRole("button", { name: /nobatch/i }),
    };

    this.successIndicators = {
      unbatched: page.locator("p", { hasText: /unbatched.*success/i }),
      nobatched: page.locator("p", { hasText: /nobatched.*success/i }),
    };
  }

  async goto(path) {
    await goto(this.page, path);
  }

  async checkPageObjects() {
    await this.pageTitle.isVisible();
    await this.sectionHeader.isVisible();
    for (const btn of Object.values(this.startButtons)) {
      await btn.isVisible();
    }
  }

  getModeConfig(mode) {
    return {
      button: this.startButtons[mode],
      checkSuccess: async () => {
        if (mode === "unbatched")
          await expect(this.successIndicators.unbatched).toBeVisible();
        if (mode === "nobatched")
          await expect(this.successIndicators.nobatched).toBeVisible();
      },
      expectedUrl:
        mode === "batched" || mode === "nobatched"
          ? "**/api/now/v1/batch"
          : "**/api/now/table/sys_user?*",
      expectedCount: mode === "unbatched" ? 5 : 1,
    };
  }
};
