import test from "node:test";
import assert from "node:assert/strict";
import {
  createNearReader,
  parseTransfer,
  publicRpc,
} from "../src/near/verify.ts";
import {
  accountId,
  hashId,
  RPC_ENDPOINT,
  USDC_CONTRACT,
} from "../src/near/facts.ts";
import { newNearReview, addCheckedTransfer } from "../src/near/review.ts";
import { assess, validateProgram } from "../src/domain/closeout.ts";
import { exampleProgram } from "../src/domain/demo.ts";
import { statement } from "../server/statements.ts";
import {
  fixtureTransaction,
  HASH,
  RECEIPT,
  TREASURY,
  RECIPIENT,
} from "./fixtures/near.ts";
const WHEN = "2026-11-14T08:00:00.000Z";
const parse = (data: unknown = fixtureTransaction()) =>
  parseTransfer(data, HASH, TREASURY, "test-fixture", WHEN);

function event(change: Record<string, unknown>) {
  const t = fixtureTransaction(),
    e = JSON.parse(t.receipts_outcome[0]!.outcome.logs[0]!.slice(11));
  Object.assign(e.data[0], change);
  t.receipts_outcome[0]!.outcome.logs[0] = `EVENT_JSON:${JSON.stringify(e)}`;
  return t;
}

test("parse final issuer-backed transfer facts without inventing purpose or ownership", () => {
  const f = parse();
  assert.equal(f.amount, "50");
  assert.equal(f.rawAmount, "50000000");
  assert.equal(f.recipient, RECIPIENT);
  assert.equal(f.sender, TREASURY);
  assert.equal(f.receiptId, RECEIPT);
  assert.equal(f.tokenContract, USDC_CONTRACT);
  assert.equal(f.basis, "test-fixture");
  assert.match(f.rpcResultSha256, /^[a-f0-9]{64}$/);
  assert(!("purpose" in f));
});

for (const finality of [
  "NONE",
  "INCLUDED_FINAL",
  "EXECUTED",
  "EXECUTED_OPTIMISTIC",
]) {
  test(`${finality} is insufficient for accounting finality`, () => {
    const t = fixtureTransaction();
    t.final_execution_status = finality;
    assert.throws(() => parse(t), /Final execution/);
  });
}

test("unknown and failed transactions are not evidence of a payment", () => {
  assert.throws(() => parse(null));
  const t = fixtureTransaction();
  Object.assign(t, { status: { Failure: { ActionError: "failed" } } });
  assert.throws(() => parse(t), /did not finish/);
});

test("the hash, actual signer and issuer contract must all match", () => {
  const t = fixtureTransaction();
  t.transaction.hash = RECEIPT;
  assert.throws(() => parse(t), /does not match/);
  t.transaction.hash = HASH;
  t.transaction.signer_id = RECIPIENT;
  assert.throws(() => parse(t), /does not match/);
  t.transaction.signer_id = TREASURY;
  t.transaction.receiver_id = "wrapped-usdc.near";
  assert.throws(() => parse(t), /missing/);
});

for (const method of [
  "ft_transfer_call",
  "act_proposal",
  "payout_batch",
  "storage_deposit",
]) {
  test(`unsupported ${method} is not guessed into a simple payment`, () => {
    const t = fixtureTransaction();
    t.transaction.actions[0]!.FunctionCall.method_name = method;
    assert.throws(() => parse(t), /not supported/);
  });
}

test("multiple actions and invalid base64/JSON are refused", () => {
  const t = fixtureTransaction();
  t.transaction.actions.push(structuredClone(t.transaction.actions[0]!));
  assert.throws(() => parse(t));
  t.transaction.actions.pop();
  t.transaction.actions[0]!.FunctionCall.args = "not base64";
  assert.throws(() => parse(t), /safely/);
});

for (const change of [
  { old_owner_id: RECIPIENT },
  { new_owner_id: TREASURY },
  { amount: "1" },
]) {
  test(`issuer event mismatch ${Object.keys(change)[0]} is rejected`, () =>
    assert.throws(() => parse(event(change)), /does not match/));
}

test("untrusted contracts cannot spoof native USDC events", () => {
  const t = fixtureTransaction();
  t.receipts_outcome[0]!.outcome.executor_id = "fake-usdc.near";
  assert.throws(() => parse(t), /single unambiguous/);
});

test("event must occur in the exact receipt reached by the transaction", () => {
  const t = fixtureTransaction();
  t.transaction_outcome.outcome.receipt_ids = [];
  assert.throws(() => parse(t), /bound/);
  t.transaction_outcome.outcome.receipt_ids = [RECEIPT];
  t.receipts_outcome[0]!.id = HASH;
  assert.throws(() => parse(t), /missing/);
});

test("duplicate/multiple events, receipt IDs and refund-like movement are not collapsed", () => {
  const t = fixtureTransaction();
  t.receipts_outcome[0]!.outcome.logs.push(
    t.receipts_outcome[0]!.outcome.logs[0]!,
  );
  assert.throws(() => parse(t), /single unambiguous/);
  const duplicate = fixtureTransaction();
  duplicate.receipts_outcome.push(
    structuredClone(duplicate.receipts_outcome[0]!),
  );
  assert.throws(() => parse(duplicate), /repeated/);
});

