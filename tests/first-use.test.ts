import { test } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.ts";
import { emptyProgram } from "../src/domain/empty.ts";
import { assess, validateProgram } from "../src/domain/closeout.ts";
import { statement } from "../server/statements.ts";
import { guideStep } from "../web/guide.ts";
async function setup(t: TestContext) {
  let calls = 0;
  const server = createApp({
    reader: {
      check: async () => {
        calls++;
        throw new Error("No automatic lookup");
      },
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(base + "/app"),
    html = await response.text(),
    cookie = response.headers.get("set-cookie")!.split(";")[0]!;
  const field = (name: string, body = html) =>
    body.match(new RegExp(`name="${name}" value="([^"]*)"`))![1]!;
  const post = (data: Record<string, string>, body = html) =>
    fetch(base + "/edit?return=reviews", {
      method: "POST",
      redirect: "manual",
      headers: {
        cookie,
        origin: base,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token: field("token", body),
        revision: field("revision", body),
        form: "create-form",
        action: "create-review",
        ...data,
      }),
    });
  return {
    base,
    html,
    cookie,
    post,
    calls: () => calls,
    json: async () =>
      (await fetch(base + "/statement.json", { headers: { cookie } })).json(),
  };
}
test("new state has no seed records, no fictional flag and unknown reported totals", () => {
  const p = emptyProgram(),
    a = assess(p);
  validateProgram(p);
  assert.deepEqual(p.payments, []);
  assert.deepEqual(p.commitments, []);
  assert.equal(a.fundingReceived, null);
  assert.equal(a.balance, null);
  assert.equal(a.returnProposal, null);
  assert.equal(statement(p, 1).exampleData, false);
  p.balance = "1";
  assert.throws(() => validateProgram(p));
});
test("fresh customer sees an actual create form, not sample choices", async (t) => {
  const s = await setup(t);
  assert.match(s.html, /Create your first review/);
  assert.match(s.html, /No reviews yet/);
  assert.ok(!/Try.*example|Load.*sample|1,000 USDC/.test(s.html));
  const j = await s.json();
  assert.equal(j.inputs.setupPending, true);
  assert.equal(j.inputs.payments.length, 0);
  assert.equal(s.calls(), 0);
});
test("creating a named review starts empty with actual treasury and no inferred totals", async (t) => {
  const s = await setup(t);
  const r = await s.post({ name: "Actual program", treasury: "treasury.near" });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "/guided?step=terms");
  const j = await s.json();
  assert.equal(j.inputs.name, "Actual program");
  assert.equal(j.inputs.chainReview.treasury, "treasury.near");
  assert.equal(j.assessment.balance, null);
  assert.equal(j.inputs.payments.length, 0);
  assert.equal(s.calls(), 0);
  const next = await fetch(s.base + "/app", { headers: { cookie: s.cookie } });
  assert.match(await next.text(), /Continue review/);
});
test("invalid creation preserves fields and does not create or replace a financial review", async (t) => {
  const s = await setup(t),
    r = await s.post({ name: "Keep my name", treasury: "INVALID ACCOUNT" });
  assert.equal(r.status, 422);
  const html = await r.text();
  assert.match(html, /value="Keep my name"/);
  assert.match(html, /value="INVALID ACCOUNT"/);
  assert.equal((await s.json()).inputs.setupPending, true);
});
test("another review requires explicit replacement confirmation", async (t) => {
  const s = await setup(t);
  await s.post({ name: "First program", treasury: "first.near" });
  const html = await (
    await fetch(s.base + "/app", { headers: { cookie: s.cookie } })
  ).text();
  const r = await s.post(
    { name: "Second program", treasury: "second.near" },
    html,
  );
  assert.equal(r.status, 422);
  assert.equal((await s.json()).inputs.name, "First program");
});
test("sample and demo routes are removed and cannot populate data", async (t) => {
  const s = await setup(t);
  for (const path of [
    "/demo",
    "/demo?step=5",
    "/demo/packet.html",
    "/welcome/packet.html",
  ])
    assert.equal((await fetch(s.base + path)).status, 404);
  assert.equal(
    (
      await fetch(s.base + "/guided?step=source&sample=public", {
        headers: { cookie: s.cookie },
      })
    ).status,
    400,
  );
  assert.equal((await s.json()).inputs.payments.length, 0);
});
test("guided default starts with terms and rejects duplicate steps", () => {
  assert.equal(guideStep(new URLSearchParams()), "terms");
  assert.throws(() => guideStep(new URLSearchParams("step=terms&step=result")));
});
