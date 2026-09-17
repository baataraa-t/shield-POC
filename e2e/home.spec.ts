import { test, expect } from "@playwright/test";

test("home page loads with title and nav", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/SHIELD Device Intelligence POC/);
  await expect(page.locator("body")).toBeVisible();
});
