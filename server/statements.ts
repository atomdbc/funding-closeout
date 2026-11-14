import { createHash } from "node:crypto";
import { assess } from "../src/domain/closeout.ts";
import type { Program } from "../src/domain/closeout.ts";

export function statement(program: Program, revision: number) {
  const inputs = structuredClone(program);
  const snapshot = {
    format: "funding-closeout-v2",
    exampleData: !inputs.chainReview && !inputs.setupPending,
    testFixtureData: inputs.payments.some(
      (p) =>
        p.chain?.basis === "test-fixture" ||
        p.importedTransfer?.basis === "test-fixture",
    ),
    network: inputs.chainReview ? "mainnet" : "none",
    approval: "not-signed",
    revision,
    inputs,
    assessment: assess(inputs),
    trustBoundary: {
      rpcCheckedOnlyWhereMarked: [
        "native USDC contract",
        "sender",
        "recipient",
        "quantity",
        "transaction/receipt IDs",
        "final execution outcome",
      ],
      reporterSupplied: [
        "program membership",
        "funding terms",
        "approved and received funding",
        "closing balance",
        "purpose",
        "supporting documents",
        "commitments",
        "coverage and review declarations",
      ],
      notProven: [
        "wallet ownership",
        "legal entitlement",
        "work completion",
        "document authenticity",
        "complete wallet history",
        "funder approval",
      ],
    },
  };
  return {
    ...snapshot,
    digestSha256: createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex"),
    disclaimer:
      "Local unsigned review. Fictional records and RPC-checked facts are separated by workspace and marked per record. Public RPC responses are trusted, not independently consensus-verified. Explanations, terms and balances are reporter-supplied. Not audited or approved by a funder; no funds moved through this app. The digest identifies this snapshot only.",
  };
}