test("failed/incomplete execution receipts are not ignored", () => {
  const t = fixtureTransaction();
  Object.assign(t.receipts_outcome[0]!.outcome, { status: { Failure: "bad" } });
  assert.throws(() => parse(t), /receipt is failed/);
});

test("account IDs and transaction hashes accept public identifiers, not URLs or keys", () => {
  assert(accountId(TREASURY));
  assert(accountId("a".repeat(64)));
  assert(!accountId("ed25519:secret"));
  assert(!accountId("https://example.near"));
  assert(hashId(HASH));
  assert(!hashId("0".repeat(44)));
  assert(!hashId("z".repeat(44)));
  assert(!hashId("https://nearblocks.io/txns/" + HASH));
});

test("wrong network is rejected before querying transaction data", async () => {
  const calls: string[] = [];
  const reader = createNearReader(async (method) => {
    calls.push(method);
    return { chain_id: "testnet" };
  }, "test-fixture");
  await assert.rejects(reader.check(HASH, TREASURY), /mainnet/);
  assert.deepEqual(calls, ["status"]);
});

test("reader sends only documented read-only requests and explicitly asks for FINAL", async () => {
  const calls: { method: string; params: object }[] = [];
  const reader = createNearReader(async (method, params) => {
    calls.push({ method, params });
    return method === "status" ? { chain_id: "mainnet" } : fixtureTransaction();
  }, "test-fixture");
  await reader.check(HASH, TREASURY);
  assert.deepEqual(calls, [
    { method: "status", params: {} },
    {
      method: "EXPERIMENTAL_tx_status",
      params: {
        tx_hash: HASH,
        sender_account_id: TREASURY,
        wait_until: "FINAL",
      },
    },
  ]);
  assert.throws(
    () => createNearReader(async () => fixtureTransaction()),
    /test-fixture/,
  );
});

test("public transport has no signing/broadcast path and uses a fixed endpoint", async (t) => {
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request, init?: RequestInit) => {
      calls++;
      assert.equal(String(url), RPC_ENDPOINT);
      assert.equal(init?.redirect, "error");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.method, "status");
      assert(!("signed_tx_base64" in body.params));
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "closeout-readonly",
          result: { chain_id: "mainnet" },
        }),
      );
    },
  );
  assert.deepEqual(await publicRpc("status", {}), { chain_id: "mainnet" });
  await assert.rejects(publicRpc("send_tx" as "tx", {}), /read-only/);
  assert.equal(calls, 1);
});

test("RPC failure is an unavailable result, never synthetic success", async () => {
  const reader = createNearReader(async () => {
    throw new Error("offline");
  }, "test-fixture");
  await assert.rejects(reader.check(HASH, TREASURY), /could not be verified/);
});

test("real/fixture checks cannot be silently inserted into the fictional example", () => {
  assert.throws(
    () => addCheckedTransfer(exampleProgram(), parse()),
    /separate NEAR review/,
  );
});

test("new NEAR review is empty and import does not invent funding, purpose or approval", () => {
  const p = addCheckedTransfer(newNearReview(TREASURY), parse());
  assert.equal(p.received, "0");
  assert.equal(p.balance, "0");
  assert.equal(p.policy, "unclear");
  assert.equal(p.payments[0]!.purpose, "");
  assert.equal(p.payments[0]!.evidence, "");
  assert.equal(p.payments[0]!.reviewed, false);
  assert.equal(assess(p).unresolvedOutflow, "50");
  assert.equal(assess(p).returnProposal, null);
  assert.throws(() => addCheckedTransfer(p, parse()), /already recorded/);
});

for (const field of ["amount", "recipient", "reference"] as const) {
  test(`imported ${field} cannot be rewritten while retaining checked provenance`, () => {
    const p = addCheckedTransfer(newNearReview(TREASURY), parse());
    p.payments[0]![field] = field === "amount" ? "1" : "changed";
    assert.throws(() => validateProgram(p), /cannot be changed/);
  });
}

test("explanations stay editable and export separates public facts from human claims", () => {
  const p = addCheckedTransfer(newNearReview(TREASURY), parse());
  const facts = structuredClone(p.payments[0]!.chain);
  Object.assign(p.payments[0]!, {
    kind: "expense",
    purpose: "Reporter explanation",
    evidence: "Private invoice reference, not fetched",
    reviewed: true,
  });
  validateProgram(p);
  assert.deepEqual(p.payments[0]!.chain, facts);
  const s = statement(p, 2);
  assert.equal(s.exampleData, false);
  assert.equal(s.testFixtureData, true);
  assert.equal(s.network, "mainnet");
  assert.equal(s.approval, "not-signed");
  assert(s.trustBoundary.notProven.includes("wallet ownership"));
  assert(s.trustBoundary.reporterSupplied.includes("closing balance"));
});
