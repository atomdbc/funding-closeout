import { createHash } from "node:crypto";
import { statement } from "./statements.ts";
import type { Program } from "../src/domain/closeout.ts";
import { money } from "../src/domain/money.ts";
import { escape as e } from "../web/view.ts";
const css = `:root{color-scheme:light}*{box-sizing:border-box}body{margin:0 auto;max-width:960px;padding:32px;color:#17292c;background:white;font:15px/1.6 system-ui,sans-serif}h1{font-size:30px;line-height:1.2}h2{margin-top:32px;font-size:20px}h3{font-size:16px}p,dd,td{overflow-wrap:anywhere;white-space:pre-wrap}dt{font-weight:650}dd{margin:0 0 10px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #c8d0d1;vertical-align:top}.money{font-variant-numeric:tabular-nums;font-family:ui-monospace,monospace}.notice{padding:16px;border:2px solid #9e6917}.record{break-inside:avoid;border-top:1px solid #c8d0d1;margin-top:20px;padding-top:12px}.small{font-size:12px}code{overflow-wrap:anywhere}@media print{body{padding:0;max-width:none}h2,h3{break-after:avoid}thead{display:table-header-group}@page{margin:18mm}}`;
export function reviewPacket(program: Program, revision: number): string {
  const s = statement(program, revision),
    a = s.assessment;
  const styleHash = createHash("sha256").update(css).digest("base64");
  const pair = (label: string, value: unknown) =>
    `<dt>${e(label)}</dt><dd>${e(value)}</dd>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'sha256-${styleHash}'; base-uri 'none'; form-action 'none'"><title>Closeout review — ${e(program.name)}</title><style>${css}</style></head><body><header><p>FUNDING CLOSEOUT · UNSIGNED REVIEW PACKET</p><h1>${e(program.name)}</h1><p>Draft ${revision}. Use the browser's Print command to print or save as PDF.</p><p class="notice">${program.setupPending ? "REVIEW NOT CREATED — no financial totals have been entered." : s.exampleData ? "FICTIONAL EXAMPLE — not real payment evidence." : s.testFixtureData ? "CONTAINS SYNTHETIC TEST FIXTURES — not live payment evidence." : "Reporter-supplied closeout. Only individually marked movement facts were checked against public NEAR RPC."} No authenticated funder approval, wallet ownership, legal entitlement or document authenticity is established. No funds move through this report.</p></header>
  <h2>Closeout decision still needed</h2><p>${a.readyForReview ? "Ready for human review, not approved or paid." : "Not ready for a return proposal."}</p><table><thead><tr><th scope="col">Measure</th><th scope="col">USDC quantity</th></tr></thead><tbody>${[
    ["Approved funding", a.approvedAmount],
    ["Funding received", a.fundingReceived],
    ["Supported by reporter", a.supportedExpenses],
    ["Returns already recorded", a.supportedReturns],
    ["Unresolved outflows", a.unresolvedOutflow],
    ["Reported closing balance", a.balance],
    ["Remaining commitments", a.commitments],
    ["Cash after stated commitments", a.cashAfterCommitments],
    ["Conditional proposed return", a.returnProposal],
  ]
    .map(
      ([label, amount]) =>
        `<tr><th scope="row">${e(label)}</th><td class="money">${e(label === "Conditional proposed return" && amount === null ? "Not established" : money(amount))}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table><p>Cash after commitments is not by itself a return entitlement. USDC quantities only; no USD conversion.</p>${a.blockers.length ? `<h3>Unresolved matters</h3><ul>${a.blockers.map((b) => `<li>${e(b)}</li>`).join("")}</ul>` : ""}
  <h2>Reported funding terms</h2><dl>${pair("Return policy", program.policy)}${pair("Terms / reference", program.termsReference || "Not supplied")}${pair("Payment scope declared complete", program.paymentsComplete ? "Yes — reporter declaration" : "No")}${pair("Commitments declared complete", program.commitmentsComplete ? "Yes — reporter declaration" : "No")}</dl>
  <h2>Payments and exceptions (${program.payments.length})</h2>${program.payments.map((p) => `<article class="record"><h3>${e(p.recipient || "Recipient not supplied")} · <span class="money">${e(money(p.amount))}</span></h3><dl>${pair("Reference", p.reference)}${pair("Classification — reporter supplied", p.kind)}${pair("Purpose — reporter supplied", p.purpose || "Unknown")}${pair("Evidence reference — not fetched or authenticated", p.evidence || "Missing")}${pair("Reporter review", p.reviewed ? "Marked reviewed, not authenticated funder approval" : "Not reviewed")}${p.chain ? pair("Movement source", p.chain.basis === "public-rpc" ? "Final success checked against trusted public RPC; not independent consensus verification" : "SYNTHETIC TEST FIXTURE — not live verification") + pair("Transfer payer / transaction signer", p.chain.sender + " / " + p.chain.transactionSigner) + pair("Issuer contract", p.chain.tokenContract) + pair("Transaction / receipt", p.chain.transactionHash + " / " + p.chain.receiptId) + pair("Receipt block", p.chain.blockHash) + pair("Checked at (not payment date)", p.chain.checkedAt) + pair("RPC-result byte digest", p.chain.rpcResultSha256) : pair("Movement verification", p.importedTransfer ? "Imported claim — NOT rechecked against NEAR" : "Not independently checked")}</dl></article>`).join("") || "<p>No payments recorded. This does not prove no payments occurred.</p>"}
  <h2>Remaining obligations (${program.commitments.length})</h2>${program.commitments.map((c) => `<article class="record"><h3>${e(c.payee || "Payee not supplied")} · <span class="money">${e(money(c.remaining))}</span></h3><dl>${pair("Still owed / to deliver", c.purpose)}${pair("Evidence reference", c.evidence)}${pair("Reporter review", c.reviewed ? "Marked reviewed — not independent verification" : "Not reviewed")}</dl></article>`).join("") || "<p>No commitments recorded. Completeness requires a separate reporter declaration.</p>"}
  <h2>Human review</h2><p>The reviewer must assess the terms, exceptions, coverage and unpaid obligations. This packet records no signature or decision. Any actual approval and any return transaction must happen separately.</p><footer><p class="small">Snapshot SHA-256: <code>${e(s.digestSha256)}</code><br>Identifies the accompanying JSON inputs/assessment snapshot, not authenticity, legal validity or a signature. The HTML file itself has a different byte representation. Download the JSON statement for the full machine-readable snapshot.</p><p class="small">${e(s.disclaimer)}</p></footer></body></html>`;
}
