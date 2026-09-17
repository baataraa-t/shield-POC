import { test, expect } from "@playwright/test";

test("home page loads with title and nav", async ({ page }) => {
  const response = await page.goto("/");
  console.log("Reached:", response?.url());

  await expect(page).toHaveTitle(/SHIELD Device Intelligence POC/);
  await expect(page.locator("body")).toBeVisible();
});
