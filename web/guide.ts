import { assess } from "../src/domain/closeout.ts";
import type { Program } from "../src/domain/closeout.ts";
import { money } from "../src/domain/money.ts";
import { RPC_ENDPOINT, USDC_CONTRACT } from "../src/near/facts.ts";
import { escape as e } from "./view.ts";
import type { ViewState } from "./view.ts";
import {
  amount,
  blockerStep,
  checkbox,
  field,
  hidden,
  ic,
  moneyPanel,
  notices,
  page,
  plainBlocker,
  select,
  stepInfo,
  stepStatus,
  svg,
} from "./flow/ui.ts";

export const steps = [
  "terms",
  "source",
  "payments",
  "commitments",
  "scope",
  "result",
] as const;
export type GuideStep = (typeof steps)[number];
export function guideStep(params: URLSearchParams, key = "step"): GuideStep {
  const value = params.get(key) ?? "terms";
  if (params.getAll(key).length > 1 || !steps.includes(value as GuideStep))
    throw new Error(
      "Choose terms, source, payments, commitments, scope or result.",
    );
  return value as GuideStep;
}

const q = (s: GuideStep) => `/guided?step=${s}`;
const explorerTx = (hash: string) =>
  `https://nearblocks.io/txns/${encodeURIComponent(hash)}`;
const explorerAccount = (account: string) =>
  `https://nearblocks.io/address/${encodeURIComponent(account)}?tab=tokentxns`;

/** A form that saves and returns to this step (or moves on with next=). */
function form(
  state: ViewState,
  step: GuideStep,
  action: string,
  id: string,
  rowId = "",
  next?: GuideStep,
) {
  return `<form id="${id}" class="f-form" method="post" action="/edit?flow=${step}${next ? `&amp;next=${next}` : ""}">${hidden(state, action, id, rowId)}`;
}

function stepper(p: Program, current: GuideStep): string {
  const a = assess(p);
  return `<ol class="f-steps" aria-label="Review steps">${steps
    .map((s, i) => {
      const st = stepStatus(p, a, s);
      return `<li class="is-${st}${s === current ? " is-current" : ""}"><a data-guide-nav href="${q(s)}"${s === current ? ' aria-current="step"' : ""}><span class="f-step-dot" aria-hidden="true">${st === "done" && s !== current ? svg(ic.check, 14) : i + 1}</span><span class="f-step-label">${stepInfo[s].short}<small>${st === "done" ? "Done" : st === "attention" ? "Needs attention" : "To do"}</small></span></a></li>`;
    })
    .join("")}</ol>`;
}

function intro(
  step: GuideStep,
  index: number,
  lead: string,
  needs: string[] = [],
): string {
  return `<div class="f-intro"><p class="f-kicker">Step ${index + 1} of ${steps.length}</p><h1>${stepInfo[step].title}</h1><p class="f-lead">${lead}</p>${needs.length ? `<ul class="f-needs" aria-label="You'll need">${needs.map((n) => `<li>${svg(ic.doc, 15)}${n}</li>`).join("")}</ul>` : ""}</div>`;
}

