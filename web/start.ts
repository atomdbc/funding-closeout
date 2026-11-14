import { assess } from "../src/domain/closeout.ts";
import { money } from "../src/domain/money.ts";
import { escape as e } from "./view.ts";
import type { ViewState } from "./view.ts";

export function renderStart(state: ViewState): string {
  const p = state.program,
    a = assess(p),
    fresh = !!p.setupPending,
    legacy = !fresh && !p.chainReview;
  const error = state.error,
    creating = error?.form === "create-form";
  const value = (key: string) =>
    creating ? e(error.values.get(key) ?? "") : "";
  const hidden = (action: string, form: string) =>
    `<input type="hidden" name="token" value="${e(state.token)}"><input type="hidden" name="revision" value="${state.revision}"><input type="hidden" name="action" value="${action}"><input type="hidden" name="form" value="${form}">`;
  const field = (name: string, label: string, hint: string) =>
    `<div class="field"><label for="create-${name}">${label}</label><input id="create-${name}" name="${name}" type="text" maxlength="${name === "name" ? 100 : 64}" required autocomplete="off" value="${value(name)}"${creating && error.field === name ? ' aria-invalid="true" autofocus' : ""} aria-describedby="create-${name}-hint"><small id="create-${name}-hint">${creating && error.field === name ? e(error.message) : hint}</small></div>`;
  const next = !p.chainReview?.totalsReported
    ? "terms"
    : a.unresolvedPaymentIds.length
      ? "payments"
      : a.unreviewedCommitmentIds.length
        ? "commitments"
        : !p.paymentsComplete || !p.commitmentsComplete
          ? "scope"
          : "result";
  const working = fresh
    ? '<p class="eyebrow">No reviews yet</p>'
    : `<section class="review-card"><div class="section-heading"><div><p class="eyebrow">Working review · Draft ${state.revision}</p><h2>${e(p.name)}</h2></div><span class="status ${a.readyForReview ? "good" : "warning"}">${a.readyForReview ? "Ready for human review" : "In progress"}</span></div><p>${p.chainReview ? `NEAR treasury: <strong>${e(p.chainReview.treasury)}</strong>` : "Legacy fictional draft — not real payment evidence. It has been retained, not converted into a real review."}</p><dl class="dashboard-totals"><div><dt>Reported balance</dt><dd>${e(money(a.balance))}</dd></div><div><dt>Still owed</dt><dd>${e(money(a.commitments))}</dd></div><div><dt>Conditional proposal</dt><dd>${a.returnProposal === null ? "Not established" : e(money(a.returnProposal))}</dd></div></dl><div class="actions"><a class="button" href="${p.chainReview ? `/guided?step=${next}` : "/workspace"}">Continue review</a><a class="button quiet-link" href="/review.html" download>Download review packet</a><a href="/workspace#saved-work">Backups and recovery</a></div></section>`;
  const create = `<form id="create-form" method="post" action="/edit?return=reviews">${hidden("create-review", "create-form")}<h2>${fresh || legacy ? "Create your first review" : "Create another review"}</h2><p>One funded program, one USDC account. Start with its name and the public treasury that made the payments.</p>${field("name", "Program name", "Use a name you will recognize in the exported review packet.")}${field("treasury", "NEAR treasury account", "Public account ID only. Do not enter a key or seed phrase. No wallet connection is needed.")}${fresh ? "" : `<label class="check"><input type="checkbox" name="confirm"${creating && error.values.get("confirm") === "on" ? " checked" : ""}><span>Start a new working review. ${state.archive ? "Save the current review as a named copy first." : "I downloaded the current review before replacing it."} Existing named copies and recovery history are retained.</span></label>`}<button type="submit">Create review</button><p class="small">Funding and balances start as Not entered—not guessed zero. Your records are saved only when you submit a form.</p></form>`;
  const visibleWorking = legacy
    ? '<details class="retained-draft"><summary>Retained older local draft</summary><p>Your previous fictional records have been retained, not converted into real payment evidence. Creating a real review requires explicit confirmation and preserves a named copy when local storage is enabled.</p><a href="/workspace">Inspect retained draft and backups</a></details>'
    : working;
  const copies = state.archive?.copies ?? [];
  const saved = copies.length
    ? `<section><h2>Saved reviews</h2><p>Reopening a saved copy replaces the working review and clears its review/scope declarations so you can check them again.</p><form method="post" action="/edit?return=reviews">${hidden("open-copy", "storage-open")}<div class="field"><label for="review-copy">Saved review copy</label><select id="review-copy" name="copyId">${copies.map((c) => `<option value="${e(c.id)}"${error?.form === "storage-open" && error.values.get("copyId") === c.id ? " selected" : ""}>${e(c.name)} — ${e(c.savedAt)}</option>`).join("")}</select></div><label class="check"><input type="checkbox" name="confirm"${error?.form === "storage-open" && error.values.get("confirm") === "on" ? " checked" : ""}><span>Replace the working review with this copy and clear its review/scope declarations.</span></label><button class="quiet" type="submit">Open saved review</button></form></section>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Your reviews — Funding closeout</title><link rel="stylesheet" href="/app.css"><script src="/app.js" defer></script></head><body><a class="skip" href="#main">Skip to reviews</a><header class="topbar"><a class="wordmark" href="/"><span class="brand-mark" aria-hidden="true"></span>Funding closeout</a><span class="read-only-label">NEAR reads only · No wallet connection</span></header><main id="main" class="start-shell"><div class="page-heading"><div><p class="eyebrow">Your workspace</p><h1>Reviews</h1><p>Prepare a clear account of a funded program’s money.</p></div></div>${state.message ? `<p class="notice" role="status">${e(state.message)}</p>` : ""}${error ? `<div class="error" role="alert" tabindex="-1" data-error><strong>Changes were not saved.</strong> ${e(error.message)} Your submitted values are kept below.</div>` : ""}${visibleWorking}<section>${fresh || legacy ? create : `<details${creating ? " open" : ""}><summary>Create another review</summary><div class="terms-body">${create}</div></details>`}</section>${saved}<p class="small">${state.archive ? "Working reviews and copies are stored on this server, not in a signed funder account. Access uses this browser’s cookie. Keep downloaded backups; records are not encrypted." : "This server session is temporary. Keep downloaded backups."} <a href="/workspace#saved-work">Import / recovery tools</a>.</p></main></body></html>`;
}
