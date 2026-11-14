import { decimal, units } from "./money.ts";
import {
  accountId,
  hashId,
  RPC_ENDPOINT,
  transferReference,
  USDC_CONTRACT,
} from "../near/facts.ts";
import type { TransferFacts } from "../near/facts.ts";

export type Policy = "return-unspent" | "fixed-award" | "unclear";
export type PaymentKind = "unresolved" | "expense" | "returned";
export interface Payment {
  id: string;
  recipient: string;
  amount: string;
  reference: string;
  kind: PaymentKind;
  purpose: string;
  evidence: string;
  reviewed: boolean;
  chain?: TransferFacts;
  importedTransfer?: {
    hash: string;
    signer: string;
    basis: "public-rpc" | "test-fixture";
  };
}
export interface Commitment {
  id: string;
  payee: string;
  purpose: string;
  remaining: string;
  evidence: string;
  reviewed: boolean;
}
export interface Program {
  /** Empty setup state. No funding/treasury has been entered yet. */
  setupPending?: true;
  name: string;
  asset: "USDC";
  approved: string;
  received: string;
  balance: string;
  policy: Policy;
  termsReference: string;
  chainReview?: {
    network: "mainnet";
    treasury: string;
    totalsReported: boolean;
  };
  paymentsComplete: boolean;
  commitmentsComplete: boolean;
  payments: Payment[];
  commitments: Commitment[];
}
export interface Assessment {
  supportedExpenses: string;
  supportedReturns: string;
  unresolvedOutflow: string;
  totalOutflow: string;
  commitments: string;
  balance: string | null;
  fundingReceived: string | null;
  approvedAmount: string | null;
  cashDifference: string | null;
  cashAfterCommitments: string | null;
  shortfall: string | null;
  unresolvedPaymentIds: string[];
  unreviewedCommitmentIds: string[];
  blockers: string[];
  returnProposal: string | null;
  readyForReview: boolean;
}

export function supported(p: Payment): boolean {
  return (
    p.kind !== "unresolved" &&
    p.reviewed &&
    !!p.recipient.trim() &&
    !!p.reference.trim() &&
    !!p.purpose.trim() &&
    !!p.evidence.trim()
  );
}

/** This assesses reporter-supplied records, not bank finality, legality or authenticity. */
export function assess(program: Program): Assessment {
  validateProgram(program);
  let expenses = 0n,
    returns = 0n,
    unknown = 0n,
    total = 0n,
    owed = 0n;
  const unresolvedPaymentIds: string[] = [];
  const unreviewedCommitmentIds: string[] = [];
  for (const p of program.payments) {
    const amount = units(p.amount);
    total += amount;
    if (!supported(p) || (program.chainReview && !p.chain)) {
      unknown += amount;
      unresolvedPaymentIds.push(p.id);
    } else if (p.kind === "expense") expenses += amount;
    else returns += amount;
  }
  for (const c of program.commitments) {
    owed += units(c.remaining);
    if (
      !c.reviewed ||
      !c.evidence.trim() ||
      !c.payee.trim() ||
      !c.purpose.trim()
    ) {
      unreviewedCommitmentIds.push(c.id);
    }
  }
  const approved = units(program.approved),
    received = units(program.received),
    balance = units(program.balance);
  const difference = received - total - balance;
  const after = balance - owed;
  const totalsReported =
    !program.setupPending &&
    (!program.chainReview || program.chainReview.totalsReported);
  const blockers: string[] = [];
  if (!totalsReported)
    blockers.push(
      "Enter the approved funding, received funding and reported closing balance. These are not inferred from a transfer.",
    );
  if (!program.termsReference.trim())
    blockers.push("Add the approved funding terms.");
  if (program.policy === "unclear")
    blockers.push(
      "Confirm whether the terms require unused funds to be returned.",
    );
  if (program.policy === "fixed-award")
    blockers.push(
      "Fixed-award terms do not establish an unused-funds return obligation.",
    );
  if (!program.paymentsComplete)
    blockers.push("Confirm the payment list covers this program and period.");
  if (!program.commitmentsComplete)
    blockers.push("Confirm all remaining commitments have been recorded.");
  if (unresolvedPaymentIds.length)
    blockers.push(
      `${unresolvedPaymentIds.length} payment${unresolvedPaymentIds.length === 1 ? " needs" : "s need"} an explanation, evidence and review.`,
    );
  if (program.chainReview && program.payments.some((p) => !p.chain))
    blockers.push("A NEAR review payment is missing an RPC-checked transfer.");
  if (unreviewedCommitmentIds.length)
    blockers.push("Review the evidence for outstanding commitments.");
  if (totalsReported && difference !== 0n)
    blockers.push(
      "Funding, outflows and the closing balance do not reconcile.",
    );
  if (totalsReported && received > approved)
    blockers.push(
      "Received funding exceeds the approved amount. Review the funding scope.",
    );
  if (totalsReported && after < 0n)
    blockers.push(
      "The stated balance does not cover the remaining commitments.",
    );
  if (
    totalsReported &&
    program.policy === "return-unspent" &&
    expenses + owed > approved
  )
    blockers.push("Expenses and commitments exceed the approved amount.");
  const ready = blockers.length === 0;
  return {
    supportedExpenses: decimal(expenses),
    supportedReturns: decimal(returns),
    unresolvedOutflow: decimal(unknown),
    totalOutflow: decimal(total),
    commitments: decimal(owed),
    balance: totalsReported ? decimal(balance) : null,
    fundingReceived: totalsReported ? decimal(received) : null,
    approvedAmount: totalsReported ? decimal(approved) : null,
    cashDifference: totalsReported ? decimal(difference) : null,
    cashAfterCommitments: totalsReported ? decimal(after) : null,
    shortfall: totalsReported ? decimal(after < 0n ? -after : 0n) : null,
    unresolvedPaymentIds,
    unreviewedCommitmentIds,
    blockers,
    returnProposal: ready ? decimal(after) : null,
    readyForReview: ready,
  };
}

