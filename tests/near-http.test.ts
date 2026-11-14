import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "./fixtures/app.ts";
import { parseTransfer, NearCheckError } from "../src/near/verify.ts";
import type { TransferReader } from "../src/near/facts.ts";
import { fixtureTransaction, HASH, TREASURY } from "./fixtures/near.ts";

const facts = () =>
  parseTransfer(
    fixtureTransaction(),
    HASH,
    TREASURY,
    "test-fixture",
    "2026-11-14T08:00:00Z",
  );
async function client(
  t: TestContext,
  reader: TransferReader = { check: async () => facts() },
) {
  const server = createApp({ reader });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const addr = server.address();
  assert(addr && typeof addr !== "string");
  const url = `http://127.0.0.1:${addr.port}`,
    response = await fetch(url + "/workspace"),
    html = await response.text();
  const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
  const token = html.match(/name="token" value="([a-f0-9]+)"/)![1]!;
  const post = (fields: Record<string, string>) =>
    fetch(url + "/edit", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: url,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token,
        revision: "1",
        form: "near-check-form",
        ...fields,
      }),
      redirect: "manual",
    });
  const snapshot = async () =>
    (
      await fetch(url + "/statement.json", { headers: { Cookie: cookie } })
    ).json();
  const start = () =>
    post({
      action: "start-near",
      form: "start-near-form",
      treasury: TREASURY,
      confirm: "on",
    });
  return { post, snapshot, start, url, cookie };
}

test("mode switch needs explicit confirmation and does not mix fictional data", async (t) => {
  const c = await client(t);
  assert.equal(
    (await c.post({ action: "start-near", treasury: TREASURY })).status,
    422,
  );
  assert.equal((await c.snapshot()).inputs.payments.length, 3);
  assert.equal((await c.start()).status, 303);
  const s = await c.snapshot();
  assert.equal(s.inputs.payments.length, 0);
  assert.equal(s.inputs.commitments.length, 0);
  assert.equal(s.inputs.received, "0");
  assert.equal(s.exampleData, false);
  assert.equal(s.network, "mainnet");
});

test("checked movement starts unresolved and cannot have its chain fields overwritten", async (t) => {
  const c = await client(t);
  await c.start();
  assert.equal(
    (
      await c.post({
        revision: "2",
        action: "check-transfer",
        transactionHash: HASH,
      })
    ).status,
    303,
  );
  const s = await c.snapshot(),
    p = s.inputs.payments[0];
  assert.equal(p.amount, "50");
  assert.equal(p.kind, "unresolved");
  assert.equal(p.purpose, "");
  assert.equal(p.reviewed, false);
  assert.equal(s.assessment.returnProposal, null);
  assert.equal(s.testFixtureData, true);
  const edit = await c.post({
    revision: "3",
    action: "payment",
    id: p.id,
    form: `payment-${p.id}`,
    recipient: p.recipient,
    reference: p.reference,
    amount: "1",
    kind: "expense",
    purpose: "Pretend",
    evidence: "Pretend",
    reviewed: "on",
  });
  assert.equal(edit.status, 422);
  assert.match(await edit.text(), /cannot be edited/);
  assert.equal((await c.snapshot()).inputs.payments[0].amount, "50");
});

test("RPC errors leave the current statement unchanged and do not fabricate success", async (t) => {
  const c = await client(t, {
    check: async () => {
      throw new NearCheckError(
        "unavailable",
        "Public RPC unavailable. No payment was added.",
      );
    },
  });
  await c.start();
  const result = await c.post({
    revision: "2",
    action: "check-transfer",
    transactionHash: HASH,
  });
  assert.equal(result.status, 503);
  assert.match(await result.text(), /Public RPC unavailable/);
  const s = await c.snapshot();
  assert.equal(s.revision, 2);
  assert.equal(s.inputs.payments.length, 0);
});

test("a stale slow receipt check cannot overwrite a later edit", async (t) => {
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const c = await client(t, {
    check: async () => {
      entered();
      await gate;
      return facts();
    },
  });
  await c.start();
  const checking = c.post({
    revision: "2",
    action: "check-transfer",
    transactionHash: HASH,
  });
  await started;
  const edit = await c.post({
    revision: "2",
    action: "terms",
    form: "terms-form",
    name: "Later edit",
    approved: "100",
    received: "100",
    balance: "100",
    policy: "unclear",
    termsReference: "Reported terms",
  });
  assert.equal(edit.status, 303);
  release();
  const old = await checking;
  assert.equal(old.status, 409);
  assert.match(await old.text(), /draft changed/);
  const s = await c.snapshot();
  assert.equal(s.inputs.name, "Later edit");
  assert.equal(s.inputs.payments.length, 0);
});

test("bad identifiers are rejected before RPC, and live mode blocks manual payments", async (t) => {
  let calls = 0;
  const c = await client(t, {
    check: async () => {
      calls++;
      return facts();
    },
  });
  await c.start();
  assert.equal(
    (
      await c.post({
        revision: "2",
        action: "check-transfer",
        transactionHash: "https://evil.example/tx",
      })
    ).status,
    422,
  );
  assert.equal(
    (await c.post({ revision: "2", action: "add-payment" })).status,
    422,
  );
  assert.equal(calls, 0);
});
