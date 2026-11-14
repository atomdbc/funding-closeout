import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { once } from "node:events";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createApp } from "../server/app.ts";
import { createNearReader, NearCheckError } from "../src/near/verify.ts";
import { SqliteReviewRepository } from "../server/storage.ts";
import { fixtureTransaction, HASH, TREASURY } from "../tests/fixtures/near.ts";
const require = createRequire(import.meta.url);
// Genuine production defaults (empty), with only the RPC transport explicitly synthetic.
const test = base.extend<{ appURL: string }>({
  appURL: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), "customer-flow-")),
      repository = new SqliteReviewRepository(join(dir, "data.sqlite"));
    const reader = createNearReader(async (method, params) => {
      if (method === "status") return { chain_id: "mainnet" };
      if ((params as { tx_hash: string }).tx_hash !== HASH)
        throw new NearCheckError(
          "unavailable",
          "Synthetic fixture cannot confirm that transaction.",
        );
      return fixtureTransaction();
    }, "test-fixture");
    const server = createApp({ repository, reader });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No listener");
    try {
      await use(`http://127.0.0.1:${address.port}`);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      repository.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
});
async function create(page: Page, appURL: string, name = "Community work") {
  await page.goto(appURL + "/app");
  await page.getByLabel("Program name", { exact: true }).fill(name);
  await page
    .getByLabel("NEAR treasury account", { exact: true })
    .fill(TREASURY);
  await page
    .getByRole("button", { name: "Create review", exact: true })
    .click();
}

