import { test, expect } from "@playwright/test";
import { exampleProgram } from "../src/domain/demo.ts";
import { statement } from "../server/statements.ts";
import { newNearReview, addCheckedTransfer } from "../src/near/review.ts";
import { parseTransfer } from "../src/near/verify.ts";
import { fixtureTransaction, HASH, TREASURY } from "../tests/fixtures/near.ts";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

async function tools(page: import("@playwright/test").Page) {
  const summary = page.getByText("Save, reopen or import a draft", {
    exact: true,
  });
  if (!(await page.getByLabel("Saved copy name", { exact: true }).isVisible()))
    await summary.click();
}

test("named copy reopens independently of the current edited draft", async ({
  page,
}) => {
  await page.goto("/workspace");
  await tools(page);
  await page
    .getByLabel("Saved copy name", { exact: true })
    .fill("Pinned original");
  await page
    .getByRole("button", { name: "Save named copy", exact: true })
    .click();
  await page.locator("#terms .terms-summary").click();
  await page.getByLabel("Program name", { exact: true }).fill("Edited later");
  await page
    .getByRole("button", { name: "Save funding terms", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Edited later",
  );
  await tools(page);
  await page
    .getByLabel(
      "Replace the working draft with this copy; clear its review and scope marks.",
      { exact: true },
    )
    .check();
  await page
    .getByRole("button", { name: "Open saved copy", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    exampleProgram().name,
  );
  const exported = await (await page.request.get("/statement.json")).json();
  expect(
    exported.inputs.payments.every((p: { reviewed: boolean }) => !p.reviewed),
  ).toBe(true);
  expect(exported.inputs.paymentsComplete).toBe(false);
});

test("selected JSON file loads locally and imports only after explicit confirmation", async ({
  page,
}) => {
  await page.goto("/workspace");
  await tools(page);
  const p = exampleProgram();
  p.name = "Reopened from backup";
  await page.locator("[data-statement-file]").setInputFiles({
    name: "closeout.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(statement(p, 55))),
  });
  await expect(page.locator("[data-file-status]")).toContainText(
    "File loaded locally",
  );
  await page
    .getByLabel(
      "Replace the working draft with imported claims; clear review and scope marks and recheck NEAR movements.",
      { exact: true },
    )
    .check();
  await page
    .getByRole("button", { name: "Import as unverified claims", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.name);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Imported as unverified claims" }),
  ).toBeVisible();
  const s = await (await page.request.get("/statement.json")).json();
  expect(s.revision).toBe(2);
  expect(s.approval).toBe("not-signed");
});

test("oversized selected file is not silently replaced by a previously selected file", async ({
  page,
}) => {
  await page.goto("/workspace");
  await tools(page);
  await page
    .locator("#statement-source")
    .fill(JSON.stringify(statement(exampleProgram(), 1)));
  await page.locator("[data-statement-file]").setInputFiles({
    name: "too-large.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(262145, 120),
  });
  await expect(page.locator("[data-file-status]")).toContainText(
    "no larger than 256 KiB",
  );
  await expect(page.locator("#statement-source")).toHaveValue("");
});

test("imported NEAR proof is visibly unverified until explicit fixture recheck", async ({
  page,
}) => {
  const f = parseTransfer(
      fixtureTransaction(),
      HASH,
      TREASURY,
      "test-fixture",
      "2026-11-14T08:00:00Z",
    ),
    p = addCheckedTransfer(newNearReview(TREASURY), f);
  await page.goto("/workspace");
  await tools(page);
  await page.locator("#statement-source").fill(JSON.stringify(statement(p, 2)));
  await page
    .getByLabel(
      "Replace the working draft with imported claims; clear review and scope marks and recheck NEAR movements.",
      { exact: true },
    )
    .check();
  await page
    .getByRole("button", { name: "Import as unverified claims", exact: true })
    .click();
  await expect(
    page.getByText("Imported claim — not RPC-checked.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "NEAR transfer facts" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Recheck imported transfer", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic test fixture — not live verification", {
      exact: true,
    }),
  ).toBeVisible();
  const s = await (await page.request.get("/statement.json")).json();
  expect(s.inputs.payments[0].chain.basis).toBe("test-fixture");
  expect(s.inputs.payments[0].reviewed).toBe(false);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`opened draft tools fit mobile and pass automated accessibility in ${colorScheme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 850 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/workspace");
    await tools(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(
      await readFile(require.resolve("axe-core/axe.min.js"), "utf8"),
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
    await page.screenshot({
      path: `.cache/v03-draft-tools-375-${colorScheme}.png`,
      fullPage: true,
    });
  });
}

test("JSON paste import works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:5323/workspace");
    await tools(page);
    const p = exampleProgram();
    p.name = "No-JS backup restore";
    await page
      .locator("#statement-source")
      .fill(JSON.stringify(statement(p, 2)));
    await page
      .getByLabel(
        "Replace the working draft with imported claims; clear review and scope marks and recheck NEAR movements.",
        { exact: true },
      )
      .check();
    await page
      .getByRole("button", { name: "Import as unverified claims", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.name);
  } finally {
    await context.close();
  }
});

test("review packet downloads a self-contained script-free unsigned document", async ({
  page,
}) => {
  await page.goto("/workspace");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("link", { name: "Download review packet", exact: true })
      .click(),
  ]);
  const html = await readFile((await download.path())!, "utf8");
  expect(html).toContain("UNSIGNED REVIEW PACKET");
  expect(html).toContain("FICTIONAL EXAMPLE");
  expect(html).not.toMatch(/<script|<form|<input/i);
  expect(html).toContain("sha256-");
});
