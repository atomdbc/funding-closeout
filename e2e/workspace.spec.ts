import { test, expect } from "@playwright/test";

test("workspace puts the real next action and proposal above recovery tools", async ({
  page,
}) => {
  const offsite: string[] = [];
  const failed: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== "http://127.0.0.1:5323")
      offsite.push(r.url());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/workspace");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".next-step")).toContainText("Explain 1 payment");
  await expect(page.locator(".proposal-amount")).toHaveText("Not established");
  expect(
    await page
      .locator(".proposal")
      .evaluate((e) => e.getBoundingClientRect().top),
  ).toBeLessThan(1000);
  await page
    .getByRole("link", { name: "Continue review", exact: false })
    .click();
  await expect(page).toHaveURL(/#payment-pay-unknown$/);
  await expect(
    page.getByRole("link", { name: "Payments", exact: true }),
  ).toHaveAttribute("aria-current", "location");
  expect(
    await page
      .locator("#payments")
      .evaluate(
        (e) =>
          e.compareDocumentPosition(document.querySelector("#saved-work")!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
  ).toBeTruthy();
  expect(offsite).toEqual([]);
  expect(failed).toEqual([]);
});

test("NEAR tool opens deliberately and bad treasury input preserves the open form", async ({
  page,
}) => {
  await page.goto("/workspace");
  await expect(page.locator("#near-check > details")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.getByRole("link", { name: "NEAR checks", exact: true }).click();
  await expect(
    page.getByLabel("Program treasury account", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Program treasury account", { exact: true })
    .fill("NOT A VALID ACCOUNT");
  await page.locator("#start-near-form input[type=checkbox]").check();
  await page
    .getByRole("button", { name: "Start separate NEAR review", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByLabel("Program treasury account", { exact: true }),
  ).toHaveValue("NOT A VALID ACCOUNT");
  await expect(
    page.getByLabel("Program treasury account", { exact: true }),
  ).toBeFocused();
});

test("native details and calculation remain keyboard accessible without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:5323/workspace");
    const source = page.locator("#near-check > details > summary");
    await source.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByLabel("Program treasury account", { exact: true }),
    ).toBeVisible();
    const calc = page.locator(".calculation > summary");
    await calc.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".totals")).toContainText(
      "Cash after stated commitments",
    );
    await expect(page.locator(".totals")).toContainText("150 USDC");
    await expect(page.locator(".proposal-amount")).toHaveText(
      "Not established",
    );
  } finally {
    await context.close();
  }
});

test("maximum six-decimal quantities stay exact and fit a narrow workspace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/workspace");
  await page.locator("#terms > details > summary").click();
  for (const label of [
    "Approved amount",
    "Funding received",
    "Reported closing balance",
  ])
    await page.getByLabel(label, { exact: true }).fill("999999999999.999999");
  await page
    .getByRole("button", { name: "Save funding terms", exact: true })
    .click();
  await expect(page.locator(".overview")).toContainText(
    "999,999,999,999.999999 USDC",
  );
  await expect(page.locator(".proposal-amount")).toHaveText("Not established");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

for (const colorScheme of ["light", "dark"] as const)
  test(`workspace fits 320px ${colorScheme}, keeps money exact and has no repeated entrance motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/workspace");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".overview")).toContainText("1,000 USDC");
    await expect(page.locator(".overview")).toContainText("400 USDC");
    await expect(page.locator(".overview")).toContainText("250 USDC");
    expect(
      await page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    ).toBe(0);
  });
