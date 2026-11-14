import { validateProgram } from "../domain/closeout.ts";
import type { Program } from "../domain/closeout.ts";
import { accountId, transferReference } from "./facts.ts";
import type { TransferFacts } from "./facts.ts";

export function newNearReview(treasury: string): Program {
  if (!accountId(treasury))
    throw new Error("Enter the sending NEAR account, not a wallet key or URL.");
  return {
    name: `${treasury} closeout`,
    asset: "USDC",
    approved: "0",
    received: "0",
    balance: "0",
    policy: "unclear",
    termsReference: "",
    chainReview: { network: "mainnet", treasury, totalsReported: false },
    paymentsComplete: false,
    commitmentsComplete: false,
    payments: [],
    commitments: [],
  };
}
export function addCheckedTransfer(
  program: Program,
  facts: TransferFacts,
): Program {
  if (!program.chainReview)
    throw new Error(
      "Start a separate NEAR review first. Real transfers cannot be added to the fictional example.",
    );
  const next = structuredClone(program);
  const reference = transferReference(facts);
  if (next.payments.some((p) => p.reference === reference))
    throw new Error(
      "This transfer is already recorded. It has not been counted again.",
    );
  next.payments.push({
    id: `near-${facts.transactionHash}`,
    recipient: facts.recipient,
    amount: facts.amount,
    reference,
    kind: "unresolved",
    purpose: "",
    evidence: "",
    reviewed: false,
    chain: structuredClone(facts),
  });
  next.paymentsComplete = false;
  validateProgram(next);
  return next;
}