export function validateProgram(p: Program): void {
  const text = (v: unknown, label: string, max = 1000) => {
    if (
      typeof v !== "string" ||
      v.length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
    )
      throw new Error(
        `${label} is too long or contains unsupported characters.`,
      );
  };
  text(p.name, "Program name", 100);
  if (!p.name.trim()) throw new Error("Enter a program name.");
  if (p.asset !== "USDC")
    throw new Error(
      "This prototype supports one asset: USDC. Do not mix assets.",
    );
  for (const value of [p.approved, p.received, p.balance]) units(value);
  if (!["return-unspent", "fixed-award", "unclear"].includes(p.policy))
    throw new Error("Choose a funding policy.");
  text(p.termsReference, "Funding terms");
  if (
    p.setupPending !== undefined &&
    (p.setupPending !== true ||
      p.chainReview ||
      p.payments.length ||
      p.commitments.length ||
      p.approved !== "0" ||
      p.received !== "0" ||
      p.balance !== "0" ||
      p.termsReference ||
      p.paymentsComplete ||
      p.commitmentsComplete ||
      p.policy !== "unclear")
  )
    throw new Error(
      "An unconfigured review cannot contain financial records. Create the review first.",
    );
  if (
    p.chainReview &&
    (p.chainReview.network !== "mainnet" ||
      !accountId(p.chainReview.treasury) ||
      typeof p.chainReview.totalsReported !== "boolean")
  )
    throw new Error("Choose a valid NEAR mainnet treasury account.");
  if (
    typeof p.paymentsComplete !== "boolean" ||
    typeof p.commitmentsComplete !== "boolean"
  )
    throw new Error("Coverage confirmations must be explicit.");
  if (p.payments.length > 50 || p.commitments.length > 50)
    throw new Error(
      "This local prototype allows 50 payments and 50 commitments.",
    );
  const ids = new Set<string>(),
    references = new Set<string>();
  for (const item of [...p.payments, ...p.commitments]) {
    text(item.id, "Record ID", 80);
    if (!/^[a-zA-Z0-9-]+$/.test(item.id) || ids.has(item.id))
      throw new Error("Record IDs must be unique.");
    ids.add(item.id);
    if (typeof item.reviewed !== "boolean")
      throw new Error("Review must be explicit.");
    text(item.purpose, "Purpose");
    text(item.evidence, "Evidence");
    if ("amount" in item) {
      units(item.amount);
      if (
        item.importedTransfer &&
        (!p.chainReview ||
          item.chain ||
          !hashId(item.importedTransfer.hash) ||
          !accountId(item.importedTransfer.signer) ||
          !["public-rpc", "test-fixture"].includes(item.importedTransfer.basis))
      )
        throw new Error(
          "Imported transfer hints must be unverified public identifiers in a NEAR review.",
        );
      if (item.chain) {
        const c = item.chain;
        if (
          !p.chainReview ||
          c.network !== "mainnet" ||
          c.sender !== p.chainReview.treasury ||
          c.tokenContract !== USDC_CONTRACT ||
          c.symbol !== "USDC" ||
          c.decimals !== 6 ||
          !["public-rpc", "test-fixture"].includes(c.basis) ||
          c.provider !==
            (c.basis === "public-rpc" ? RPC_ENDPOINT : "test-fixture") ||
          !hashId(c.transactionHash) ||
          !hashId(c.receiptId) ||
          !hashId(c.blockHash) ||
          !accountId(c.transactionSigner) ||
          !accountId(c.recipient) ||
          c.recipient === c.sender ||
          c.method !== "ft_transfer" ||
          c.finalExecutionStatus !== "FINAL" ||
          !/^[1-9]\d*$/.test(c.rawAmount) ||
          units(item.amount).toString() !== c.rawAmount ||
          c.amount !== decimal(BigInt(c.rawAmount)) ||
          item.recipient !== c.recipient ||
          item.reference !== transferReference(c) ||
          !/^[a-f0-9]{64}$/.test(c.rpcResultSha256) ||
          !Number.isFinite(Date.parse(c.checkedAt))
        )
          throw new Error(
            "Checked transfer facts cannot be changed or mixed with fictional records.",
          );
      }
      text(item.recipient, "Recipient", 100);
      text(item.reference, "Payment reference", 150);
      if (!["unresolved", "expense", "returned"].includes(item.kind))
        throw new Error("Choose a payment classification.");
      const ref = item.reference.trim();
      if (ref && references.has(ref))
        throw new Error(
          "This payment reference is already recorded. Do not count a transfer twice.",
        );
      if (ref) references.add(ref);
    } else {
      units(item.remaining);
      text(item.payee, "Payee", 100);
    }
  }
}
