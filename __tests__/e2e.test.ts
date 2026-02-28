import { expect, test } from "@playwright/test";

test("landing flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("🔥 FIRECRAWL CTF")).toBeVisible();
  const start = page.getByRole("button", { name: "START" });
  await expect(start).toBeDisabled();
  await page.getByPlaceholder("your-handle").fill("playwright-user");
  await expect(start).toBeEnabled();
});