function terms(state: ViewState): string {
  const p = state.program,
    reported = !!p.chainReview?.totalsReported,
    f = "terms-form";
  return `${intro("terms", 0, "Copy these from your grant agreement and your own books. We never guess them from the blockchain: a transfer shows money moving, not what was agreed.", ["Your grant or funding agreement", "Your closing balance"])}
  <section class="f-card">${form(state, "terms", "terms", f, "", "source")}
    ${field(state, f, "name", "Program name", p.name, { required: true, hint: "Shown at the top of your report." })}
    <div class="f-grid3">
      ${field(state, f, "approved", "Approved by the funder", reported ? p.approved : "", { amount: true, required: true, placeholder: "25000", hint: "The total in the agreement." })}
      ${field(state, f, "received", "Actually received", reported ? p.received : "", { amount: true, required: true, placeholder: "25000", hint: "What arrived in the treasury." })}
      ${field(state, f, "balance", "Left in the treasury now", reported ? p.balance : "", { amount: true, required: true, placeholder: "6350", hint: "From your records, today." })}
    </div>
    ${select(
      state,
      f,
      "policy",
      "What happens to money that isn't used?",
      p.policy,
      [
        ["unclear", "Not sure yet / not written down"],
        [
          "return-unspent",
          "It goes back to the funder (after paying what's owed)",
        ],
        ["fixed-award", "It's a fixed award. The team keeps it"],
      ],
      "Pick what your agreement says. This decides whether anything is returnable.",
    )}
    ${field(state, f, "termsReference", "Where are these terms written?", p.termsReference, { area: true, placeholder: "e.g. Grant agreement v2, section 4: unused funds are returned within 30 days of the end date.", hint: "A document name and the exact clause is perfect." })}
    <div class="f-actions"><button type="submit">Save and continue ${svg(ic.arrow)}</button></div>
  </form></section>`;
}

function source(state: ViewState): string {
  const p = state.program,
    cr = p.chainReview,
    f = "near-check-form";
  if (!cr)
    return `${intro("source", 1, "This older draft has no NEAR treasury, so payments can't be checked here.")}<section class="f-card"><p>Create a new review with your treasury account to check payments on NEAR.</p><div class="f-actions"><a class="f-btn" href="/app">Go to your reviews</a></div></section>`;
  const list = p.payments.length
    ? `<ul class="f-list">${p.payments
        .map(
          (r) =>
            `<li><span class="f-list-main"><strong>${e(r.chain?.recipient ?? r.recipient ?? "Payment")}</strong><small>${r.chain ? `<a href="${explorerTx(r.chain.transactionHash)}" target="_blank" rel="noopener noreferrer">${e(r.chain.transactionHash.slice(0, 10))}…</a>` : e(r.reference)}</small></span><span class="f-amt">${e(money(r.amount))}</span>${r.chain ? `<span class="f-badge is-near">${svg(ic.check, 13)}Checked on NEAR</span>` : `<span class="f-badge is-warn">Not checked</span>`}</li>`,
        )
        .join("")}</ul>`
    : `<p class="f-empty">No payments yet. Add the first one above.</p>`;
  return `${intro("source", 1, `Paste the transaction hash of each USDC payment the treasury <strong>${e(cr.treasury)}</strong> made for this program. We look it up on NEAR mainnet and record who paid, who received it and the exact amount. Nothing is signed and no wallet is connected.`)}
  <section class="f-card">${form(state, "source", "check-transfer", f)}
    ${field(state, f, "transactionHash", "Transaction hash", "", { required: true, mono: true, placeholder: "Paste the hash (about 44 letters and numbers)", hint: "The hash only, not the explorer link." })}
    <details class="f-more"${state.error?.form === f && (state.error.field === "transactionSigner" || state.error.message.includes("signed by")) ? " open" : ""}><summary>Paid through a DAO or a relayer?</summary>
      ${field(state, f, "transactionSigner", "Who signed the transaction (if not the treasury)", "", { mono: true, placeholder: "e.g. council-member.near", hint: "For Sputnik DAO payouts, the account that submitted the transaction. Leave blank otherwise. Never a key." })}
    </details>
    <div class="f-actions"><button type="submit" data-busy-label="Checking NEAR…">${svg(ic.plus)}Check on NEAR and add</button></div>
  </form>
  <div class="f-help"><p><strong>Where do I find the hash?</strong> Open your treasury's token transfers on an explorer, find a USDC payment out, and copy its transaction hash.</p><a href="${explorerAccount(cr.treasury)}" target="_blank" rel="noopener noreferrer">${svg(ic.link, 15)}Open ${e(cr.treasury)} on NearBlocks</a></div>
  </section>
  <section class="f-card" id="added"><div class="f-card-head"><h2>Payments added</h2><span>${p.payments.length}</span></div>${list}</section>
  <details class="f-tech"><summary>What exactly is checked?</summary><p>One successful, final Circle native USDC <code>ft_transfer</code> from the treasury (or a traceable DAO/relayer call), read from <code>${RPC_ENDPOINT}</code>. Contract <code>${USDC_CONTRACT}</code>, six decimals. Failed, refunded, wrapped or multi-transfer transactions are rejected instead of guessed. A transfer proves money moved; it doesn't prove why.</p></details>`;
}

