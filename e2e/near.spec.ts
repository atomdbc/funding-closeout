import { test, expect } from "@playwright/test";
import { HASH, TREASURY } from "../tests/fixtures/near.ts";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);

async function start(page: import("@playwright/test").Page) {
  await page.goto("/workspace");
  await page.locator("#near-check > details > summary").click();
  await page
    .getByLabel("Program treasury account", { exact: true })
    .fill(TREASURY);
  await page
    .getByLabel("Replace this local draft with an empty NEAR review.", {
      exact: false,
    })
    .check();
  await page
    .getByRole("button", { name: "Start separate NEAR review", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `${TREASURY} closeout`,
  );
}

test("RPC-shaped fixture import locks facts, keeps purpose unresolved and exports trust boundaries", async ({
  page,
}) => {
  await start(page);
  await expect(page.locator(".terms-summary")).toContainText(
    "Funding totals not entered",
  );
  await expect(
    page.getByText("No payments recorded.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("NEAR transaction hash", { exact: true }).fill(HASH);
  await page
    .getByRole("button", { name: "Check and add transfer", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic test fixture — not live verification", {
      exact: true,
    }),
  ).toBeVisible();
  const payment = page.locator(`#payment-near-${HASH}`);
  await expect(payment.getByLabel("Amount", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(
    payment.getByLabel("Recipient", { exact: true }),
  ).toHaveAttribute("readonly", "");
  await expect(
    payment.getByLabel("What did this payment cover?", { exact: true }),
  ).toHaveValue("");
  await expect(page.locator(".proposal-amount")).toHaveText("Not established");
  await payment
    .getByLabel("How should this payment be treated?", { exact: true })
    .selectOption("expense");
  await payment
    .getByLabel("What did this payment cover?", { exact: true })
    .fill("Reporter-stated purpose only");
  await payment
    .getByLabel("Supporting evidence", { exact: true })
    .fill("Invoice reference — not independently verified");
  await payment
    .getByLabel("I reviewed this explanation and its supporting evidence.")
    .check();
  await payment
    .getByRole("button", { name: "Save payment", exact: true })
    .click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download statement" }).click(),
  ]);
  const exported = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(exported.testFixtureData).toBe(true);
  expect(exported.exampleData).toBe(false);
  expect(exported.inputs.payments[0].chain.basis).toBe("test-fixture");
  expect(exported.inputs.payments[0].purpose).toBe(
    "Reporter-stated purpose only",
  );
  expect(exported.assessment.balance).toBeNull();
  expect(exported.assessment.returnProposal).toBeNull();
  expect(exported.trustBoundary.notProven).toContain("wallet ownership");
});

test("unavailable checks preserve the hash and do not add a payment", async ({
  page,
}) => {
  await start(page);
  const unknown = "11111111111111111111111111111112";
  await page.getByLabel("NEAR transaction hash", { exact: true }).fill(unknown);
  await page
    .getByRole("button", { name: "Check and add transfer", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("cannot confirm");
  await expect(
    page.getByLabel("NEAR transaction hash", { exact: true }),
  ).toHaveValue(unknown);
  await expect(
    page.getByText("No payments recorded.", { exact: false }),
  ).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`checked facts fit mobile and pass automated accessibility in ${colorScheme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 850 });
    await page.emulateMedia({ colorScheme });
    await start(page);
    await page.getByLabel("NEAR transaction hash", { exact: true }).fill(HASH);
    await page
      .getByRole("button", { name: "Check and add transfer", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "NEAR transfer facts" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(
      readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"),
    );
    const violations = await page.evaluate(async () => {
      const w = window as unknown as {
        axe: {
          run: (
            root: Document,
            options: object,
          ) => Promise<{ violations: { id: string }[] }>;
        };
      };
      return (
        await w.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })
      ).violations.map((v) => v.id);
    });
    expect(violations).toEqual([]);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `.cache/near-facts-375-${colorScheme}.png`,
      fullPage: true,
    });
  });
}
