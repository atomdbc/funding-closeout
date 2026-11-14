import type { Program } from "./closeout.ts";

/** Fictional records, never sourced from or attributed to an actual grant recipient. */
export function exampleProgram(): Program {
  return {
    name: "Community tools pilot",
    asset: "USDC",
    approved: "1000",
    received: "1000",
    balance: "400",
    policy: "return-unspent",
    termsReference:
      "DEMO-TERMS-01: return unused funds after all obligations are settled.",
    paymentsComplete: false,
    commitmentsComplete: false,
    payments: [
      {
        id: "pay-build",
        recipient: "Demo builder",
        amount: "300",
        reference: "DEMO-PAY-001",
        kind: "expense",
        purpose: "Prototype build",
        evidence: "DEMO-INVOICE-01 — fictional approved build invoice",
        reviewed: true,
      },
      {
        id: "pay-testing",
        recipient: "Demo test coordinator",
        amount: "250",
        reference: "DEMO-PAY-002",
        kind: "expense",
        purpose: "Testing sessions",
        evidence: "DEMO-INVOICE-02 — fictional testing-session record",
        reviewed: true,
      },
      {
        id: "pay-unknown",
        recipient: "Unidentified demo recipient",
        amount: "50",
        reference: "DEMO-PAY-003",
        kind: "unresolved",
        purpose: "",
        evidence: "",
        reviewed: false,
      },
    ],
    commitments: [
      {
        id: "due-docs",
        payee: "Demo documentation contributor",
        purpose: "Documentation still to be delivered",
        remaining: "250",
        evidence: "DEMO-AGREEMENT-03 — fictional outstanding commitment",
        reviewed: true,
      },
    ],
  };
}
