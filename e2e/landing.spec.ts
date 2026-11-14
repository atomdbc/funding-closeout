import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
for (const width of [320, 375, 768, 1024, 1440])
  for (const colorScheme of ["light", "dark"] as const)
    test(`product home fits ${width}px ${colorScheme} without sample presentation`, async ({
      page,
    }) => {
      const errors: string[] = [],
        offsite: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (new URL(r.url()).origin !== "http://127.0.0.1:5323")
          offsite.push(r.url());
      });
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await expect(
        page
          .locator(".hero-actions")
          .getByRole("link", { name: "Create a review", exact: false }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /try.*example|sample|demo/i }),
      ).toHaveCount(0);
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
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          })
        ).violations.map((x) => x.id);
      });
      expect(issues).toEqual([]);
      expect(errors).toEqual([]);
      expect(offsite).toEqual([]);
      if (width === 375 || width === 1440)
        await page.screenshot({
          path: `.cache/customer-home-${width}-${colorScheme}.png`,
          fullPage: true,
        });
    });
test("home links to the review dashboard and does not replace saved work", async ({
  page,
}) => {
  await page.goto("/workspace");
  const before = await (await page.request.get("/statement.json")).json();
  await page.goto("/welcome");
  await expect(page).toHaveURL("http://127.0.0.1:5323/");
  await page
    .locator(".hero-actions")
    .getByRole("link", { name: "Create a review", exact: false })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Let's account for a program's money|Your reviews/,
  );
  expect(await (await page.request.get("/statement.json")).json()).toEqual(
    before,
  );
});
test("product home works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:5323/");
    await page
      .locator(".hero-actions")
      .getByRole("link", { name: "Create a review", exact: false })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Let's account for a program's money|Your reviews/,
    );
  } finally {
    await context.close();
  }
});
test("finite page choreography finishes and reduced motion stays static", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect
    .poll(async () =>
      page.evaluate(() =>
        document.getAnimations().some((a) => a.playState === "running"),
      ),
    )
    .toBe(true);
  await page.waitForTimeout(7000);
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
});