function explain(state: ViewState): string {
  const p = state.program,
    a = assess(p);
  if (!p.payments.length)
    return `${intro("payments", 2, "Once payments are added, you'll explain each one here.")}<section class="f-card f-empty-card"><p>No payments to explain yet.</p><a class="f-btn" data-guide-nav href="${q("source")}">${svg(ic.back)}Add payments first</a></section>`;
  const cards = p.payments
    .map((r, i) => {
      const f = `payment-${r.id}`,
        open = a.unresolvedPaymentIds.includes(r.id);
      const c = r.chain;
      return `<details class="f-card f-record${open ? " needs" : ""}" id="${f}"${open || state.error?.form === f ? " open" : ""}><summary><span class="f-rec-title"><strong>${e(c?.recipient ?? (r.recipient || `Payment ${i + 1}`))}</strong><small>${r.purpose ? e(r.purpose.slice(0, 80)) : "No explanation yet"}</small></span><span class="f-amt">${e(money(r.amount))}</span><span class="f-badge ${open ? "is-warn" : "is-ok"}">${open ? "Needs explanation" : "Explained"}</span></summary>
      <div class="f-rec-body">
        ${c ? `<div class="f-facts"><p class="f-facts-title">${svg(ic.lock, 14)}From NEAR mainnet · locked</p><dl><div><dt>Paid by</dt><dd>${e(c.sender)}</dd></div><div><dt>Received by</dt><dd>${e(c.recipient)}</dd></div><div><dt>Amount</dt><dd>${e(money(c.amount))}</dd></div><div><dt>Signed by</dt><dd>${e(c.transactionSigner)}</dd></div><div><dt>Transaction</dt><dd><a href="${explorerTx(c.transactionHash)}" target="_blank" rel="noopener noreferrer"><code>${e(c.transactionHash)}</code></a></dd></div><div><dt>Checked</dt><dd>${e(c.checkedAt)}${c.basis === "test-fixture" ? " (test fixture)" : ""}</dd></div></dl></div>` : ""}
        ${form(state, "payments", "payment", f, r.id)}
          <input type="hidden" name="recipient" value="${e(r.recipient)}"><input type="hidden" name="amount" value="${e(r.amount)}"><input type="hidden" name="reference" value="${e(r.reference)}">
          ${select(state, f, "kind", "What kind of payment was this?", r.kind, [
            ["unresolved", "Not decided yet"],
            ["expense", "Spent on the program (work, services, costs)"],
            ["returned", "Money returned to the funder"],
          ])}
          ${field(state, f, "purpose", "What did it pay for?", r.purpose, { area: true, placeholder: "e.g. Milestone 1: design of the onboarding flow", hint: "Plain words your funder will understand." })}
          ${field(state, f, "evidence", "Where's the proof?", r.evidence, { area: true, placeholder: "e.g. Invoice #104, signed milestone report in shared drive /grants/r3", hint: "Invoice number, contract, link. We store the reference; we don't open it." })}
          ${checkbox(state, f, "reviewed", "I've checked this explanation and its proof.", r.reviewed)}
          <div class="f-actions"><button type="submit">Save explanation</button><button class="f-link-danger" type="submit" name="remove" value="yes" formnovalidate>Remove payment</button></div>
        </form>
      </div></details>`;
    })
    .join("");
  return `${intro("payments", 2, "NEAR shows the money moved. Only you can say why. Explain each payment in plain words and point to the proof. Anything left unexplained is flagged in the report, never quietly counted as fine.")}${cards}`;
}

