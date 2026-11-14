import type { Program } from "./closeout.ts";
/** An unconfigured review, not a fictional program and not evidence of zero funding. */
export function emptyProgram(): Program {
  return {
    name: "New review",
    setupPending: true,
    asset: "USDC",
    approved: "0",
    received: "0",
    balance: "0",
    policy: "unclear",
    termsReference: "",
    paymentsComplete: false,
    commitmentsComplete: false,
    payments: [],
    commitments: [],
  };
}
