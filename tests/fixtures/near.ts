// Synthetic RPC-shaped data only. These zero-like hashes are NOT real transaction evidence.
import { USDC_CONTRACT } from "../../src/near/facts.ts";
export const HASH = "11111111111111111111111111111111";
export const RECEIPT = "11111111111111111111111111111112";
export const BLOCK = "11111111111111111111111111111113";
export const TREASURY = "fixture-treasury.near";
export const RECIPIENT = "fixture-recipient.near";
export function fixtureTransaction() {
  return {
    final_execution_status: "FINAL",
    status: { SuccessValue: "" },
    transaction: {
      hash: HASH,
      signer_id: TREASURY,
      receiver_id: USDC_CONTRACT,
      actions: [
        {
          FunctionCall: {
            method_name: "ft_transfer",
            args: Buffer.from(
              JSON.stringify({ receiver_id: RECIPIENT, amount: "50000000" }),
            ).toString("base64"),
            deposit: "1",
            gas: 30000000000000,
          },
        },
      ],
    },
    transaction_outcome: {
      id: HASH,
      outcome: {
        executor_id: TREASURY,
        receipt_ids: [RECEIPT],
        status: { SuccessReceiptId: RECEIPT },
      },
    },
    receipts_outcome: [
      {
        id: RECEIPT,
        block_hash: BLOCK,
        outcome: {
          executor_id: USDC_CONTRACT,
          receipt_ids: [] as string[],
          status: { SuccessValue: "" },
          logs: [
            `EVENT_JSON:${JSON.stringify({ standard: "nep141", version: "1.0.0", event: "ft_transfer", data: [{ old_owner_id: TREASURY, new_owner_id: RECIPIENT, amount: "50000000" }] })}`,
          ],
        },
      },
    ],
  };
}