function owed(state: ViewState): string {
  const p = state.program,
    a = assess(p);
  const cards = p.commitments
    .map((r) => {
      const f = `commitment-${r.id}`,
        open = a.unreviewedCommitmentIds.includes(r.id);
      return `<details class="f-card f-record${open ? " needs" : ""}" id="${f}"${open || state.error?.form === f ? " open" : ""}><summary><span class="f-rec-title"><strong>${e(r.payee || "Who is owed?")}</strong><small>${e(r.purpose || "Details not filled in")}</small></span><span class="f-amt">${e(money(r.remaining))}</span><span class="f-badge ${open ? "is-warn" : "is-owed"}">${open ? "Needs details" : "Still owed"}</span></summary>
      <div class="f-rec-body">${form(state, "commitments", "commitment", f, r.id)}
        <div class="f-grid2">${field(state, f, "payee", "Who is owed?", r.payee, { placeholder: "e.g. Design contractor (ana-studio.near)" })}${field(state, f, "remaining", "How much is still unpaid?", r.remaining, { amount: true, required: true, hint: "Only the unpaid part, not the full contract." })}</div>
        ${field(state, f, "purpose", "What is it for?", r.purpose, { area: true, placeholder: "e.g. Final milestone: handover and documentation, due Dec 1" })}
        ${field(state, f, "evidence", "Where's the proof?", r.evidence, { area: true, placeholder: "e.g. Contract #22, clause 3; milestone accepted in tracker", hint: "Agreement or invoice reference." })}
        ${checkbox(state, f, "reviewed", "I've checked this amount and its proof.", r.reviewed)}
        <div class="f-actions"><button type="submit">Save</button><button class="f-link-danger" type="submit" name="remove" value="yes" formnovalidate>Remove</button></div>
      </form></div></details>`;
    })
    .join("");
  return `${intro("commitments", 3, "Work that's agreed but not paid yet still needs money. List it here so the leftover balance isn't mistaken for unused funding. Include anything owed from outside this wallet too.")}
  ${cards || `<section class="f-card f-empty-card"><p><strong>Nothing listed yet.</strong> If the program still owes anyone, add it. If it owes nothing, just continue.</p></section>`}
  <form class="f-inline" method="post" action="/edit?flow=commitments">${hidden(state, "add-commitment", "add-commitment")}<button class="f-btn-quiet" type="submit">${svg(ic.plus)}Add something still owed</button></form>`;
}

function scope(state: ViewState): string {
  const p = state.program,
    f = "coverage-form";
  return `${intro("scope", 4, "One last honesty check before the report. These are your statements as the program team. They're labelled that way in the report, not presented as an audit or as funder approval.")}
  <section class="f-card">${form(state, "scope", "coverage", f, "", "result")}
    ${checkbox(state, f, "paymentsComplete", "Every payment and every source of funding for this program and period is included, including other wallets and internal transfers.", p.paymentsComplete)}
    ${checkbox(state, f, "commitmentsComplete", "Everything the program still owes is listed, including anything owed outside this wallet.", p.commitmentsComplete)}
    <div class="f-actions"><button type="submit">Save and see the report ${svg(ic.arrow)}</button></div>
  </form></section>`;
}

