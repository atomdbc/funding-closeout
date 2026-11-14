import { validateProgram } from "../src/domain/closeout.ts";
import type { Program } from "../src/domain/closeout.ts";
import { restoreForReview } from "./storage.ts";

export function importStatement(source: string): Program {
  if (Buffer.byteLength(source) > 262144)
    throw new Error("Use a closeout JSON statement no larger than 256 KiB.");
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error(
      "This is not valid JSON. Choose a downloaded closeout statement; no changes were made.",
    );
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    !("format" in raw) ||
    !["funding-closeout-v1", "funding-closeout-v2"].includes(
      String(raw.format),
    ) ||
    !("inputs" in raw)
  )
    throw new Error(
      "Choose a supported funding-closeout v1 or v2 statement with its full inputs.",
    );
  // Reconstruct only known fields. Extra keys, supplied assessment/digest and approval claims are never trusted.
  try {
    const original = raw.inputs as Program;
    if (
      !original ||
      !Array.isArray(original.payments) ||
      !Array.isArray(original.commitments)
    )
      throw new Error();
    validateProgram(original);
    const program: Program = {
      name: original.name,
      ...(original.setupPending ? { setupPending: true as const } : {}),
      asset: original.asset,
      approved: original.approved,
      received: original.received,
      balance: original.balance,
      policy: original.policy,
      termsReference: original.termsReference,
      ...(original.chainReview
        ? {
            chainReview: {
              network: original.chainReview.network,
              treasury: original.chainReview.treasury,
              totalsReported: original.chainReview.totalsReported,
            },
          }
        : {}),
      paymentsComplete: false,
      commitmentsComplete: false,
      payments: original.payments.map((p) => ({
        id: p.id,
        recipient: p.recipient,
        amount: p.amount,
        reference: p.reference,
        kind: p.kind,
        purpose: p.purpose,
        evidence: p.evidence,
        reviewed: false,
        ...(p.chain
          ? {
              importedTransfer: {
                hash: p.chain.transactionHash,
                signer: p.chain.transactionSigner,
                basis: p.chain.basis,
              },
            }
          : p.importedTransfer
            ? {
                importedTransfer: {
                  hash: p.importedTransfer.hash,
                  signer: p.importedTransfer.signer,
                  basis: p.importedTransfer.basis,
                },
              }
            : {}),
      })),
      commitments: original.commitments.map((c) => ({
        id: c.id,
        payee: c.payee,
        purpose: c.purpose,
        remaining: c.remaining,
        evidence: c.evidence,
        reviewed: false,
      })),
    };
    return restoreForReview(program);
  } catch {
    throw new Error(
      "The statement inputs are incomplete or invalid. Check the asset, amounts, record limits and references. No changes were made.",
    );
  }
}
