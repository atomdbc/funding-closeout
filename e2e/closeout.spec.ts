import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);

test("unresolved payment -> evidence -> coverage -> conditional statement", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".proposal-amount")).toHaveText("Not established");
  const payment = page.locator("#payment-pay-unknown");
  await payment
    .getByLabel("Recipient", { exact: true })
    .fill("Demo support contributor");
  await payment
    .getByLabel("How should this payment be treated?")
    .selectOption("expense");
  await payment
    .getByLabel("What did this payment cover?")
    .fill("Support session");
  await payment
    .getByLabel("Supporting evidence", { exact: true })
    .fill("DEMO-INVOICE-03 — fictional support record");
  await payment
    .getByLabel("I reviewed this explanation and its supporting evidence.")
    .check();
  await payment
    .getByRole("button", { name: "Save payment", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved locally");
  await expect(page.locator(".proposal-amount")).toHaveText("Not established");
  const coverage = page.locator("#coverage-form");
  await coverage.locator('[name="paymentsComplete"]').check();
  await coverage.locator('[name="commitmentsComplete"]').check();
  await coverage
    .getByRole("button", { name: "Save scope confirmations" })
    .click();
  await expect(
    page.getByText("Ready for human review", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".proposal-amount")).toHaveText("150 USDC");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download statement" }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import("node:fs/promises");
  const exported = JSON.parse(await fs.readFile(path!, "utf8"));
  expect(exported.assessment.returnProposal).toBe("150");
  expect(exported.approval).toBe("not-signed");
  expect(exported.inputs.commitments[0].remaining).toBe("250");
  expect(exported.network).toBe("none");
  expect(exported.digestSha256).toMatch(/^[a-f0-9]{64}$/);
});

test("validation preserves edits; fixed awards never become automatic refunds", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#terms > details > summary").click();
  await page.getByLabel("Program name").fill("My fictional program");
  await page.getByLabel("Approved amount", { exact: true }).fill("1e3");
  await page.getByRole("button", { name: "Save funding terms" }).click();
  await expect(
    page.getByLabel("Approved amount", { exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Program name")).toHaveValue(
    "My fictional program",
  );
  await page.getByLabel("Approved amount", { exact: true }).fill("1000");
  await page.getByLabel("What do the terms say?").selectOption("fixed-award");
  await page.getByRole("button", { name: "Save funding terms" }).click();
  await expect(
    page.getByRole("heading", { name: "My fictional program" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Fixed-award terms do not establish an unused-funds return obligation.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("record editing works without JavaScript and handles empty lists", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5323/");
  await page.locator("#commitments .record > summary").click();
  await page
    .locator("#commitment-due-docs")
    .getByRole("button", { name: "Remove record" })
    .click();
  await expect(
    page.getByText(
      "No commitments recorded. That is not a confirmation that none exist.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add commitment", exact: true })
    .click();
  await expect(page.getByLabel("Who is still owed?")).toBeVisible();
  await context.close();
});

for (const width of [375, 768, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`review is accessible and fits ${width}px ${colorScheme}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.getByRole("link", { name: "Closeout", exact: true }).click();
      await expect(
        page.getByRole("link", { name: "Download statement" }),
      ).toBeVisible();
      await page.evaluate(
        readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"),
      );
      const violations = await page.evaluate(async () => {
        const w = window as unknown as {
          axe: {
            run: (
              root: Document,
              options: object,
            ) => Promise<{ violations: { id: string; nodes: unknown[] }[] }>;
          };
        };
        return (
          await w.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          })
        ).violations.map((v) => ({ id: v.id, count: v.nodes.length }));
      });
      expect(violations).toEqual([]);
      expect(errors).toEqual([]);
      if (width === 375 || width === 1280) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: `.cache/closeout-${width}-${colorScheme}.png`,
          fullPage: true,
        });
      }
    });
  }
}