function result(state: ViewState): string {
  const p = state.program,
    a = assess(p);
  const fixes = a.blockers.length
    ? `<section class="f-card"><div class="f-card-head"><h2>Finish these first</h2><span>${a.blockers.length}</span></div><ul class="f-fixes">${a.blockers
        .map((b) => {
          const s = blockerStep(b);
          return `<li>${svg(ic.alert, 16)}<span>${e(plainBlocker(b))}</span><a data-guide-nav href="${q(s)}">Go to ${stepInfo[s].short} ${svg(ic.arrow, 14)}</a></li>`;
        })
        .join("")}</ul></section>`
    : "";
  const calc = [
    ["Funding received", a.fundingReceived],
    ["Spent on the program (explained)", a.supportedExpenses],
    ["Already returned to the funder", a.supportedReturns],
    ["Paid out, not yet explained", a.unresolvedOutflow],
    ["Left in the treasury", a.balance],
    ["Still owed", a.commitments],
    ["Left after paying what's owed", a.cashAfterCommitments],
  ];
  return `${intro("result", 5, a.readyForReview ? "Everything is accounted for. Download the report and send it to whoever reviews the program." : "Here's where things stand. The report can be downloaded any time, and anything unfinished is clearly marked in it.")}
  <section class="f-verdict ${a.readyForReview ? "is-ready" : "is-blocked"}"><div><p class="f-kicker">${a.readyForReview ? "Ready for review" : "Not ready yet"}</p><p class="f-verdict-label">Possibly returnable</p><p class="f-verdict-amount">${a.returnProposal === null ? "Not established" : e(money(a.returnProposal))}</p><p>${a.readyForReview ? "Based on your terms and statements. Your funder decides. No refund is sent by this app." : `${a.blockers.length} thing${a.blockers.length === 1 ? "" : "s"} to finish before a return amount can be proposed.`}</p></div><div class="f-downloads"><a class="f-btn" href="/review.html" download>${svg(ic.download)}Download review packet</a><a class="f-btn-quiet" href="/statement.json" download>${svg(ic.doc)}Download statement</a><small>The packet is a readable report (print it to PDF). The statement is a full backup you can import later.</small></div></section>
  ${fixes}
  <section class="f-card"><div class="f-card-head"><h2>How the number is worked out</h2></div><dl class="f-calc">${calc.map(([l, v]) => `<div><dt>${l}</dt><dd>${e(amount(v))}</dd></div>`).join("")}</dl><p class="f-note">Exact USDC, six decimals, no rounding or currency conversion. ${a.cashDifference === null ? "The deal hasn't been entered yet." : a.cashDifference === "0" ? "Received − paid out equals the closing balance." : `Received − paid out is off from the closing balance by ${e(money(a.cashDifference))}.`}</p></section>`;
}

export function renderGuide(state: ViewState, step: GuideStep): string {
  const p = state.program,
    a = assess(p),
    index = steps.indexOf(step);
  const body = {
    terms,
    source,
    payments: explain,
    commitments: owed,
    scope,
    result,
  }[step](state);
  const prev = index > 0 ? steps[index - 1]! : null,
    next = index < steps.length - 1 ? steps[index + 1]! : null;
  const nav = `<nav class="f-pager" aria-label="Step navigation">${prev ? `<a class="f-btn-quiet" data-guide-nav href="${q(prev)}">${svg(ic.back)}${stepInfo[prev].short}</a>` : `<a class="f-btn-quiet" data-guide-nav href="/app">${svg(ic.back)}Your reviews</a>`}${next ? `<a class="f-btn" data-guide-nav href="${q(next)}">Next: ${stepInfo[next].short} ${svg(ic.arrow)}</a>` : `<a class="f-btn-quiet" data-guide-nav href="/app">Back to your reviews</a>`}</nav>`;
  const top = `<span class="f-saved">${svg(ic.check, 14)}${state.archive ? "Saved" : "Session"} · draft ${state.revision}</span><a href="/app">Your reviews</a><a class="f-top-btn" href="/review.html" download>${svg(ic.download, 15)}Report</a>`;
  return page(
    `${stepInfo[step].short} — ${p.name}`,
    "flow guided",
    top,
    `<div class="f-context"><div><p class="f-prog">${e(p.name)}</p>${p.chainReview ? `<p class="f-treasury">${svg(ic.lock, 13)}NEAR treasury <code>${e(p.chainReview.treasury)}</code> · read-only</p>` : ""}</div>${stepper(p, step)}</div>
<main id="main" class="f-main" data-step="${step}"><div class="f-col">${notices(state)}<p id="unsaved-warning" class="f-error" role="alert" tabindex="-1" hidden>${svg(ic.alert)}<span>You have unsaved changes. Save the form first, or your typing will be lost.</span></p>${body}${nav}</div>${moneyPanel(p, a)}</main>`,
  );
}