test("fresh customer creates a named review with no seeded money, payments or sample choices", async ({
  page,
  appURL,
}) => {
  await page.goto(appURL + "/");
  await page
    .locator(".hero-actions")
    .getByRole("link", { name: "Create a review", exact: false })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reviews");
  await expect(page.getByText("No reviews yet", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /sample|example|demo/i }),
  ).toHaveCount(0);
  await page
    .getByLabel("Program name", { exact: true })
    .fill("My actual program");
  await page
    .getByLabel("NEAR treasury account", { exact: true })
    .fill(TREASURY);
  await page
    .getByRole("button", { name: "Create review", exact: true })
    .click();
  await expect(page).toHaveURL(/step=terms/);
  for (const label of [
    "Approved amount",
    "Funding received",
    "Reported closing balance",
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
  const j = await (await page.request.get(appURL + "/statement.json")).json();
  expect(j.inputs.name).toBe("My actual program");
  expect(j.inputs.payments).toEqual([]);
  expect(j.assessment.balance).toBeNull();
});

test("customer completes funding, checked payment, obligation, scope and unsigned export then resumes", async ({
  page,
  appURL,
}) => {
  await create(page, appURL);
  for (const [label, value] of [
    ["Approved amount", "1000"],
    ["Funding received", "1000"],
    ["Reported closing balance", "950"],
    [
      "Approved terms and reference",
      "TEST-AGREEMENT: return unused funding after obligations",
    ],
  ])
    await page.getByLabel(label!, { exact: true }).fill(value!);
  await page
    .getByLabel("What do the terms say?", { exact: true })
    .selectOption("return-unspent");
  await page
    .getByRole("button", { name: "Save funding terms", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Next: Add payments", exact: true })
    .click();
  await page.getByLabel("NEAR transaction hash", { exact: true }).fill(HASH);
  await page
    .getByRole("button", { name: "Check and add transfer", exact: true })
    .click();
  await expect(page).toHaveURL(/step=payments/);
  await expect(
    page.getByText("Synthetic test fixture — not live verification", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("How should this payment be treated?", { exact: true })
    .selectOption("expense");
  await page
    .getByLabel("What did this payment cover?", { exact: true })
    .fill("Support work");
  await page
    .getByLabel("Supporting evidence", { exact: true })
    .fill("TEST-INVOICE — synthetic evidence");
  await page
    .getByLabel("I reviewed this explanation and its supporting evidence.", {
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await page
    .getByRole("link", { name: "Next: Unpaid obligations", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add commitment", exact: true })
    .click();
  await page
    .getByLabel("Who is still owed?", { exact: true })
    .fill("Contributor");
  await page.getByLabel("Remaining amount", { exact: true }).fill("250");
  await page
    .getByLabel("What is still owed or to be delivered?", { exact: true })
    .fill("Documentation");
  await page
    .getByLabel("Commitment evidence", { exact: true })
    .fill("TEST-AGREEMENT");
  await page
    .getByLabel("I reviewed the remaining obligation and its evidence.", {
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Save commitment", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Next: Scope checks", exact: true })
    .click();
  await page.locator("#coverage-form [name=paymentsComplete]").check();
  await page.locator("#coverage-form [name=commitmentsComplete]").check();
  await page
    .getByRole("button", { name: "Save scope confirmations", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Next: Review result", exact: true })
    .click();
  await expect(page.locator(".proposal-amount")).toHaveText("700 USDC");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("link", { name: "Download review packet", exact: true })
      .click(),
  ]);
  const packet = readFileSync((await download.path())!, "utf8");
  expect(packet).toContain("UNSIGNED REVIEW PACKET");
  expect(packet).toContain("700 USDC");
  expect(packet).toContain("SYNTHETIC TEST FIXTURES");
  await page
    .getByRole("link", { name: "Back to reviews", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Community work", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Continue review", exact: true })
    .click();
  await expect(page.locator(".proposal-amount")).toHaveText("700 USDC");
});

test("validation and unsaved-step protection keep user work", async ({
  page,
  appURL,
}) => {
  await page.goto(appURL + "/app");
  await page.getByLabel("Program name", { exact: true }).fill("Keep this name");
  await page
    .getByLabel("NEAR treasury account", { exact: true })
    .fill("INVALID ACCOUNT");
  await page
    .getByRole("button", { name: "Create review", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Program name", { exact: true })).toHaveValue(
    "Keep this name",
  );
  await page
    .getByLabel("NEAR treasury account", { exact: true })
    .fill(TREASURY);
  await page
    .getByRole("button", { name: "Create review", exact: true })
    .click();
  await page.getByLabel("Program name", { exact: true }).fill("Unsaved change");
  await page
    .getByRole("link", { name: "Next: Add payments", exact: true })
    .click();
  await expect(page.locator("#unsaved-warning")).toBeVisible();
  await expect(page).toHaveURL(/step=terms/);
});

test("another review is explicitly confirmed, backed up and can be reopened", async ({
  page,
  appURL,
}) => {
  await create(page, appURL, "First review");
  await page.goto(appURL + "/app");
  await page
    .getByText("Create another review", { exact: true })
    .first()
    .click();
  await page.getByLabel("Program name", { exact: true }).fill("Second review");
  await page
    .getByLabel("NEAR treasury account", { exact: true })
    .fill("second.near");
  await page
    .getByRole("button", { name: "Create review", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Confirm");
  await expect(
    page.getByRole("heading", { name: "First review", exact: true }),
  ).toBeVisible();
  await page.locator("#create-form [name=confirm]").check();
  await page
    .getByRole("button", { name: "Create review", exact: true })
    .click();
  await page.goto(appURL + "/app");
  await expect(
    page.getByRole("heading", { name: "Second review", exact: true }),
  ).toBeVisible();
  await page
    .locator("form")
    .filter({ has: page.locator("[name=action][value=open-copy]") })
    .locator("[name=confirm]")
    .check();
  await page
    .getByRole("button", { name: "Open saved review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "First review", exact: true }),
  ).toBeVisible();
});

test("customer creation works without JavaScript", async ({
  browser,
  appURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await create(page, appURL);
    await expect(
      page.getByLabel("Approved amount", { exact: true }),
    ).toHaveValue("");
    await expect(
      page.getByRole("link", { name: "Next: Add payments", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

for (const width of [375, 1280])
  for (const colorScheme of ["light", "dark"] as const)
    test(`customer dashboard and first task fit ${width}px ${colorScheme} with accessible controls`, async ({
      page,
      appURL,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      for (const stage of ["empty", "terms", "dashboard"]) {
        if (stage === "empty") await page.goto(appURL + "/app");
        else if (stage === "terms") await create(page, appURL);
        else await page.goto(appURL + "/app");
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.evaluate(
          readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"),
        );
        const issues = await page.evaluate(async () => {
          const w = window as unknown as {
            axe: {
              run: (
                d: Document,
                o: object,
              ) => Promise<{ violations: { id: string }[] }>;
            };
          };
          return (
            await w.axe.run(document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa"],
              },
            })
          ).violations.map((x) => x.id);
        });
        expect(issues, stage).toEqual([]);
        if (stage === "empty")
          await page.screenshot({
            path: `.cache/customer-empty-${width}-${colorScheme}.png`,
            fullPage: true,
          });
      }
    });
