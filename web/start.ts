import { assess } from "../src/domain/closeout.ts";
import { money } from "../src/domain/money.ts";
import { escape as e } from "./view.ts";
import type { ViewState } from "./view.ts";
import {
  hidden,
  ic,
  notices,
  page,
  stepInfo,
  stepStatus,
  svg,
} from "./flow/ui.ts";
import type { StepId } from "./flow/ui.ts";

const order: StepId[] = [
  "terms",
  "source",
  "payments",
  "commitments",
  "scope",
  "result",
];

export function renderStart(state: ViewState): string {
  const p = state.program,
    a = assess(p),
    fresh = !!p.setupPending,
    legacy = !fresh && !p.chainReview;
  const error = state.error,
    creating = error?.form === "create-form";
  const value = (key: string) =>
    creating ? e(error.values.get(key) ?? "") : "";
  const field = (
    name: string,
    label: string,
    hint: string,
    placeholder: string,
  ) =>
    `<div class="f-field${creating && error.field === name ? " is-invalid" : ""}"><label for="create-${name}">${label}</label><input id="create-${name}" name="${name}" type="text" maxlength="${name === "name" ? 100 : 64}" required autocomplete="off" placeholder="${placeholder}"${name === "treasury" ? ' class="mono" spellcheck="false"' : ""} value="${value(name)}"${creating && error.field === name ? ' aria-invalid="true" autofocus' : ""} aria-describedby="create-${name}-hint"><small id="create-${name}-hint">${creating && error.field === name ? e(error.message) : hint}</small></div>`;
  const next = order.find((s) => stepStatus(p, a, s) !== "done") ?? "result";
  const done = order.filter((s) => stepStatus(p, a, s) === "done").length;

  const working =
    fresh || legacy
      ? ""
      : `<section class="f-card f-review"><div class="f-review-head"><div><p class="f-kicker">Working review · draft ${state.revision}</p><h2>${e(p.name)}</h2><p class="f-treasury">${svg(ic.lock, 13)}NEAR treasury <code>${e(p.chainReview!.treasury)}</code></p></div><span class="f-badge ${a.readyForReview ? "is-ok" : "is-warn"}">${a.readyForReview ? "Ready for review" : "In progress"}</span></div>
      <div class="f-progress" aria-label="${done} of 6 steps done"><span class="f-progress-bar"><span class="w${done}"></span></span><span>${done} of 6 steps done</span></div>
      <dl class="f-mini"><div><dt>Left in the treasury</dt><dd>${e(money(a.balance))}</dd></div><div><dt>Still owed</dt><dd>${e(money(a.commitments))}</dd></div><div><dt>Possibly returnable</dt><dd>${a.returnProposal === null ? "Not yet" : e(money(a.returnProposal))}</dd></div></dl>
      <div class="f-actions"><a class="f-btn" href="/guided?step=${next}">Continue review · ${stepInfo[next].short} ${svg(ic.arrow)}</a><a class="f-btn-quiet" href="/review.html" download>${svg(ic.download)}Download review packet</a></div></section>`;

  const createForm = `<form id="create-form" class="f-form" method="post" action="/edit?return=reviews">${hidden(state, "create-review", "create-form")}
    ${field("name", "Program name", "Shown at the top of your report.", "e.g. Community tools grant, Round 3")}
    ${field("treasury", "NEAR treasury account", "The public account that paid people, like a DAO or team account. Not a key or seed phrase. No wallet connection.", "e.g. yourdao.sputnik-dao.near")}
    ${fresh ? "" : `<label class="f-check"><input type="checkbox" name="confirm"${creating && error.values.get("confirm") === "on" ? " checked" : ""}><span>Start a new review. ${state.archive ? "The current one is kept as a named copy." : "I downloaded the current review first."}</span></label>`}
    <div class="f-actions"><button type="submit">Create review ${svg(ic.arrow)}</button></div>
  </form>`;

  const first = `<section class="f-start"><div class="f-start-copy"><p class="f-kicker">No reviews yet</p><h1>Let's account for a program's money.</h1><p class="f-lead">Six short steps. At the end you get a report your funder can read: what was paid, why, what's still owed and what could go back.</p>
      <ol class="f-preview">${order.map((s, i) => `<li><span>${i + 1}</span>${stepInfo[s].title}</li>`).join("")}</ol>
      <div class="f-need"><p><strong>Have these handy</strong></p><ul><li>${svg(ic.doc, 15)}Your grant or funding agreement</li><li>${svg(ic.doc, 15)}The treasury's NEAR account name</li><li>${svg(ic.doc, 15)}Invoices or notes for each payment</li></ul></div></div>
    <div class="f-card f-create"><h2>${fresh || legacy ? "Create your first review" : "Create another review"}</h2><p class="f-sub">Just two things to begin. Everything else comes step by step.</p>${createForm}</div></section>`;

  const copies = state.archive?.copies ?? [];
  const saved = copies.length
    ? `<section class="f-card"><div class="f-card-head"><h2>Saved copies</h2><span>${copies.length}</span></div><form class="f-form" method="post" action="/edit?return=reviews">${hidden(state, "open-copy", "storage-open")}<div class="f-field"><label for="review-copy">Open a saved copy</label><select id="review-copy" name="copyId">${copies.map((c) => `<option value="${e(c.id)}"${error?.form === "storage-open" && error.values.get("copyId") === c.id ? " selected" : ""}>${e(c.name)} · ${e(c.savedAt)}</option>`).join("")}</select></div><label class="f-check"><input type="checkbox" name="confirm"${error?.form === "storage-open" && error.values.get("confirm") === "on" ? " checked" : ""}><span>Replace the working review with this copy. Its review ticks are cleared so you check them again.</span></label><div class="f-actions"><button class="f-btn-quiet" type="submit">Open saved review</button></div></form></section>`
    : "";

  const content = `<main id="main" class="f-home">${fresh || legacy ? "" : '<h1 class="f-sr">Your reviews</h1>'}${notices(state)}
  ${legacy ? '<details class="f-card f-legacy"><summary>An older practice draft is kept here</summary><p>It was retained, not turned into real payment records. Starting a review keeps it as a named copy.</p><a href="/workspace">Inspect it in all records</a></details>' : ""}
  ${working}
  ${fresh || legacy ? first : `<details class="f-card f-another"${creating ? " open" : ""}><summary>${svg(ic.doc, 16)}Create another review</summary><div class="f-another-body">${createForm}</div></details>`}
  ${saved}
  <p class="f-foot">${svg(ic.lock, 14)}${state.archive ? (state.cloudStorage ? "Saved in encrypted private server storage, tied to this browser (no account login). Download a backup when you finish." : "Saved on this server and tied to this browser (no account login). Download a backup when you finish.") : "This session is temporary. Download a backup."} <a href="/workspace#saved-work">Backups, import and all records</a></p>
  </main>`;
  return page(
    "Your reviews",
    "flow home",
    '<span class="f-ro">NEAR reads only · no wallet</span>',
    content,
  );
}
