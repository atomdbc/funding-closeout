import test from "node:test";
import assert from "node:assert/strict";
import { parseTransfer } from "../src/near/verify.ts";
import { USDC_CONTRACT } from "../src/near/facts.ts";
import {
  fixtureTransaction,
  HASH,
  RECEIPT,
  BLOCK,
  TREASURY,
} from "./fixtures/near.ts";

const CHILD = "11111111111111111111111111111114";
const DAO = "fixture-dao.near";
function daoTransaction() {
  const original = fixtureTransaction();
  const transferCall = structuredClone(original.transaction.actions);
  const token = structuredClone(original.receipts_outcome[0]!);
  token.id = CHILD;
  const event = JSON.parse(token.outcome.logs[0]!.slice(11));
  event.data[0].old_owner_id = DAO;
  token.outcome.logs[0] = `EVENT_JSON:${JSON.stringify(event)}`;
  return {
    ...original,
    transaction: {
      ...original.transaction,
      receiver_id: DAO,
      actions: [
        {
          FunctionCall: {
            method_name: "act",
            args: "e30=",
            deposit: "0",
            gas: 30000000000000,
          },
        },
      ],
    },
    receipts: [
      {
        receipt_id: CHILD,
        receiver_id: USDC_CONTRACT,
        predecessor_id: DAO,
        receipt: { Action: { actions: transferCall } },
      },
    ],
    receipts_outcome: [
      {
        id: RECEIPT,
        block_hash: BLOCK,
        outcome: {
          executor_id: DAO,
          receipt_ids: [CHILD],
          logs: [],
          status: { SuccessReceiptId: CHILD },
        },
      },
      token,
    ],
  };
}

test("a final DAO call binds the actual transfer payer separately from the transaction signer", () => {
  const f = parseTransfer(
    daoTransaction(),
    HASH,
    DAO,
    "test-fixture",
    "2026-11-14T08:00:00Z",
    TREASURY,
  );
  assert.equal(f.sender, DAO);
  assert.equal(f.transactionSigner, TREASURY);
  assert.equal(f.receiptId, CHILD);
  assert.equal(f.amount, "50");
});

test("DAO transfer requires its actual action receipt, not an event-shaped assertion", () => {
  const t = daoTransaction();
  t.receipts = [];
  assert.throws(
    () =>
      parseTransfer(
        t,
        HASH,
        DAO,
        "test-fixture",
        "2026-11-14T08:00:00Z",
        TREASURY,
      ),
    /action receipt is missing/,
  );
});

test("an event cannot override the actual predecessor or method in a DAO action receipt", () => {
  const t = daoTransaction();
  t.receipts[0]!.predecessor_id = TREASURY;
  assert.throws(
    () =>
      parseTransfer(
        t,
        HASH,
        DAO,
        "test-fixture",
        "2026-11-14T08:00:00Z",
        TREASURY,
      ),
    /actual transfer payer/,
  );
  t.receipts[0]!.predecessor_id = DAO;
  t.receipts[0]!.receipt.Action.actions[0]!.FunctionCall.method_name =
    "ft_transfer_call";
  assert.throws(
    () =>
      parseTransfer(
        t,
        HASH,
        DAO,
        "test-fixture",
        "2026-11-14T08:00:00Z",
        TREASURY,
      ),
    /not supported/,
  );
});

test("cyclic and detached receipt graphs fail closed", () => {
  const t = fixtureTransaction();
  t.receipts_outcome[0]!.outcome.receipt_ids.push(RECEIPT);
  assert.throws(
    () =>
      parseTransfer(t, HASH, TREASURY, "test-fixture", "2026-11-14T08:00:00Z"),
    /cycle/,
  );
  const separate = fixtureTransaction(),
    extra = structuredClone(separate.receipts_outcome[0]!);
  extra.id = CHILD;
  separate.receipts_outcome.push(extra);
  assert.throws(
    () =>
      parseTransfer(
        separate,
        HASH,
        TREASURY,
        "test-fixture",
        "2026-11-14T08:00:00Z",
      ),
    /not bound/,
  );
});
