import { test, expect } from "@playwright/test";

test("home page loads and nav links work @smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/SHIELD Device Intelligence POC/);

  await page.getByRole("link", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId("auth-form")).toBeVisible();
});

test("result page renders an allow decision", async ({ page }) => {
  await page.goto(
    "/result?decision=allow&event=login&reasons=" +
      encodeURIComponent(JSON.stringify(["No significant risk signals detected"])),
  );

  await expect(page.getByTestId("decision-badge")).toHaveText("allow");
  await expect(page.getByTestId("result-heading")).toHaveText("Access granted");
});

test("result page renders a block decision", async ({ page }) => {
  await page.goto(
    "/result?decision=block&event=login&reasons=" +
      encodeURIComponent(JSON.stringify(["Bot activity detected"])),
  );

  await expect(page.getByTestId("decision-badge")).toHaveText("block");
  await expect(page.getByTestId("result-heading")).toHaveText("Access denied");
});

test("result page links back to the opposite auth flow", async ({ page }) => {
  await page.goto("/result?decision=allow&event=signup");
  await page.getByRole("link", { name: "Try another flow" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
