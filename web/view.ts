import { assess, supported } from "../src/domain/closeout.ts";
import type { Program } from "../src/domain/closeout.ts";
import { money } from "../src/domain/money.ts";
import { RPC_ENDPOINT, USDC_CONTRACT } from "../src/near/facts.ts";
import type { SavedCopy, HistoryEntry } from "../server/storage.ts";

export function escape(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (s) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        s
      ]!,
  );
}
export interface ViewState {
  program: Program;
  revision: number;
  token: string;
  message?: string;
  archive?: { copies: SavedCopy[]; history: HistoryEntry[] };
  openSource?: boolean;
  hosted?: boolean;
  error?: {
    form: string;
    field: string;
    message: string;
    values: URLSearchParams;
  };
}
export function render(state: ViewState): string {
  const { program: p } = state,
    a = assess(p),
    e = escape;
  const totalsReported =
    !p.setupPending && (!p.chainReview || p.chainReview.totalsReported);
  const next =
    !totalsReported || !p.termsReference.trim() || p.policy !== "return-unspent"
      ? {
          href: "#terms",
          title:
            p.policy === "fixed-award" &&
            totalsReported &&
            p.termsReference.trim()
              ? "Review whether a return applies"
              : "Start with the funding terms",
          detail:
            p.policy === "fixed-award" &&
            totalsReported &&
            p.termsReference.trim()
              ? "A fixed award is not automatically refundable. Keep the actual terms; do not change them just to produce a return proposal."
              : "Record the approved scope and establish whether unused funds must be returned.",
        }
      : a.unresolvedPaymentIds.length
        ? {
            href: `#payment-${a.unresolvedPaymentIds[0]}`,
            title: `Explain ${a.unresolvedPaymentIds.length} payment${a.unresolvedPaymentIds.length === 1 ? "" : "s"}`,
            detail:
              "Add a purpose, supporting evidence and your review. A transfer alone does not explain the payment.",
          }
        : a.unreviewedCommitmentIds.length
          ? {
              href: `#commitment-${a.unreviewedCommitmentIds[0]}`,
              title: "Review what is still owed",
              detail:
                "Check the unpaid remainder and the evidence for each remaining obligation.",
            }
          : a.cashDifference !== null && a.cashDifference !== "0"
            ? {
                href: "#terms",
                title: "Reconcile the reported balance",
                detail:
                  "The funding, recorded outflows and closing balance do not currently add up.",
              }
            : !p.paymentsComplete || !p.commitmentsComplete
              ? {
                  href: "#coverage",
                  title: "Confirm the review covers the whole program",
                  detail:
                    "Include other receipts, internal transfers and obligations outside this wallet.",
                }
              : {
                  href: "#closeout",
                  title: a.readyForReview
                    ? "Prepare the human review"
                    : "Review the remaining blockers",
                  detail: a.readyForReview
                    ? "Download the unsigned statement and supporting packet. No funder approval or transfer is implied."
                    : "The statement explains what still prevents a conditional return proposal.",
                };
  function value(form: string, name: string, fallback: unknown): string {
    return e(
      state.error?.form === form
        ? (state.error.values.get(name) ?? "")
        : fallback,
    );
  }
  function checked(form: string, name: string, fallback: boolean): string {
    return (
      state.error?.form === form
        ? state.error.values.get(name) === "on"
        : fallback
    )
      ? " checked"
      : "";
  }
  function input(
    form: string,
    name: string,
    label: string,
    fallback: string,
    options: {
      area?: boolean;
      amount?: boolean;
      required?: boolean;
      hint?: string;
      readOnly?: boolean;
    } = {},
  ): string {
    const id = `${form}-${name}`,
      invalid = state.error?.form === form && state.error.field === name;
    const attrs = `id="${id}" name="${name}" autocomplete="off"${options.readOnly ? " readonly" : ""}${options.required ? " required" : ""}${invalid ? ' aria-invalid="true" autofocus' : ""} aria-describedby="${id}-hint"`;
    return `<div class="field"><label for="${id}">${e(label)}</label>${options.area ? `<textarea ${attrs} maxlength="1000" rows="2">${value(form, name, fallback)}</textarea>` : `<input ${attrs} type="text" ${options.amount ? 'inputmode="decimal" maxlength="19"' : 'maxlength="150"'} value="${value(form, name, fallback)}">`}<small id="${id}-hint">${invalid ? e(state.error!.message) : e(options.hint ?? (options.amount ? "USDC quantity. Up to 6 decimals; no commas." : ""))}</small></div>`;
  }
  function start(form: string, action: string, id = ""): string {
    return `<form id="${form}" method="post" action="/edit"><input type="hidden" name="token" value="${e(state.token)}"><input type="hidden" name="revision" value="${state.revision}"><input type="hidden" name="action" value="${action}"><input type="hidden" name="form" value="${form}"><input type="hidden" name="id" value="${e(id)}">`;
  }
  function checkbox(
    form: string,
    name: string,
    label: string,
    yes: boolean,
  ): string {
    return `<label class="check"><input type="checkbox" name="${name}"${checked(form, name, yes)}><span>${e(label)}</span></label>`;
  }
  const payments = p.payments
    .map((row, i) => {
      const form = `payment-${row.id}`,
        ok = supported(row) && (!p.chainReview || !!row.chain);
      return `<details class="record"${!ok || state.error?.form === form ? " open" : ""}><summary><span class="record-main"><span class="record-title">${e(row.recipient || `Payment ${i + 1}`)}</span><span class="record-meta">${e(row.reference || "No payment reference")} · Edit record</span></span><span class="record-right"><span class="amount">${e(money(row.amount))}</span><span class="status ${ok ? "good" : "warning"}">${ok ? (row.kind === "returned" ? "Return recorded" : "Supported by reporter") : "Needs explanation"}</span></span></summary>
      <div class="record-body">${row.importedTransfer ? `<div class="notice"><strong>Imported claim — not RPC-checked.</strong><p>Facts in an unsigned JSON file are not trusted. Save any explanation changes first, then recheck this movement against NEAR. A mismatch stays unresolved.</p>${start(`recheck-${row.id}`, "recheck-payment", row.id)}<button type="submit" data-busy-label="Checking NEAR…">Recheck imported transfer</button></form></div>` : ""}${row.chain ? `<div class="chain-facts"><h3>NEAR transfer facts</h3><p class="status ${row.chain.basis === "public-rpc" ? "good" : "warning"}">${row.chain.basis === "public-rpc" ? "Final success checked via public RPC" : "Synthetic test fixture — not live verification"}</p><dl><div><dt>Network</dt><dd>NEAR mainnet${row.chain.basis === "test-fixture" ? " (fixture response)" : ""}</dd></div><div><dt>Transfer payer</dt><dd>${e(row.chain.sender)}</dd></div><div><dt>Transaction signer</dt><dd>${e(row.chain.transactionSigner)}</dd></div><div><dt>Recipient</dt><dd>${e(row.chain.recipient)}</dd></div><div><dt>Quantity</dt><dd class="amount">${e(money(row.chain.amount))}</dd></div><div><dt>Issuer contract</dt><dd><code>${e(row.chain.tokenContract)}</code></dd></div><div><dt>Transaction</dt><dd><code>${e(row.chain.transactionHash)}</code></dd></div><div><dt>Receipt</dt><dd><code>${e(row.chain.receiptId)}</code></dd></div><div><dt>Receipt block</dt><dd><code>${e(row.chain.blockHash)}</code></dd></div><div><dt>Checked at</dt><dd>${e(row.chain.checkedAt)}</dd></div></dl><p>Movement facts only. Public RPC responses are trusted, not independently consensus-verified. These facts do not prove wallet ownership, program membership, purpose or work completion.</p></div>` : ""}${start(form, "payment", row.id)}<div class="field-grid">${input(form, "recipient", "Recipient", row.recipient, { readOnly: !!row.chain })}${input(form, "amount", "Amount", row.amount, { amount: true, required: true, readOnly: !!row.chain })}${input(form, "reference", "Payment reference", row.reference, { readOnly: !!row.chain, hint: row.chain ? "Bound to the checked transaction and execution receipt; not editable." : "A unique reference. Demo references are not blockchain receipts." })}<div class="field"><label for="${form}-kind">How should this payment be treated?</label><select id="${form}-kind" name="kind">${[
        ["unresolved", "Unresolved — do not assume a purpose"],
        ["expense", "Program expense"],
        ["returned", "Return to funder"],
      ]
        .map(
          ([key, label]) =>
            `<option value="${key}"${(state.error?.form === form ? state.error.values.get("kind") : row.kind) === key ? " selected" : ""}>${label}</option>`,
        )
        .join(
          "",
        )}</select></div></div>${input(form, "purpose", "What did this payment cover?", row.purpose, { area: true })}${input(form, "evidence", "Supporting evidence", row.evidence, { area: true, hint: "Document ID, explanation or link. This prototype does not fetch or verify it." })}${checkbox(form, "reviewed", "I reviewed this explanation and its supporting evidence.", row.reviewed)}<div class="actions"><button type="submit">Save payment</button><button class="quiet danger" type="submit" name="remove" value="yes" formnovalidate>Remove record</button></div></form></div></details>`;
    })
    .join("");
  const commitments = p.commitments
    .map((row) => {
      const form = `commitment-${row.id}`,
        pending = a.unreviewedCommitmentIds.includes(row.id);
      return `<details class="record"${pending || state.error?.form === form ? " open" : ""}><summary><span class="record-main"><span class="record-title">${e(row.payee || "Unnamed commitment")}</span><span class="record-meta">${e(row.purpose || "Purpose not recorded")} · Edit record</span></span><span class="record-right"><span class="amount">${e(money(row.remaining))}</span><span class="status ${pending ? "warning" : "good"}">${pending ? "Needs review" : "Still owed"}</span></span></summary><div class="record-body">${start(form, "commitment", row.id)}<div class="field-grid">${input(form, "payee", "Who is still owed?", row.payee)}${input(form, "remaining", "Remaining amount", row.remaining, { amount: true, required: true, hint: "Only the unpaid remainder, not the original contract total." })}</div>${input(form, "purpose", "What is still owed or to be delivered?", row.purpose, { area: true })}${input(form, "evidence", "Commitment evidence", row.evidence, { area: true, hint: "Agreement or invoice reference. A stated commitment is not independently verified." })}${checkbox(form, "reviewed", "I reviewed the remaining obligation and its evidence.", row.reviewed)}<div class="actions"><button type="submit">Save commitment</button><button class="quiet danger" name="remove" value="yes" formnovalidate>Remove record</button></div></form></div></details>`;
    })
    .join("");
  const totals = [
    ["Funding received", a.fundingReceived],
    ["Supported expenses", a.supportedExpenses],
    ["Returns already recorded", a.supportedReturns],
    ["Unresolved outflows", a.unresolvedOutflow],
    ["Reported closing balance", a.balance],
    ["Still committed", a.commitments],
    ["Cash after stated commitments", a.cashAfterCommitments],
  ];
  const archive = `<section id="saved-work"><h2>Drafts and backups</h2><p>${state.archive ? "Each successful form save is written to a private local SQLite file. Unsubmitted typing is not stored. Use this same browser profile to reopen your work; clearing its cookie loses browser access. Keep downloaded backups. Local files are not encrypted." : "This temporary session is held in memory. Download a statement before restarting."}</p><details${state.error?.form.startsWith("storage-") ? " open" : ""}><summary>Save, reopen or import a draft</summary><div class="terms-body">${state.archive ? `${start("storage-save", "save-copy")}${input("storage-save", "copyName", "Saved copy name", p.name, { required: true, hint: "Pin a named copy independently of the rolling 30-revision history. Maximum 20 copies." })}<button type="submit">Save named copy</button></form>${state.archive.copies.length ? `${start("storage-open", "open-copy")}<div class="field"><label for="storage-copy">Saved local copy</label><select id="storage-copy" name="copyId">${state.archive.copies.map((c) => `<option value="${e(c.id)}"${state.error?.form === "storage-open" && state.error.values.get("copyId") === c.id ? " selected" : ""}>${e(c.name)} — ${e(c.savedAt)}</option>`).join("")}</select></div>${checkbox("storage-open", "confirm", "Replace the working draft with this copy; clear its review and scope marks.", false)}<button type="submit">Open saved copy</button></form><details><summary>Delete a saved copy</summary>${start("storage-delete", "delete-copy")}<div class="field"><label for="storage-delete-copy">Copy to delete</label><select id="storage-delete-copy" name="copyId">${state.archive.copies.map((c) => `<option value="${e(c.id)}"${state.error?.form === "storage-delete" && state.error.values.get("copyId") === c.id ? " selected" : ""}>${e(c.name)}</option>`).join("")}</select></div>${checkbox("storage-delete", "confirm", "Delete this saved copy. I kept a downloaded backup if needed.", false)}<button class="quiet danger" type="submit">Delete saved copy</button></form></details>` : '<p class="empty">No named copies yet. The working draft is still autosaved after successful edits.</p>'}<details><summary>Recent local revisions — last 30</summary><p>Local recovery history, not a tamper-proof audit log. Restoring clears review and scope marks. Prior RPC checks keep their original check times and are not refreshed.</p>${start("storage-history", "restore-revision")}<div class="field"><label for="storage-history-revision">Revision to restore</label><select id="storage-history-revision" name="historyRevision">${state.archive.history.map((h) => `<option value="${h.revision}"${state.error?.form === "storage-history" && state.error.values.get("historyRevision") === String(h.revision) ? " selected" : ""}>Draft ${h.revision} — ${e(h.action)} — ${e(h.createdAt)}</option>`).join("")}</select></div>${checkbox("storage-history", "confirm", "Replace the working draft with this historical revision; clear review and scope marks.", false)}<button class="quiet" type="submit">Restore revision</button></form></details>` : ""}<h3>Import a downloaded statement</h3><p>Imported data is unverified. Review/scope marks are cleared. Any NEAR transfer must be checked again; a supplied hash is not authentication.</p><label for="statement-file">Choose closeout JSON (optional; 256 KiB maximum)</label><input id="statement-file" type="file" accept="application/json,.json" data-statement-file><p class="small" data-file-status role="status">Or paste the exported JSON below. File selection needs JavaScript; paste works without it.</p>${start("storage-import", "import-statement")}<div class="field"><label for="statement-source">Closeout JSON</label><textarea id="statement-source" name="statementSource" rows="5" maxlength="262144" required autocomplete="off">${value("storage-import", "statementSource", "")}</textarea></div>${checkbox("storage-import", "confirm", "Replace the working draft with imported claims; clear review and scope marks and recheck NEAR movements.", false)}<button class="quiet" type="submit">Import as unverified claims</button></form></div></details></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>Funding closeout — ${e(p.name)}</title><link rel="preload" href="/assets/hanken-grotesk-variable.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="/app.css"><script src="/app.js" defer></script></head><body><a class="skip" href="#main">Skip to review</a><header class="topbar"><a class="wordmark" href="/app"><span class="brand-mark" aria-hidden="true"></span>Funding closeout</a><div class="topbar-meta"><span class="read-only-label">NEAR reads only · No wallet</span><a href="/app">Your reviews</a></div></header><main id="main" class="app-shell"><nav class="section-nav" aria-label="Review sections"><p class="nav-label">Program review</p><a href="#terms"><span aria-hidden="true" class="nav-step">1</span>Funding terms</a><a href="#payments"><span aria-hidden="true" class="nav-step">2</span>Payments</a><a href="#commitments"><span aria-hidden="true" class="nav-step">3</span>Commitments</a><a href="#coverage"><span aria-hidden="true" class="nav-step">4</span>Scope</a><a href="#closeout">Closeout</a><p class="nav-label nav-secondary">Tools</p><a href="#near-check">NEAR checks</a><a href="#saved-work">Drafts</a><p class="nav-note">One program.<br>One USDC asset.<br>No funds move here.</p></nav><div class="app-content"><div class="workspace-context"><span>Workspace / Program closeout</span><span class="mode-label">${p.chainReview ? "NEAR mainnet · Read-only" : "Fictional example"}</span></div><div class="example-banner">${p.setupPending ? "<strong>No review created yet.</strong> Create a review from Your reviews, or import a backup below. Financial totals have not been entered." : p.chainReview ? "<strong>Read-only NEAR review.</strong> Only marked transfer facts are RPC-checked. Terms, balances, purpose and review marks are reporter-supplied; no wallet ownership or funder approval is verified." : "<strong>Fictional example.</strong> Demo records are not blockchain evidence. Start a separate NEAR review to check public transfers; no wallet connection or signing."}</div>
  <div class="page-heading"><div><h1>${e(p.name)}</h1><p>A clear account of what was funded, what was paid and what is still owed.</p></div><span class="revision">${state.archive ? (state.hosted ? "Saved on server · " : "Saved locally · ") : ""}Draft ${state.revision}</span></div>${state.message ? `<p class="notice" role="status">${e(state.message)}</p>` : ""}${state.error ? `<div class="error" id="form-error" role="alert" tabindex="-1" data-error><strong>Changes were not saved.</strong> ${e(state.error.message)} Your submitted values are kept below.</div>` : ""}
  <dl class="overview" aria-label="Reported program overview">${[
    ["Funding received", a.fundingReceived, "Reporter-supplied funding"],
    ["Reported closing balance", a.balance, "Not inferred from transfers"],
    ["Still committed", a.commitments, "Stated unpaid obligations"],
  ]
    .map(
      ([label, amount, hint]) =>
        `<div><dt>${e(label)}</dt><dd>${e(money(amount))}</dd><dd class="overview-hint">${e(hint)}</dd></div>`,
    )
    .join(
      "",
    )}</dl><div class="next-step"><div><span class="eyebrow">${a.readyForReview ? "Recorded checks complete" : `${a.blockers.length} check${a.blockers.length === 1 ? "" : "s"} need attention`}</span><h2>${e(next.title)}</h2><p>${e(next.detail)}</p></div><a class="button quiet-link" href="${e(next.href)}">${a.readyForReview ? "Review statement" : "Continue review"}<span aria-hidden="true">↗</span></a></div>
  <div class="workspace"><div class="review-column">
  <section id="near-check" class="integration"><details${p.chainReview || state.openSource || state.error?.form === "start-near-form" ? " open" : ""}><summary><h2>${p.chainReview ? "Check a NEAR transfer" : "Read real NEAR payment evidence"}</h2><span class="integration-label">${p.chainReview ? "Public RPC" : "Start a separate review"}</span></summary><div class="integration-body">${p.chainReview ? `<p>Reviewing public outflows from <strong>${e(p.chainReview.treasury)}</strong>. This does not prove you own the account or that a transfer belongs to this program.</p>${start("near-check-form", "check-transfer")}${input("near-check-form", "transactionHash", "NEAR transaction hash", "", { required: true, hint: "Base58 transaction hash, not an explorer URL. Check and add is read-only; it does not send funds." })}${input("near-check-form", "transactionSigner", "Transaction signer, if different", "", { hint: "For a DAO or relayer, use the public signer shown by the explorer. Leave blank if it is the treasury. Never enter a signing key." })}<button type="submit" data-busy-label="Checking NEAR…">Check and add transfer</button></form><p class="small">Checks one unambiguous native USDC ft_transfer receipt with FINAL execution and a matching issuer event. Traceable DAO or relayer calls can be checked too. Multiple USDC movements, refunds, ft_transfer_call and wrapped USDC are not inferred. Free archival RPC is rate limited.</p><details class="source-details"><summary>Which source is checked?</summary><p>Public RPC: <code>${RPC_ENDPOINT}</code></p><p>Circle's mainnet USDC contract: <code>${USDC_CONTRACT}</code>. Amounts use six decimals. No other token is treated as USDC.</p></details>` : `<p>Use a separate mainnet review so real transfers cannot be mixed with this fictional example. This starts an empty draft; no balances or funding terms are guessed.</p>${start("start-near-form", "start-near")}${input("start-near-form", "treasury", "Program treasury account", "", { required: true, hint: "Public account whose USDC was transferred, named or implicit. Never enter a private key or seed phrase." })}${checkbox("start-near-form", "confirm", "Replace this local draft with an empty NEAR review. I downloaded the current statement if I need it.", false)}<button type="submit">Start separate NEAR review</button></form>`}</div></details></section>
  <section id="terms"><h2>Funding terms</h2><p>Record the approved scope. A fixed award is not automatically a refundable budget.</p><details${!totalsReported || state.error?.form === "terms-form" ? " open" : ""}><summary class="terms-summary">${totalsReported ? `${e(money(p.approved))} approved` : "Funding totals not entered"} <span>${p.policy === "return-unspent" ? "Unused-funds return policy" : p.policy === "fixed-award" ? "Fixed award / cost recovery" : "Return policy not established"} · Edit terms</span></summary><div class="terms-body">${start("terms-form", "terms")}${input("terms-form", "name", "Program name", p.name, { required: true })}<div class="field-grid">${input("terms-form", "approved", "Approved amount", totalsReported ? p.approved : "", { amount: true, required: true })}${input("terms-form", "received", "Funding received", totalsReported ? p.received : "", { amount: true, required: true })}${input("terms-form", "balance", "Reported closing balance", totalsReported ? p.balance : "", { amount: true, required: true })}<div class="field"><label for="policy">What do the terms say?</label><select name="policy" id="policy">${[
    ["return-unspent", "Return unused funds after obligations"],
    ["fixed-award", "Fixed award / partial cost recovery"],
    ["unclear", "Not established"],
  ]
    .map(
      ([key, label]) =>
        `<option value="${key}"${(state.error?.form === "terms-form" ? state.error.values.get("policy") : p.policy) === key ? " selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></div></div>${input("terms-form", "termsReference", "Approved terms and reference", p.termsReference, { area: true, hint: "State the actual return terms, not just a grant amount." })}<button type="submit">Save funding terms</button></form></div></details></section>
  <section id="payments"><div class="section-heading"><h2>Explain the payments</h2><span>${p.payments.length} record${p.payments.length === 1 ? "" : "s"}</span></div><p>A reference shows a movement. An explanation and supporting evidence establish your account of its purpose.</p>${payments || '<p class="empty">No payments recorded. Add each outflow in the program period.</p>'}${p.chainReview ? '<a class="button quiet-link" href="#near-check">Check another transfer</a>' : `${start("add-payment", "add-payment")}<button class="quiet" type="submit">Add payment record</button></form>`}</section>
  <section id="commitments"><div class="section-heading"><h2>What is still owed?</h2><span>${p.commitments.length} record${p.commitments.length === 1 ? "" : "s"}</span></div><p>Record remaining obligations before treating the balance as unused. Do not count already-paid amounts again.</p>${commitments || '<p class="empty">No commitments recorded. That is not a confirmation that none exist.</p>'}${start("add-commitment", "add-commitment")}<button class="quiet" type="submit">Add commitment</button></form></section>
  <section id="coverage"><h2>Confirm the scope</h2><p>These are your local declarations, not independent verification or funder approval.</p>${start("coverage-form", "coverage")}${checkbox("coverage-form", "paymentsComplete", "All program funding and outflows for this period are recorded; other receipts and internal transfers have been reconciled.", p.paymentsComplete)}${checkbox("coverage-form", "commitmentsComplete", "I recorded all remaining program obligations, including anything owed outside this wallet.", p.commitmentsComplete)}<button type="submit">Save scope confirmations</button></form></section>${archive}
  </div><aside id="closeout" class="closeout" aria-labelledby="closeout-title"><div class="closeout-panel"><p class="eyebrow">Unsigned review output</p><h2 id="closeout-title">Closeout statement</h2><span class="status ${a.readyForReview ? "good" : "warning"}">${a.readyForReview ? "Ready for human review" : "Not ready for a return proposal"}</span><div class="proposal"><h3>Proposed return</h3><p class="proposal-amount">${a.returnProposal === null ? "Not established" : e(money(a.returnProposal))}</p><p>${a.readyForReview ? "Conditional on the supplied terms and declarations. A funder must review it. No approval or transfer has taken place." : "Resolve the items below before proposing a return. Cash after commitments is not yet a return entitlement."}</p></div><details class="calculation"><summary>View the calculation</summary><dl class="totals">${totals.map(([label, amount]) => `<div><dt>${label}</dt><dd class="amount">${e(money(amount!))}</dd></div>`).join("")}</dl>${a.cashDifference === null ? '<p class="reconciled">Funding and closing balance have not been reported. A transfer does not establish either total.</p>' : a.cashDifference !== "0" ? `<p class="error">Cash does not reconcile. Difference: <span class="amount">${e(money(a.cashDifference))}</span>. Check funding, payments and the balance.</p>` : '<p class="reconciled">The stated funding, outflows and balance reconcile. This is a calculation, not proof of completeness.</p>'}</details>${a.blockers.length ? `<h3>What needs attention</h3><ul class="blockers">${a.blockers.map((b) => `<li>${e(b)}</li>`).join("")}</ul>` : '<p class="notice">The recorded checks are complete. Review the statement and its supporting records before deciding what happens next.</p>'}<a class="button" href="/review.html" download>Download review packet</a><a class="button quiet-link" href="/statement.json" download>Download statement</a><p class="small">JSON includes every input, unresolved item and snapshot hash. The hash identifies these records; it does not prove their authenticity.</p></div></aside></div>
  <footer><p>USDC quantities only. No USD conversion. ${state.archive ? "Successful saves survive server restarts in a server-side, unencrypted SQLite file. Access uses this browser's 30-day rolling cookie, not a verified reviewer identity. Keep downloaded backups." : "Changes are held in this browser session on the local server; they expire after 8 idle hours or a server restart."}</p><details><summary>Clear the working review</summary><p>Download a backup first. Named copies and recovery history are retained; no chain records change.</p>${start("reset-form", "reset")}${checkbox("reset-form", "confirm", "Clear this working review. I kept a backup if needed.", false)}<button class="quiet danger" type="submit">Clear working review</button></form></details><p>No funds move through this app. Read-only receipt checks do not establish an audit, legal entitlement, wallet ownership or funder approval.</p></footer></div></main></body></html>`;
}
